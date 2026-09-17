import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiUrl, getImageUrl } from '../api';
import { getScoreBadgeClass } from '../utils/scoreColors';
import { deduplicateAnimeList } from '../utils/animeDeduplicator';

const ROTATION_INTERVAL_SEC = 30; // 30 seconds auto-rotation
const DISPLAY_COUNT = 10; // Exactly 10 anime in the tape feed
const ROTATE_BATCH_SIZE = 5; // 5 anime change each cycle

export default function SimilarAnimeFeed({
  animeId,
  currentAnime,
  user,
  onSelectAnime
}) {
  const [candidates, setCandidates] = useState([]);
  const [displayedAnime, setDisplayedAnime] = useState([]);
  const [animatingIndices, setAnimatingIndices] = useState(new Set());
  const [rotationPhase, setRotationPhase] = useState(0); // 0 = even indices [0, 2, 4, 6, 8], 1 = odd indices [1, 3, 5, 7, 9]
  const [countdown, setCountdown] = useState(ROTATION_INTERVAL_SEC);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRotatingNow, setIsRotatingNow] = useState(false);

  const scrollRef = useRef(null);
  const displayedIdsRef = useRef(new Set());
  const candidatesRef = useRef([]);

  // Keep refs synchronized
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  useEffect(() => {
    displayedIdsRef.current = new Set(displayedAnime.map((a) => a.id));
  }, [displayedAnime]);

  // Extract client-side fallback candidates from local cached catalogs
  const getClientFallbackCandidates = (target) => {
    if (!target) return [];
    try {
      const allItems = [];
      const seenIds = new Set([target.id]);

      // Scan localStorage for cached catalog pages
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('anilex_catalog_cache_')) {
          try {
            const raw = localStorage.getItem(key);
            const data = raw ? JSON.parse(raw) : null;
            if (data && Array.isArray(data.items)) {
              for (const it of data.items) {
                if (it && it.id && !seenIds.has(it.id)) {
                  seenIds.add(it.id);
                  allItems.push(it);
                }
              }
            }
          } catch (e) {}
        }
      }

      const targetGenres = Array.isArray(target.genres) ? target.genres : [];
      const targetGenreSet = new Set(targetGenres.map((g) => (g || '').toLowerCase()));
      const targetWords = (target.title || '')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      const scored = allItems.map((item) => {
        const itemGenres = Array.isArray(item.genres) ? item.genres : [];
        const matching = itemGenres.filter((g) => targetGenreSet.has((g || '').toLowerCase()));
        let score = matching.length * 20;
        const itemTitle = (item.title || '').toLowerCase();
        for (const w of targetWords) {
          if (itemTitle.includes(w)) score += 8;
        }
        if (item.averageScore) score += Number(item.averageScore) * 1.5;
        return {
          ...item,
          matchingGenres: matching,
          similarityScore: score
        };
      });

      scored.sort((a, b) => b.similarityScore - a.similarityScore);
      return scored.slice(0, 35);
    } catch (e) {
      return [];
    }
  };

  // Fetch candidates from backend or client fallback
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setDisplayedAnime([]);
    setAnimatingIndices(new Set());
    setCountdown(ROTATION_INTERVAL_SEC);
    setRotationPhase(0);

    const loadCandidates = async () => {
      try {
        const token = localStorage.getItem('anime_auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(apiUrl(`/api/anime/${animeId}/similar`), { headers });

        if (res.ok) {
          const data = await res.json();
          const deduped = deduplicateAnimeList(data.items || []);
          if (isMounted && deduped.length > 0) {
            setCandidates(deduped);
            setDisplayedAnime(deduped.slice(0, DISPLAY_COUNT));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend similar fetch error, using fallback:', err);
      }

      // Fallback if backend route fails
      if (isMounted) {
        const fallback = deduplicateAnimeList(getClientFallbackCandidates(currentAnime));
        if (fallback.length > 0) {
          setCandidates(fallback);
          setDisplayedAnime(fallback.slice(0, DISPLAY_COUNT));
        }
        setLoading(false);
      }
    };

    loadCandidates();

    return () => {
      isMounted = false;
    };
  }, [animeId, currentAnime]);

  // Core rotation: swap 5 items in the displayed ribbon
  const rotateFiveItems = () => {
    const all = candidatesRef.current;
    if (!all || all.length <= DISPLAY_COUNT) return;

    setIsRotatingNow(true);

    // Pick 5 slots: alternate even and odd indices
    const indicesToSwap = rotationPhase === 0
      ? [0, 2, 4, 6, 8]
      : [1, 3, 5, 7, 9];

    // Find candidates not currently displayed
    const currentDisplayedIds = displayedIdsRef.current;
    let pool = all.filter((c) => !currentDisplayedIds.has(c.id));

    // If pool has fewer than 5, cycle from the rest of candidates
    if (pool.length < ROTATE_BATCH_SIZE) {
      pool = [...pool, ...all.filter((c) => currentDisplayedIds.has(c.id))];
    }

    const chosenReplacements = pool.slice(0, ROTATE_BATCH_SIZE);

    // Step 1: animate out the 5 slots
    setAnimatingIndices(new Set(indicesToSwap));

    // Step 2: swap items mid-animation
    setTimeout(() => {
      setDisplayedAnime((prev) => {
        const next = [...prev];
        indicesToSwap.forEach((slotIdx, i) => {
          if (chosenReplacements[i] && slotIdx < next.length) {
            next[slotIdx] = chosenReplacements[i];
          }
        });
        return next;
      });

      // Shift the pool in candidates to cycle through all recommendations
      setCandidates((prev) => {
        const replacedIds = new Set(chosenReplacements.map((x) => x.id));
        const rest = prev.filter((x) => !replacedIds.has(x.id));
        return [...rest, ...chosenReplacements];
      });

      setRotationPhase((prev) => (prev === 0 ? 1 : 0));
      setCountdown(ROTATION_INTERVAL_SEC);
    }, 250);

    // Step 3: animate in and finish
    setTimeout(() => {
      setAnimatingIndices(new Set());
      setIsRotatingNow(false);
    }, 550);
  };

  // Timer effect for 10-second automatic rotation
  useEffect(() => {
    if (loading || displayedAnime.length === 0 || candidates.length <= DISPLAY_COUNT) {
      return;
    }

    const timer = setInterval(() => {
      if (isPaused) return; // Pause countdown while user hovers or scrolls

      setCountdown((prev) => {
        if (prev <= 1) {
          rotateFiveItems();
          return ROTATION_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, displayedAnime.length, candidates.length, isPaused, rotationPhase]);

  // Horizontal scroll buttons
  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 380;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!loading && displayedAnime.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-sm space-y-4 border border-neutral-200/40 dark:border-neutral-800/40 relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                Похожее по жанру и описанию
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                10
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Подобрано по общим жанрам и описанию
            </p>
          </div>
        </div>

        {/* Right Controls: Countdown pill, Manual rotate button, Scroll arrows */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {candidates.length > DISPLAY_COUNT && (
            <>
              {/* Countdown Pill */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/50 cursor-help"
                title={isPaused ? 'Пауза: курсор на блоке' : `5 тайтлов сменятся через ${countdown} секунд`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span>
                  {isPaused ? 'Пауза (наведение)' : `5 сменятся через ${countdown}с`}
                </span>
              </div>

              {/* Manual Refresh / Rotate Button */}
              <button
                type="button"
                onClick={rotateFiveItems}
                disabled={isRotatingNow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/40 dark:border-amber-500/30 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Сменить 5 тайтлов сейчас"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 transition-transform ${
                    isRotatingNow ? 'animate-spin' : ''
                  }`}
                />
                <span>Сменить 5</span>
              </button>
            </>
          )}

          {/* Left/Right scroll buttons */}
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              title="Прокрутить назад"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              title="Прокрутить вперед"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feed Tape (Horizontal Ribbon) */}
      {loading ? (
        <div className="flex gap-3.5 overflow-hidden py-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-36 sm:w-44 shrink-0 animate-pulse space-y-2">
              <div className="w-full aspect-[2/3] bg-neutral-200 dark:bg-neutral-800 rounded-2xl" />
              <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded-md w-4/5" />
              <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayedAnime.map((item, index) => {
            const isAnimating = animatingIndices.has(index);
            const hasScore = item.averageScore !== null && item.averageScore !== undefined;
            const primaryGenre =
              (item.matchingGenres && item.matchingGenres[0]) ||
              (item.genres && item.genres[0]) ||
              '';

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => {
                  if (onSelectAnime) {
                    onSelectAnime(item.id);
                  } else {
                    window.location.hash = `#/anime/${item.id}`;
                  }
                }}
                className={`w-36 sm:w-44 shrink-0 group cursor-pointer transition-all duration-300 select-none ${
                  isAnimating
                    ? 'opacity-0 scale-90 -translate-y-2'
                    : 'opacity-100 scale-100 translate-y-0'
                }`}
              >
                {/* Poster Box */}
                <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shadow-xs border border-neutral-200/60 dark:border-neutral-800 group-hover:border-amber-500/50 dark:group-hover:border-amber-400/50 group-hover:shadow-md transition-all duration-300">
                  <img
                    src={getImageUrl(item.imageUrl)}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                  {/* Position number (#1 to #10) */}
                  <div className="absolute top-2 left-2 bg-neutral-950/70 backdrop-blur-xs text-[10px] font-bold text-neutral-300 px-1.5 py-0.5 rounded-md border border-white/10">
                    #{index + 1}
                  </div>

                  {/* Score badge top-right */}
                  {hasScore ? (
                    <div
                      className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs ${getScoreBadgeClass(
                        item.averageScore
                      )}`}
                    >
                      ★ {item.averageScore}
                    </div>
                  ) : item.year ? (
                    <div className="absolute top-2 right-2 bg-neutral-950/70 backdrop-blur-xs text-neutral-300 text-[10px] font-medium px-2 py-0.5 rounded-md border border-white/10">
                      {item.year}
                    </div>
                  ) : null}

                  {/* Bottom overlay info */}
                  <div className="absolute bottom-2 left-2 right-2">
                    {/* Matching genre pill */}
                    {primaryGenre && (
                      <span className="inline-block max-w-full truncate px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-400/95 text-neutral-950 shadow-xs">
                        {primaryGenre}
                      </span>
                    )}

                    {/* User rating if present */}
                    {item.myScore !== null && item.myScore !== undefined && (
                      <div className="mt-1 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <span>Ваша: {item.myScore}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title & Metadata */}
                <div className="mt-2 space-y-0.5">
                  <h3
                    className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-2 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors leading-tight"
                    title={item.title}
                  >
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>{item.year || 'ТВ'}</span>
                    {item.type && (
                      <>
                        <span>•</span>
                        <span className="truncate">{item.type}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
