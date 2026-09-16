import React, { useState, useEffect, useRef } from 'react';
import { getScoreBadgeClass } from '../utils/scoreColors';
import { apiUrl, getImageUrl } from '../api';

export default function FeaturedCarousel({
  onSelectAnime,
  user,
  token,
  friends = [],
  onRequireAuth
}) {
  const [activeTab, setActiveTab] = useState('top'); // 'top' | 'my' | 'newest'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (activeTab === 'my') {
      if (!user || !token) {
        setItems([]);
        setLoading(false);
        return;
      }

      fetch(apiUrl('/api/user/rated-anime?sort=my_score_desc&limit=15'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (isMounted) {
            setItems(data.items || []);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Error fetching my rated anime for carousel:', err);
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(apiUrl(`/api/anime/featured?tab=${activeTab}&limit=15`), { headers })
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setItems(data.items || []);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error fetching featured anime:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, user, token]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="mb-8 bg-neutral-900 rounded-2xl p-5">
      {/* Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-neutral-950 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('top')}
              className={`px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'top'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ★ Топ по оценкам
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'my'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ★ Мои оценки
            </button>
            <button
              onClick={() => setActiveTab('newest')}
              className={`px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'newest'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ✦ Новинки
            </button>
          </div>
        </div>

        {/* Scroll Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center text-sm transition-colors"
            title="Назад"
          >
            ←
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center text-sm transition-colors"
            title="Вперед"
          >
            →
          </button>
        </div>
      </div>

      {/* Carousel Items */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden py-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-36 sm:w-40 animate-pulse">
              <div className="w-full aspect-[2/3] bg-neutral-800 rounded-xl mb-2.5" />
              <div className="h-4 bg-neutral-800 rounded w-3/4 mb-1.5" />
              <div className="h-3 bg-neutral-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-neutral-400 text-xs sm:text-sm">
          {activeTab === 'my' ? (
            !user ? (
              <div className="space-y-2 py-2">
                <p className="font-semibold text-neutral-300">Тут будут ваши оценки</p>
                <p className="text-xs text-neutral-500">Войдите в профиль и оцените аниме, чтобы сформировать свою коллекцию</p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-2 px-4 py-1.5 rounded-xl bg-neutral-100 text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Войти в профиль
                </button>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                <p className="font-semibold text-neutral-300">Тут будут ваши оценки</p>
                <p className="text-xs text-neutral-500">Вы пока не поставили ни одной оценки. Оцените тайтлы в каталоге ниже!</p>
              </div>
            )
          ) : activeTab === 'top' ? (
            'Пока нет оценённых тайтлов. Поставьте оценку любому аниме, чтобы сформировать топ!'
          ) : (
            'Нет данных для отображения'
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((anime, index) => {
            const hasScore = anime.averageScore !== null && anime.averageScore !== undefined;
            return (
              <div
                key={anime.id}
                onClick={() => onSelectAnime ? onSelectAnime(anime.id) : (window.location.hash = `#/anime/${anime.id}`)}
                className="flex-shrink-0 w-36 sm:w-40 group cursor-pointer"
              >
                {/* Poster */}
                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-neutral-800 mb-2 transition-transform duration-200 group-hover:scale-[1.02]">
                  <img
                    src={getImageUrl(anime.imageUrl)}
                    alt={anime.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />

                  {/* Rank badge for Top tab */}
                  {activeTab === 'top' && (
                    <div className="absolute top-2 left-2 bg-neutral-950/80 backdrop-blur-sm text-neutral-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      #{index + 1}
                    </div>
                  )}

                  {/* Score badge */}
                  {activeTab === 'my' ? (
                    (anime.myScore !== null && anime.myScore !== undefined) || (anime.score !== null && anime.score !== undefined) ? (
                      <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-md ${getScoreBadgeClass(anime.myScore || anime.score)}`}>
                        ★ {anime.myScore || anime.score}
                      </div>
                    ) : null
                  ) : activeTab === 'top' && user && friends.length > 0 && hasScore ? (
                    <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-md ${getScoreBadgeClass(anime.averageScore)}`}>
                      ★ {anime.averageScore}
                    </div>
                  ) : anime.year ? (
                    <div className="absolute top-2 right-2 bg-neutral-950/80 text-neutral-400 text-[10px] font-medium px-2 py-0.5 rounded-md">
                      {anime.year}
                    </div>
                  ) : null}
                </div>

                {/* Title and metadata */}
                <h3 className="text-xs font-semibold text-neutral-200 line-clamp-1 group-hover:text-white transition-colors" title={anime.title}>
                  {anime.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
                  <span>{anime.year || 'ТВ'}</span>
                  {anime.genres && anime.genres[0] && (
                    <>
                      <span>•</span>
                      <span className="truncate">{anime.genres[0]}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
