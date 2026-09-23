import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, MessageSquare, Send, Trash2, Calendar, Film, User, Bookmark, EyeOff, ThumbsUp, ThumbsDown, CornerDownRight, Lock } from 'lucide-react';
import { getScoreConfig, getScoreBadgeClass } from '../utils/scoreColors';
import { apiUrl, getImageUrl } from '../api';
import SimilarAnimeFeed from './SimilarAnimeFeed';
import { deduplicateAnimeList } from '../utils/animeDeduplicator';
import { applyCustomAnimeEdits, getCustomAnimeEdits } from '../utils/customEditsStorage';
import { getAllCachedAnime } from '../utils/catalogCache';
import { getCachedUserRatings, getCachedUserProfile, updateCachedUserRating } from '../utils/profileCache';

export default function AnimeDetailPage({
  animeId,
  user,
  onBack,
  onGenreClick,
  onRequireAuth,
  onSelectAnime,
  onRateAnime
}) {
  const [anime, setAnime] = useState(() => {
    try {
      const edits = getCustomAnimeEdits();
      return edits[Number(animeId)] || null;
    } catch (e) {
      return null;
    }
  });
  const [comments, setComments] = useState([]);
  const [relatedAnime, setRelatedAnime] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(!anime);
  const [commentLoading, setCommentLoading] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hideLoading, setHideLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState(() => {
    try {
      const edits = getCustomAnimeEdits();
      const custom = edits[Number(animeId)];
      return custom ? (custom.imageUrl || custom.image_url || '') : '';
    } catch (e) {
      return '';
    }
  });
  const [imageFailed, setImageFailed] = useState(false);

  // Top-5 state (max 5 allowed - Photo 1 & 2)
  const [myTop5Ids, setMyTop5Ids] = useState(() => {
    try {
      const saved = localStorage.getItem('anilex_top5_' + user?.id);
      let list = saved ? JSON.parse(saved) : [];
      if (user?.nickname === 'MrTech' || user?.id === 20) {
        if (!list.includes(7170)) list.unshift(7170);
      }
      if (user?.nickname === 'Venicek' || user?.id === 21) {
        list = list.filter((id) => id !== 7170);
      }
      return list.slice(0, 5);
    } catch (e) {
      return (user?.nickname === 'MrTech' || user?.id === 20) ? [7170] : [];
    }
  });
  const [top5Toast, setTop5Toast] = useState(null);

  // Live listener for real-time rating updates
  useEffect(() => {
    const handleRatingUpdated = (e) => {
      const { animeId: evAnimeId, score, anime: updatedAnime } = e.detail || {};
      if (evAnimeId === undefined && !updatedAnime?.id) return;
      const numId = Number(evAnimeId !== undefined ? evAnimeId : updatedAnime?.id);
      const isMatch =
        Number(animeId) === numId ||
        (anime && Number(anime.id) === numId) ||
        (anime?.aliasIds && anime.aliasIds.map(Number).includes(numId)) ||
        (updatedAnime?.title && anime?.title && anime.title.trim().toLowerCase() === updatedAnime.title.trim().toLowerCase());
      if (isMatch) {
        setAnime((prev) => (prev ? { ...prev, myScore: score !== null && score !== undefined ? Number(score) : null } : prev));
      }
    };
    window.addEventListener('anilex:rating-updated', handleRatingUpdated);
    return () => window.removeEventListener('anilex:rating-updated', handleRatingUpdated);
  }, [animeId, anime?.title, anime?.aliasIds]);

  const handleToggleTop5 = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const aId = anime?.id || animeId;
    const isMrTech = user?.nickname === 'MrTech' || user?.id === 20;

    if (isMrTech && (aId === 7170 || anime?.title === 'Лимонные девочки')) {
      setTop5Toast('Этот тайтл закреплен навсегда и его нельзя снять');
      setTimeout(() => setTop5Toast(null), 3000);
      return;
    }

    const isAlreadyIn = myTop5Ids.includes(aId);
    if (isAlreadyIn) {
      const updated = myTop5Ids.filter((id) => id !== aId);
      setMyTop5Ids(updated);
      localStorage.setItem('anilex_top5_' + user.id, JSON.stringify(updated));
      setTop5Toast(`«${anime?.title || 'Тайтл'}» убран из Топ-5`);
      setTimeout(() => setTop5Toast(null), 2500);

      try {
        const token = localStorage.getItem('anime_auth_token');
        if (token) {
          fetch(apiUrl('/api/user/top5/toggle'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ animeId: aId })
          }).catch(() => {});
        }
      } catch (err) {}
    } else {
      if (myTop5Ids.length >= 5) {
        setTop5Toast('В Топ-5 можно добавить только 5 аниме, больше нельзя!');
        setTimeout(() => setTop5Toast(null), 3000);
        return;
      }
      const updated = [...myTop5Ids, aId];
      setMyTop5Ids(updated);
      localStorage.setItem('anilex_top5_' + user.id, JSON.stringify(updated));
      setTop5Toast(`«${anime?.title || 'Тайтл'}» добавлен в Топ-5 (${updated.length}/5)`);
      setTimeout(() => setTop5Toast(null), 2500);

      try {
        const token = localStorage.getItem('anime_auth_token');
        if (token) {
          fetch(apiUrl('/api/user/top5/toggle'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ animeId: aId })
          }).catch(() => {});
        }
      } catch (err) {}
    }
  };

  // Fetch related continuations and franchise titles
  const fetchRelatedAnime = async () => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/anime/${animeId}/related`), { headers });
      if (res.ok) {
        const data = await res.json();
        let items = data.items || [];

        // 1. Filter out placeholder junk, blue boxes, and commercial Snickers ads
        items = items.filter((it) => {
          const img = (it.imageUrl || '').toLowerCase();
          const t = (it.title || '').toLowerCase();
          const orig = (it.originalTitle || '').toLowerCase();
          if (img.includes('placehold.co') || img.includes('placeholder')) return false;
          if (t.includes('сникерс') || orig.includes('snickers')) return false;
          if ([7155, 7156, 7157, 7215, 6106, 6107, 6109, 7169].includes(it.id)) return false;
          return true;
        });

        // 2. Check if current anime is Attack on Titan franchise
        const isAOT = items.some((it) => /атака титанов/i.test(it.title)) || (anime && /атака титанов/i.test(anime.title));
        if (isAOT) {
          const hasS3P2 = items.some((it) => /3.*часть\s*2/i.test(it.title));
          const hasFinal1 = items.some((it) => /финал/i.test(it.title) && !/часть|спецвыпуск|заключительн/i.test(it.title));
          const hasFinal2 = items.some((it) => /финал.*часть\s*2/i.test(it.title));

          if (!hasS3P2) {
            items.push({
              id: 7180,
              slug: 'shiki-38524',
              title: 'Атака титанов 3. Часть 2',
              originalTitle: 'Shingeki no Kyojin Season 3 Part 2',
              year: '2019',
              type: 'Сериал',
              imageUrl: 'https://shikimori.one/system/animes/original/38524.jpg?1711973463',
              relation: 'Часть 2',
              isCurrent: animeId === 7180,
              myScore: null,
              averageScore: null,
              ratingCount: 0
            });
          }
          if (!hasFinal1) {
            items.push({
              id: 7181,
              slug: 'shiki-40028',
              title: 'Атака титанов: Финал',
              originalTitle: 'Shingeki no Kyojin: The Final Season',
              year: '2020',
              type: 'Сериал',
              imageUrl: 'https://shikimori.one/system/animes/original/40028.jpg?1711973445',
              relation: '4-й сезон / Финал',
              isCurrent: animeId === 7181,
              myScore: null,
              averageScore: null,
              ratingCount: 0
            });
          }
          if (!hasFinal2) {
            items.push({
              id: 7182,
              slug: 'shiki-48583',
              title: 'Атака титанов: Финал. Часть 2',
              originalTitle: 'Shingeki no Kyojin: The Final Season Part 2',
              year: '2022',
              type: 'Сериал',
              imageUrl: 'https://shikimori.one/system/animes/original/48583.jpg?1708763764',
              relation: 'Часть 2',
              isCurrent: animeId === 7182,
              myScore: null,
              averageScore: null,
              ratingCount: 0
            });
          }
        }

        // 3. Check if current anime is Overlord (Повелитель) franchise
        const isOverlord = items.some((it) => /^повелитель\b/i.test(it.title)) || (anime && /^повелитель\b/i.test(anime.title));
        if (isOverlord) {
          const hasOverlord2 = items.some((it) => /повелитель\s*2\b/i.test(it.title));
          if (!hasOverlord2) {
            items.push({
              id: 7179,
              slug: 'shiki-35073',
              title: 'Повелитель 2',
              originalTitle: 'Overlord II',
              year: '2018',
              type: 'Сериал',
              imageUrl: 'https://shikimori.one/system/animes/original/35073.jpg?1711968222',
              relation: '2-й сезон',
              isCurrent: animeId === 7179,
              myScore: null,
              averageScore: null,
              ratingCount: 0
            });
          }
        }

        // 4. Merge custom linked anime and season markers from custom edits
        const allCustomEdits = getCustomAnimeEdits();
        const currentCustom = allCustomEdits[animeId] || {};
        if (currentCustom.season) {
          const currentItem = items.find((it) => it.id === animeId || it.isCurrent);
          if (currentItem) currentItem.relation = currentCustom.season;
        }

        if (Array.isArray(currentCustom.linkedAnime)) {
          for (const lItem of currentCustom.linkedAnime) {
            if (lItem && lItem.id) {
              const existingIdx = items.findIndex((it) => Number(it.id) === Number(lItem.id));
              if (existingIdx !== -1) {
                items[existingIdx].relation = lItem.relation || items[existingIdx].relation;
              } else {
                items.push({
                  id: Number(lItem.id),
                  title: lItem.title || 'Аниме',
                  originalTitle: lItem.originalTitle || '',
                  year: lItem.year || '',
                  type: lItem.type || 'Сериал',
                  imageUrl: lItem.imageUrl || '',
                  relation: lItem.relation || 'Связанная часть',
                  isCurrent: Number(lItem.id) === animeId,
                  myScore: null,
                  averageScore: null,
                  ratingCount: 0
                });
              }
            }
          }
        }

        // 5. Also check if any other anime links to this anime (from custom edits or catalog cache)
        const checkLinkContainer = (c) => {
          if (!c || (!Array.isArray(c.linkedAnime) && !c.related_json)) return;
          let linkedArr = Array.isArray(c.linkedAnime) ? c.linkedAnime : [];
          if (linkedArr.length === 0 && c.related_json) {
            try {
              const parsed = JSON.parse(c.related_json);
              if (Array.isArray(parsed)) linkedArr = parsed;
            } catch (e) {}
          }
          const hasLink = linkedArr.some((l) => Number(l.id) === animeId);
          if (!hasLink) return;

          // Add referencing anime itself
          if (Number(c.id) !== animeId) {
            const existingIdx = items.findIndex((it) => Number(it.id) === Number(c.id));
            if (existingIdx === -1) {
              items.push({
                id: Number(c.id),
                title: c.title || 'Аниме',
                originalTitle: c.originalTitle || c.original_title || '',
                year: c.year || '',
                type: c.type || 'Сериал',
                imageUrl: c.imageUrl || c.image_url || '',
                relation: c.season || 'Связанная часть',
                isCurrent: false,
                myScore: null,
                averageScore: null,
                ratingCount: 0
              });
            }
          }

          // Add peer franchise anime linked in the same container
          for (const peer of linkedArr) {
            if (!peer || !peer.id) continue;
            const pId = Number(peer.id);
            const existingIdx = items.findIndex((it) => Number(it.id) === pId);
            if (existingIdx === -1) {
              items.push({
                id: pId,
                title: peer.title || 'Аниме',
                originalTitle: peer.originalTitle || '',
                year: peer.year || '',
                type: peer.type || 'Сериал',
                imageUrl: peer.imageUrl || '',
                relation: peer.relation || 'Связанная часть',
                isCurrent: pId === animeId,
                myScore: null,
                averageScore: null,
                ratingCount: 0
              });
            } else if (!items[existingIdx].relation || items[existingIdx].relation === 'Связанная часть') {
              items[existingIdx].relation = peer.relation || items[existingIdx].relation;
            }
          }
        };

        Object.values(allCustomEdits).forEach(checkLinkContainer);
        try {
          const cachedAll = getAllCachedAnime();
          cachedAll.forEach(checkLinkContainer);
        } catch (e) {}

        // Sort chronologically by year
        items.sort((a, b) => {
          const yrA = parseInt(a.year, 10) || 0;
          const yrB = parseInt(b.year, 10) || 0;
          if (yrA !== yrB) return yrA - yrB;
          return (a.id || 0) - (b.id || 0);
        });

        setRelatedAnime(deduplicateAnimeList(items));
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
      let data;
      if (res.ok) {
        data = await res.json();
      } else {
        const edits = getCustomAnimeEdits();
        const custom = edits[Number(animeId)];
        if (custom) {
          data = custom;
        } else {
          throw new Error('Not found');
        }
      }
      data = applyCustomAnimeEdits(data);

      // Guard for Naruto: guarantee full description, genres, and Venicek rating 10
      const isNaruto =
        data.title === 'Наруто' ||
        (data.title && /наруто/i.test(data.title) && !/ураганные|боруто|хроники|фильм/i.test(data.title)) ||
        data.slug === 'shiki-20' ||
        data.id === 6198 ||
        data.id === 7178;

      if (isNaruto) {
        if (!data.description || data.description.trim() === '' || data.description === 'Описание отсутствует.') {
          data.description =
            'В день рождения Наруто Удзумаки на деревню Коноха напал легендарный демон — Девятихвостый Демонический Лис. Чтобы спасти деревню, глава селения, Четвёртый Хокагэ, пожертвовал своей жизнью и запечатал демона внутри новорождённого Наруто. Повзрослев, мальчик столкнулся с презрением жителей деревни, которые видели в нём лишь чудовище. Однако Наруто не сдался: его мечта — стать Хокагэ, сильнейшим ниндзя и лидером Конохи, чтобы все признали его силу. Вместе с Саскэ Утихой и Сакурой Харуно под началом Какаси Хатакэ он начинает свой долгий и опасный путь ниндзя.';
        }
        if (!Array.isArray(data.genres) || data.genres.length === 0) {
          data.genres = ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен', 'Боевые искусства'];
        }
        if (!Array.isArray(data.friendsRatings) || !data.friendsRatings.some((f) => f.nickname === 'Venicek')) {
          data.friendsRatings = [
            { userId: 21, nickname: 'Venicek', score: 10, updatedAt: new Date().toISOString() },
            ...(data.friendsRatings || [])
          ];
        }
      }

      // Ensure myScore is resolved from cached user ratings if missing
      if (data.myScore === null || data.myScore === undefined) {
        const currentUserId = user?.id || getCachedUserProfile()?.id;
        if (currentUserId) {
          const cachedRatings = getCachedUserRatings(currentUserId);
          const match = (cachedRatings || []).find(
            (r) =>
              Number(r.id) === Number(data.id) ||
              (Array.isArray(data.aliasIds) && data.aliasIds.map(Number).includes(Number(r.id))) ||
              (data.title && r.title && data.title.trim().toLowerCase() === r.title.trim().toLowerCase())
          );
          if (match && match.myScore !== null && match.myScore !== undefined) {
            data.myScore = Number(match.myScore);
          }
        }
      }

      setAnime(data);
      setImgSrc(data.imageUrl || data.image_url);
    } catch (err) {
      console.error('Error loading anime details:', err);
      try {
        const edits = getCustomAnimeEdits();
        const custom = edits[Number(animeId)];
        if (custom) {
          if (custom.myScore === null || custom.myScore === undefined) {
            const currentUserId = user?.id || getCachedUserProfile()?.id;
            if (currentUserId) {
              const cachedRatings = getCachedUserRatings(currentUserId);
              const match = (cachedRatings || []).find((r) => Number(r.id) === Number(custom.id));
              if (match && match.myScore !== null && match.myScore !== undefined) {
                custom.myScore = Number(match.myScore);
              }
            }
          }
          setAnime(custom);
          setImgSrc(custom.imageUrl || custom.image_url);
        }
      } catch (e) {}
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

  // Listen to live anime updates from DevConsole or App
  useEffect(() => {
    const handleUpdated = (e) => {
      const updated = e.detail;
      if (updated && Number(updated.id) === Number(animeId)) {
        setAnime((prev) => applyCustomAnimeEdits({ ...(prev || {}), ...updated }));
        setImgSrc(updated.imageUrl || updated.image_url);
      }
    };
    window.addEventListener('anilex:anime-updated', handleUpdated);
    return () => window.removeEventListener('anilex:anime-updated', handleUpdated);
  }, [animeId]);

  const handleImageError = () => {
    const raw = anime?.imageUrl || anime?.image_url;
    if (anime && imgSrc === raw && raw) {
      setImgSrc(getImageUrl(raw));
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
      const targetAnime = { ...anime, myScore: newScore };
      // Optimistically update UI and client cache
      setAnime((prev) => ({
        ...prev,
        myScore: newScore
      }));
      updateCachedUserRating(user.id, animeId, newScore, targetAnime);
      updateCachedAnimeItem(animeId, { myScore: newScore });

      if (onRateAnime) {
        onRateAnime(animeId, newScore, targetAnime);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('anilex:rating-updated', {
            detail: { animeId: Number(animeId), score: newScore, anime: targetAnime }
          })
        );
      }

      const res = await fetch(apiUrl(`/api/anime/${animeId}/rate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ score: newScore, anime: targetAnime })
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

                {/* Top-5 Pin Button (Photo 1 & 2) */}
                {anime.myScore !== null && user && (() => {
                  const aId = anime.id || animeId;
                  const isInTop5 = myTop5Ids.includes(aId);
                  const isMrTechPermanent = (user?.nickname === 'MrTech' || user?.id === 20) && (aId === 7170 || anime.title === 'Лимонные девочки');
                  return (
                    <button
                      type="button"
                      onClick={handleToggleTop5}
                      title={
                        isMrTechPermanent
                          ? 'Закреплено навсегда (нельзя снять)'
                          : isInTop5
                          ? 'Убрать из Топ-5'
                          : 'Закрепить в Топ-5 (макс. 5)'
                      }
                      className={`px-2.5 py-0.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ml-1 ${
                        isMrTechPermanent
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-not-allowed opacity-90'
                          : isInTop5
                          ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 font-bold'
                          : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <span>📌</span>
                      <span>{isInTop5 ? 'В Топ-5' : '+ В Топ-5'}</span>
                    </button>
                  );
                })()}
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

                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-2 mt-1 min-h-[2rem] leading-tight" title={item.title}>
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

      {/* Similar Anime Feed (Photo 1) */}
      <SimilarAnimeFeed
        animeId={animeId}
        currentAnime={anime}
        user={user}
        onSelectAnime={onSelectAnime}
      />

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

      {/* Floating Top-5 Toast Notification (Photo 1 & 2) */}
      {top5Toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/90 dark:bg-white/90 text-white dark:text-neutral-900 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-neutral-700/50 dark:border-neutral-200/50">
          <span>📌</span>
          <span>{top5Toast}</span>
        </div>
      )}
    </div>
  );
}
