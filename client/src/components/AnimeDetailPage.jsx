import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, MessageSquare, Send, Trash2, Calendar, Film, User, Bookmark, EyeOff, ThumbsUp, ThumbsDown, CornerDownRight, Lock } from 'lucide-react';
import { getScoreConfig, getScoreBadgeClass } from '../utils/scoreColors';
import { apiUrl, getImageUrl } from '../api';

export default function AnimeDetailPage({
  animeId,
  user,
  onBack,
  onGenreClick,
  onRequireAuth,
  onSelectAnime
}) {
  const [anime, setAnime] = useState(null);
  const [comments, setComments] = useState([]);
  const [relatedAnime, setRelatedAnime] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hideLoading, setHideLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  // Fetch related continuations and franchise titles
  const fetchRelatedAnime = async () => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/anime/${animeId}/related`), { headers });
      if (res.ok) {
        const data = await res.json();
        setRelatedAnime(data.items || []);
      }
    } catch (err) {
      console.error('Error loading related anime:', err);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/anime/${animeId}/favorite`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnime((prev) => ({ ...prev, isFavorite: data.isFavorite }));
      }
    } catch (err) {
      console.error('Toggle favorite error:', err);
    }
  };

  const handleToggleHide = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setHideLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/anime/${animeId}/hide`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnime((prev) => ({ ...prev, isHidden: data.isHidden }));
      }
    } catch (err) {
      console.error('Toggle hide error:', err);
    } finally {
      setHideLoading(false);
    }
  };

  // Fetch anime details
  const fetchAnimeDetails = async () => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/anime/${animeId}`), { headers });
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setAnime(data);
      setImgSrc(data.imageUrl);
    } catch (err) {
      console.error('Error loading anime details:', err);
    } finally {
      setLoading(false);
    }
  };

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // Fetch comments
  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/anime/${animeId}/comments`), { headers });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  useEffect(() => {
    fetchAnimeDetails();
    fetchComments();
    fetchRelatedAnime();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [animeId]);

  const handleImageError = () => {
    if (anime && imgSrc === anime.imageUrl && anime.imageUrl) {
      setImgSrc(getImageUrl(anime.imageUrl));
    } else {
      setImageFailed(true);
    }
  };

  const handleRate = async (score) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    setRatingLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const newScore = anime.myScore === score ? null : score;
      const res = await fetch(apiUrl(`/api/anime/${animeId}/rate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ score: newScore })
      });

      if (res.ok) {
        const data = await res.json();
        setAnime((prev) => ({
          ...prev,
          myScore: data.myScore,
          averageScore: data.averageScore,
          ratingCount: data.ratingCount,
          friendsRatings: data.friendsRatings
        }));
      }
    } finally {
      setRatingLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!newComment.trim()) return;

    setCommentLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/anime/${animeId}/comments`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReply = async (e, parentId) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!replyText.trim()) return;

    setReplyLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/anime/${animeId}/comments`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: replyText.trim(), parentId })
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: [...(c.replies || []), data.comment]
              };
            }
            return c;
          })
        );
        setReplyText('');
        setReplyingToId(null);
      }
    } catch (err) {
      console.error('Error adding reply:', err);
    } finally {
      setReplyLoading(false);
    }
  };

  const handleReact = async (commentId, type) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/comments/${commentId}/react`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                userReaction: data.userReaction,
                likesCount: data.likesCount,
                dislikesCount: data.dislikesCount
              };
            }
            // Check in replies
            if (c.replies && c.replies.length > 0) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId
                    ? {
                        ...r,
                        userReaction: data.userReaction,
                        likesCount: data.likesCount,
                        dislikesCount: data.dislikesCount
                      }
                    : r
                )
              };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error('Error reacting to comment:', err);
    }
  };

  const handleDeleteComment = async (commentId, parentId = null) => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/comments/${commentId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        if (parentId) {
          setComments((prev) =>
            prev.map((c) => {
              if (c.id === parentId) {
                return {
                  ...c,
                  replies: (c.replies || []).filter((r) => r.id !== commentId)
                };
              }
              return c;
            })
          );
        } else {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
        }
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-neutral-400">
        <p className="text-sm">Загрузка информации о тайтле...</p>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="py-24 text-center">
        <p className="text-base font-bold text-neutral-900 dark:text-white">Тайтл не найден</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold"
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-150">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#151518] text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад в каталог</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Hide / "Не интересует" button */}
          <button
            onClick={handleToggleHide}
            disabled={hideLoading}
            title={anime.isHidden ? 'Скрыто из каталога ("Не интересует")' : 'Не интересует (скрыть из каталога)'}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all shadow-sm ${
              anime.isHidden
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'
                : 'bg-white dark:bg-[#151518] text-neutral-600 dark:text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            <EyeOff className={`w-4 h-4 ${anime.isHidden ? 'stroke-[2.5]' : ''}`} />
            <span>{anime.isHidden ? 'Не интересует (скрыто)' : 'Не интересует'}</span>
          </button>

          <button
            onClick={handleToggleFavorite}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-colors shadow-sm ${
              anime.isFavorite
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-white dark:bg-[#151518] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${anime.isFavorite ? 'fill-current' : ''}`} />
            <span>{anime.isFavorite ? 'В избранном' : 'В избранное'}</span>
          </button>
        </div>
      </div>

      {/* Main Anime Detail Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-sm flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* Poster */}
        <div className="shrink-0 w-full sm:w-64 md:w-72 self-start">
          <div className="relative aspect-[5/7] w-full rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            {!imageFailed && imgSrc ? (
              <img
                src={imgSrc}
                alt={anime.title}
                referrerPolicy="no-referrer"
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-neutral-200 dark:bg-neutral-800 text-neutral-400">
                <Film className="w-12 h-12 mb-2 opacity-50" />
                <span className="text-xs font-medium">{anime.title}</span>
              </div>
            )}

            {/* Average Rating Badge */}
            {anime.averageScore !== null && anime.ratingCount > 0 && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-2xl bg-neutral-900/90 dark:bg-neutral-100/95 backdrop-blur-md text-white dark:text-neutral-900 text-sm font-bold flex items-center gap-1.5 shadow-md">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{anime.averageScore} / 10</span>
              </div>
            )}
          </div>
        </div>

        {/* Info & Rating */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            {/* Meta */}
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 mb-2">
              {anime.type && (
                <span className="px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {anime.type}
                </span>
              )}
              {anime.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 opacity-60" />
                  {anime.year}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight">
              {anime.title}
            </h1>
            {anime.originalTitle && (
              <p className="text-sm text-neutral-400 font-normal mt-1">
                {anime.originalTitle}
              </p>
            )}

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {anime.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      onGenreClick && onGenreClick(genre);
                      onBack();
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}

            {/* Full Description */}
            <div className="mt-6 pt-6 border-t border-transparent">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Описание
              </h3>
              <p className="text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line text-pretty">
                {anime.description || 'Описание отсутствует.'}
              </p>
            </div>
          </div>

          {/* Rating Section (0..10) */}
          <div className="mt-8 p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Ваша оценка:
                </span>
                {anime.myScore !== null ? (
                  <span className={`px-2.5 py-0.5 rounded-xl text-xs font-bold ${getScoreBadgeClass(anime.myScore)}`}>
                    {anime.myScore} / 10
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">не оценено</span>
                )}
              </div>

              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {anime.averageScore !== null && anime.ratingCount > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-neutral-800 dark:text-neutral-200">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {anime.averageScore} / 10 ({anime.ratingCount} {anime.ratingCount === 1 ? 'оценка' : 'оценок'})
                  </span>
                ) : (
                  <span>Нет оценок пользователей</span>
                )}
              </div>
            </div>

            {/* Buttons 0 to 10 with custom colors */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                const isSelected = anime.myScore === score;
                return (
                  <button
                    key={score}
                    type="button"
                    disabled={ratingLoading}
                    onClick={() => handleRate(score)}
                    className={`flex-1 min-w-[28px] h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                      isSelected
                        ? `${getScoreBadgeClass(score)} font-bold scale-105 shadow-sm`
                        : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {score}
                  </button>
                );
              })}

              {anime.myScore !== null && (
                <button
                  type="button"
                  onClick={() => handleRate(anime.myScore)}
                  title="Сбросить оценку"
                  className="px-2.5 h-9 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Friends ratings list (Strictly confirmed friends only) */}
            {!user ? (
              <div className="mt-4 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>Оценки пользователей видны только взаимным друзьям</span>
                </div>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline shrink-0"
                >
                  Войти
                </button>
              </div>
            ) : anime.friendsRatings && anime.friendsRatings.length > 0 ? (
              <div className="mt-4 pt-3 border-t border-transparent">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Оценки друзей:
                </p>
                <div className="flex flex-wrap gap-2">
                  {anime.friendsRatings.map((f, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 text-xs flex items-center gap-2 shadow-sm"
                    >
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {f.nickname}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${getScoreBadgeClass(f.score)}`}>
                        {f.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-3 border-t border-neutral-200/40 dark:border-neutral-800/40 text-xs text-neutral-400">
                <span>Никто из ваших друзей пока не оценил этот тайтл.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Continuations & Seasons Section */}
      {relatedAnime.length > 1 && (
        <div className="rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Film className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                Связанное и продолжения ({relatedAnime.length})
              </h2>
            </div>
            <span className="text-xs text-neutral-400">
              Хронология франшизы
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {relatedAnime.map((item) => {
              const isCurrent = item.id === anime.id;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!isCurrent && onSelectAnime) {
                      onSelectAnime(item.id);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-center gap-3.5 ${
                    isCurrent
                      ? 'bg-neutral-50 dark:bg-neutral-900/90 border-amber-400/50 ring-1 ring-amber-400/30 shadow-xs cursor-default'
                      : 'bg-white dark:bg-[#18181b] border-neutral-200/70 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-16 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 relative">
                    <img
                      src={getImageUrl(item.imageUrl)}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                      }`}>
                        {item.relation}
                      </span>
                      {item.year && (
                        <span className="text-[11px] text-neutral-400">
                          {item.year}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate mt-1">
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                      {item.averageScore !== null ? (
                        <span className="flex items-center gap-0.5 font-semibold text-neutral-700 dark:text-neutral-300">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {item.averageScore}
                        </span>
                      ) : (
                        <span>Без оценок</span>
                      )}
                      {item.myScore !== null && (
                        <span className="text-emerald-500 font-medium">
                          • Ваша: {item.myScore}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div id="comments-section" className="rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-neutral-500" />
            <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              Комментарии ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
            </h2>
          </div>
        </div>

        {!user ? (
          <div className="py-10 px-4 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 space-y-3">
            <Lock className="w-8 h-8 mx-auto text-neutral-400" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Комментарии и аккаунты участников клуба скрыты
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Зарегистрируйтесь и добавляйте участников в друзья, чтобы просматривать обсуждения и делиться мнением.
            </p>
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Войти или зарегистрироваться
            </button>
          </div>
        ) : (
          <>
            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Поделитесь вашим мнением об этом аниме..."
                className="w-full p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:bg-neutral-200/70 dark:focus:bg-neutral-700/60 transition-colors resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={commentLoading || !newComment.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{commentLoading ? 'Отправка...' : 'Отправить комментарий'}</span>
                </button>
              </div>
            </form>

        {/* Comments List */}
        <div className="space-y-4 pt-2">
          {comments.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-xs">
              Комментариев пока нет. Будьте первым, кто поделится отзывом!
            </div>
          ) : (
            comments.map((comment) => {
              const isAuthor = user && user.id === comment.user.id;
              const dateStr = new Date(comment.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  id={`comment-${comment.id}`}
                  key={comment.id}
                  className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 space-y-3 transition-all duration-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold flex items-center justify-center shrink-0">
                        {comment.user.nickname ? comment.user.nickname.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">
                            {comment.user.nickname}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 mt-1.5 leading-relaxed whitespace-pre-line text-pretty">
                          {comment.content}
                        </p>

                        {/* Comment Reactions & Reply action */}
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            type="button"
                            onClick={() => handleReact(comment.id, 'like')}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                              comment.userReaction === 'like'
                                ? 'text-blue-500 bg-blue-500/10 font-bold'
                                : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800'
                            }`}
                            title="Нравится"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{comment.likesCount || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReact(comment.id, 'dislike')}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                              comment.userReaction === 'dislike'
                                ? 'text-red-500 bg-red-500/10 font-bold'
                                : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800'
                            }`}
                            title="Не нравится"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            <span>{comment.dislikesCount || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!user) {
                                onRequireAuth();
                                return;
                              }
                              setReplyingToId(replyingToId === comment.id ? null : comment.id);
                              setReplyText('');
                            }}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                              replyingToId === comment.id
                                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                                : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800'
                            }`}
                          >
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>Ответить</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {isAuthor && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        title="Удалить свой комментарий"
                        className="text-neutral-400 hover:text-red-500 transition-colors p-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Inline Reply Box */}
                  {replyingToId === comment.id && (
                    <form
                      onSubmit={(e) => handleReply(e, comment.id)}
                      className="mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-800 space-y-2.5 pl-2 sm:pl-11"
                    >
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Ответ пользователю ${comment.user.nickname}...`}
                        className="w-full p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:bg-neutral-200/70 dark:focus:bg-neutral-700/60 transition-colors resize-none"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(null);
                            setReplyText('');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          disabled={replyLoading || !replyText.trim()}
                          className="px-4 py-1.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          {replyLoading ? 'Отправка...' : 'Ответить'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Nested Replies Mini-Thread */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-800/80 space-y-2.5 pl-3 sm:pl-10">
                      {comment.replies.map((reply) => {
                        const isReplyAuthor = user && user.id === reply.user.id;
                        const replyDateStr = new Date(reply.createdAt).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            id={`comment-${reply.id}`}
                            key={reply.id}
                            className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 flex items-start justify-between gap-3 transition-all duration-500"
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {reply.user.nickname ? reply.user.nickname.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                                    {reply.user.nickname}
                                  </span>
                                  <span className="text-[10px] text-neutral-400">
                                    {replyDateStr}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed whitespace-pre-line text-pretty">
                                  {reply.content}
                                </p>

                                {/* Reply Reaction Buttons */}
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleReact(reply.id, 'like')}
                                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                                      reply.userReaction === 'like'
                                        ? 'text-blue-500 bg-blue-500/10 font-bold'
                                        : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                                    }`}
                                  >
                                    <ThumbsUp className="w-3 h-3" />
                                    <span>{reply.likesCount || 0}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleReact(reply.id, 'dislike')}
                                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                                      reply.userReaction === 'dislike'
                                        ? 'text-red-500 bg-red-500/10 font-bold'
                                        : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                                    }`}
                                  >
                                    <ThumbsDown className="w-3 h-3" />
                                    <span>{reply.dislikesCount || 0}</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isReplyAuthor && (
                              <button
                                onClick={() => handleDeleteComment(reply.id, comment.id)}
                                title="Удалить ответ"
                                className="text-neutral-400 hover:text-red-500 transition-colors p-1 shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
