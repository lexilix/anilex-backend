import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, ChevronDown, ChevronUp, Calendar, Film, Lock, Bookmark, EyeOff } from 'lucide-react';
import { getScoreConfig, getScoreBadgeClass } from '../utils/scoreColors';
import { getImageUrl } from '../api';
import { isAnimeHiddenLocally } from '../utils/hiddenStorage';
import { getCachedUserRatings, getCachedUserProfile, updateCachedUserRating } from '../utils/profileCache';

export default function AnimeCard({
  anime,
  user,
  onRate,
  onGenreClick,
  activeGenres = [],
  onRequireAuth,
  onSelectAnime,
  onToggleFavorite,
  onToggleHide,
  friends = []
}) {
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [showFriendsScores, setShowFriendsScores] = useState(false);
  const currentImage = anime.imageUrl || anime.image_url;
  const [imgSrc, setImgSrc] = useState(currentImage);
  const [imageFailed, setImageFailed] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [hideLoading, setHideLoading] = useState(false);

  useEffect(() => {
    setImgSrc(anime.imageUrl || anime.image_url);
    setImageFailed(false);
  }, [anime.imageUrl, anime.image_url]);

  // Optimistic hidden state synced with anime prop and local storage
  const [localHidden, setLocalHidden] = useState(() => {
    return Boolean(anime.isHidden) || isAnimeHiddenLocally(anime.id, user?.id);
  });

  useEffect(() => {
    setLocalHidden(Boolean(anime.isHidden) || isAnimeHiddenLocally(anime.id, user?.id));
  }, [anime.isHidden, anime.id, user?.id]);

  // Resolve current score with fallback to local cached ratings
  const resolveCurrentScore = () => {
    if (anime.myScore !== null && anime.myScore !== undefined) {
      return Number(anime.myScore);
    }
    const currentUserId = user?.id || getCachedUserProfile()?.id;
    if (!currentUserId) return null;
    const cachedRatings = getCachedUserRatings(currentUserId);
    if (!Array.isArray(cachedRatings) || cachedRatings.length === 0) return null;
    const numId = Number(anime.id);
    const match = cachedRatings.find(
      (r) =>
        Number(r.id) === numId ||
        (Array.isArray(anime.aliasIds) && anime.aliasIds.map(Number).includes(Number(r.id))) ||
        (Array.isArray(r.aliasIds) && r.aliasIds.map(Number).includes(numId)) ||
        (anime.title && r.title && anime.title.trim().toLowerCase() === r.title.trim().toLowerCase()) ||
        ((anime.originalTitle || anime.original_title) && (r.originalTitle || r.original_title) && (anime.originalTitle || anime.original_title).trim().toLowerCase() === (r.originalTitle || r.original_title).trim().toLowerCase())
    );
    return match && match.myScore !== null && match.myScore !== undefined ? Number(match.myScore) : null;
  };

  // Optimistic local rating state synced with anime prop and profile cache
  const [localScore, setLocalScore] = useState(resolveCurrentScore);

  useEffect(() => {
    setLocalScore(resolveCurrentScore());
  }, [anime.myScore, anime.id, anime.title, user?.id]);

  // Live listener for real-time rating sync across main page, search, and profile
  useEffect(() => {
    const handleRatingUpdated = (e) => {
      const { animeId, score, anime: updatedAnime } = e.detail || {};
      if (animeId === undefined && !updatedAnime?.id) return;
      const numId = Number(animeId !== undefined ? animeId : updatedAnime?.id);
      const isMatch =
        Number(anime.id) === numId ||
        (Array.isArray(anime.aliasIds) && anime.aliasIds.map(Number).includes(numId)) ||
        (updatedAnime?.aliasIds && Array.isArray(updatedAnime.aliasIds) && updatedAnime.aliasIds.map(Number).includes(Number(anime.id))) ||
        (updatedAnime?.title && anime.title && anime.title.trim().toLowerCase() === updatedAnime.title.trim().toLowerCase());
      if (isMatch) {
        setLocalScore(score !== null && score !== undefined ? Number(score) : null);
      }
    };
    window.addEventListener('anilex:rating-updated', handleRatingUpdated);
    return () => window.removeEventListener('anilex:rating-updated', handleRatingUpdated);
  }, [anime.id, anime.aliasIds, anime.title]);

  // User's rating and community stats
  const myScore = localScore !== undefined && localScore !== null ? localScore : (anime.myScore !== undefined && anime.myScore !== null ? anime.myScore : null);
  const isFavorite = anime.isFavorite;
  const isHidden = localHidden;
  const averageScore = anime.averageScore;
  const ratingCount = anime.ratingCount || 0;
  const friendsRatings = anime.friendsRatings || [];
  const commentsCount = anime.commentsCount || 0;

  const handleImageError = () => {
    const raw = anime.imageUrl || anime.image_url;
    if (imgSrc === raw && raw) {
      setImgSrc(getImageUrl(raw));
    } else {
      setImageFailed(true);
    }
  };

  const handleFavoriteClick = async (e) => {
    e.stopPropagation();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (onToggleFavorite) {
      setFavLoading(true);
      try {
        await onToggleFavorite(anime.id);
      } finally {
        setFavLoading(false);
      }
    }
  };

  const handleHideClick = async (e) => {
    e.stopPropagation();
    if (!user) {
      onRequireAuth();
      return;
    }
    const nextState = !localHidden;
    setLocalHidden(nextState);

    if (onToggleHide) {
      setHideLoading(true);
      try {
        await onToggleHide(anime.id, nextState);
      } catch (err) {
        console.error('Hide toggle error:', err);
      } finally {
        setHideLoading(false);
      }
    }
  };

  const handleScoreClick = async (e, score) => {
    e.stopPropagation();
    if (!user) {
      onRequireAuth();
      return;
    }

    const currentUserId = user?.id || getCachedUserProfile()?.id;
    const newScore = myScore === score ? null : score;
    setLocalScore(newScore);

    // Optimistically update localStorage cache immediately
    if (currentUserId) {
      updateCachedUserRating(currentUserId, anime.id, newScore, anime);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('anilex:rating-updated', {
          detail: { animeId: Number(anime.id), score: newScore, anime }
        })
      );
    }

    setRatingLoading(true);
    try {
      if (onRate) {
        await onRate(anime.id, newScore, anime);
      }
    } catch (err) {
      console.warn('Rating error:', err);
    } finally {
      setRatingLoading(false);
    }
  };

  return (
    <article
      className={`rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6 transition-all duration-200 relative ${
        isHidden
          ? 'bg-neutral-200/50 dark:bg-[#0c0c0e]/95 opacity-40 hover:opacity-75 grayscale contrast-75 border border-rose-500/25 shadow-none'
          : 'bg-white dark:bg-[#151518]'
      }`}
    >
      
      {/* 1. КАРТИНКА ТАЙТЛА (СЛЕВА) */}
      <div
        className="shrink-0 w-28 sm:w-36 self-start cursor-pointer group"
        onClick={() => onSelectAnime && onSelectAnime(anime.id)}
      >
        <div className="relative aspect-[5/7] w-full rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          {!imageFailed && imgSrc ? (
            <img
              src={imgSrc}
              alt={anime.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={handleImageError}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-neutral-200 dark:bg-neutral-800 text-neutral-400">
              <Film className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-[10px] font-medium leading-tight line-clamp-2">
                {anime.title}
              </span>
            </div>
          )}

          {/* Average Rating Badge (Visible only to authenticated users with friends) */}
          {user && friends.length > 0 && averageScore !== null && ratingCount > 0 && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-xl bg-neutral-900/85 dark:bg-neutral-100/90 backdrop-blur-md text-white dark:text-neutral-900 text-[11px] font-bold flex items-center gap-1 shadow-sm">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{averageScore}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2, 3, 4. КОНТЕНТ (СПРАВА) */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          {/* Metadata row (Type & Year) + Favorite Button in top right */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400 flex-wrap">
              {anime.type && (
                <span className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {anime.type}
                </span>
              )}
              {anime.year && (
                <span className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                  <Calendar className="w-3 h-3 opacity-60" />
                  {anime.year}
                </span>
              )}
              {commentsCount > 0 && (
                <span
                  onClick={() => onSelectAnime && onSelectAnime(anime.id)}
                  className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <MessageSquare className="w-3 h-3 opacity-60" />
                  <span>{commentsCount}</span>
                </span>
              )}
              {isHidden && (
                <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[10px] flex items-center gap-1 border border-rose-500/25 shrink-0 animate-in fade-in">
                  <EyeOff className="w-3 h-3 stroke-[2.5]" />
                  <span>Не интересует</span>
                </span>
              )}
            </div>

            {/* Action Buttons: Hide ("Не интересует") & Favorite */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleHideClick}
                disabled={hideLoading}
                title={isHidden ? 'Скрыто ("Не интересует") — нажать, чтобы вернуть' : 'Не интересует (скрыть с главной)'}
                className={`p-1.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                  isHidden
                    ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30 ring-2 ring-rose-500/20'
                    : 'text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`}
              >
                <EyeOff className={`w-4 h-4 ${isHidden ? 'stroke-[2.5]' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleFavoriteClick}
                disabled={favLoading}
                title={isFavorite ? 'В избранном' : 'Добавить в избранное'}
                className={`p-1.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                  isFavorite
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* 2. НАЗВАНИЕ ТАЙТЛА - СПРАВА ЗАГОЛОВОК */}
          <h2
            onClick={() => onSelectAnime && onSelectAnime(anime.id)}
            className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white title-balance leading-snug cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors inline-block"
          >
            {anime.title}
          </h2>

          {anime.originalTitle && (
            <p className="text-xs text-neutral-400 font-normal mt-0.5 truncate">
              {anime.originalTitle}
            </p>
          )}

          {/* 3. ЖАНР (ЖАНРЫ) ПОД ЗАГОЛОВКОМ КЛИКАБЕЛЬНЫЙ */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 mb-3">
              {anime.genres.map((genre) => {
                const isActive = activeGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenreClick && onGenreClick(genre);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          )}

          {/* 4. ОПИСАНИЕ ОТ ТАЙТЛА ЕЩЕ НИЖЕ ЖАНРОВ */}
          {anime.description && (
            <div className="mt-1">
              <p
                className={`text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed text-pretty ${
                  !expandedDesc ? 'line-clamp-3' : ''
                }`}
              >
                {anime.description}
              </p>
              {anime.description.length > 180 && (
                <button
                  type="button"
                  onClick={() => setExpandedDesc(!expandedDesc)}
                  className="mt-1 text-xs font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1 transition-colors"
                >
                  {expandedDesc ? (
                    <>
                      <span>Свернуть</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Читать далее</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ШКАЛА ОЦЕНИВАНИЯ 0..10 И РЕЙТИНГ ДРУЗЕЙ */}
        <div className="mt-5 pt-4 bg-neutral-50/70 dark:bg-neutral-900/50 rounded-2xl p-3.5 sm:p-4">
          
          {/* Header of rating section */}
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Ваша оценка (0–10):
              </span>
              {user ? (
                myScore !== null && myScore !== undefined ? (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getScoreBadgeClass(myScore)}`}>
                    {myScore} / 10
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400 font-medium">тут будут ваши оценки</span>
                )
              ) : (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline decoration-dotted transition-colors"
                >
                  тут будут ваши оценки
                </button>
              )}
            </div>

            {/* Community stats: visible to users with friends or account Just */}
            <div className="flex items-center gap-3">
              {user && (friends.length > 0 || user.nickname === 'Just' || user.id === 5 || user.email === 'just9jeeet@gmail.com') ? (
                averageScore !== null && ratingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowFriendsScores(!showFriendsScores)}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-bold">{averageScore}</span>
                    <span className="text-neutral-400">({ratingCount} {ratingCount === 1 ? 'оценка' : 'оценок'})</span>
                    <span className="text-[10px] text-neutral-400">▼</span>
                  </button>
                ) : (
                  <span className="text-xs text-neutral-400 font-medium">
                    {user.nickname === 'Just' || user.id === 5 ? 'Нет оценок' : 'Нет оценок друзей'}
                  </span>
                )
              ) : null}
            </div>
          </div>

          {/* 0 to 10 Scale Buttons with custom color shades */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
              const isSelected = user && myScore === score;
              return (
                <button
                  key={score}
                  type="button"
                  disabled={ratingLoading}
                  onClick={(e) => handleScoreClick(e, score)}
                  title={user ? `Поставить оценку ${score}` : 'Войдите, чтобы поставить оценку'}
                  className={`flex-1 min-w-[24px] sm:min-w-[28px] h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                    isSelected
                      ? `${getScoreBadgeClass(score)} font-bold scale-105 shadow-sm`
                      : user
                      ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                      : 'bg-neutral-200/50 dark:bg-neutral-800/40 text-neutral-400 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {score}
                </button>
              );
            })}

            {/* Clear rating button */}
            {user && myScore !== null && (
              <button
                type="button"
                onClick={(e) => handleScoreClick(e, myScore)}
                title="Сбросить оценку"
                className="px-2 h-8 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          {/* Friends Scores Details */}
          {showFriendsScores && friendsRatings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-transparent text-xs animate-in fade-in duration-100">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2">
                Оценки пользователей сайта:
              </p>
              <div className="flex flex-wrap gap-2">
                {friendsRatings.map((f, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 flex items-center gap-2 shadow-sm"
                  >
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {f.nickname}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${getScoreBadgeClass(f.score)}`}>
                      {f.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
