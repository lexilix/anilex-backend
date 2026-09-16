import React, { useState } from 'react';
import { Star, MessageSquare, ChevronDown, ChevronUp, Calendar, Film, Lock, Bookmark } from 'lucide-react';
import { getScoreConfig, getScoreBadgeClass } from '../utils/scoreColors';
import { getImageUrl } from '../api';

export default function AnimeCard({
  anime,
  user,
  onRate,
  onGenreClick,
  activeGenres = [],
  onRequireAuth,
  onSelectAnime,
  onToggleFavorite
}) {
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [showFriendsScores, setShowFriendsScores] = useState(false);
  const [imgSrc, setImgSrc] = useState(anime.imageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // User's rating and community stats
  const myScore = anime.myScore;
  const isFavorite = anime.isFavorite;
  const averageScore = anime.averageScore;
  const ratingCount = anime.ratingCount || 0;
  const friendsRatings = anime.friendsRatings || [];
  const commentsCount = anime.commentsCount || 0;

  const handleImageError = () => {
    if (imgSrc === anime.imageUrl && anime.imageUrl) {
      setImgSrc(getImageUrl(anime.imageUrl));
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

  const handleScoreClick = async (e, score) => {
    e.stopPropagation();
    if (!user) {
      onRequireAuth();
      return;
    }

    setRatingLoading(true);
    try {
      const newScore = myScore === score ? null : score;
      await onRate(anime.id, newScore);
    } finally {
      setRatingLoading(false);
    }
  };

  return (
    <article className="rounded-3xl bg-white dark:bg-[#151518] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6 transition-all">
      
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

          {/* Average Rating Badge (Only if real users rated!) */}
          {averageScore !== null && ratingCount > 0 && (
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
            </div>

            {/* Favorite Button (top right corner as circled in photo) */}
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
                myScore !== null ? (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getScoreBadgeClass(myScore)}`}>
                    {myScore} / 10
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">не оценено</span>
                )
              ) : (
                <button
                  onClick={onRequireAuth}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline decoration-dotted"
                >
                  войдите для оценки
                </button>
              )}
            </div>

            {/* Community stats */}
            <div className="flex items-center gap-3">
              {averageScore !== null && ratingCount > 0 ? (
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
                <span className="text-xs text-neutral-400 font-medium">Нет оценок</span>
              )}
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
