import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import AnimeCard from './components/AnimeCard';
import SortBar from './components/SortBar';
import FilterSidebar from './components/FilterSidebar';
import AuthModal from './components/AuthModal';
import AnimeDetailPage from './components/AnimeDetailPage';
import ProfilePage from './components/ProfilePage';
import ProfileEditPage from './components/ProfileEditPage';
import FeaturedCarousel from './components/FeaturedCarousel';
import NotificationToast from './components/NotificationToast';
import DevConsolePage from './components/DevConsolePage';
import { Sparkles, Film, Loader2 } from 'lucide-react';
import { apiUrl } from './api';
import { getCachedCatalog, setCachedCatalog, hasCatalogChanged, updateCachedAnimeItem, upsertCachedAnimeItem, removeCachedAnimeItem } from './utils/catalogCache';
import { getHiddenAnimeIds, toggleHiddenAnime } from './utils/hiddenStorage';
import { getCachedUserProfile, setCachedUserProfile, clearCachedUserProfile, updateCachedUserRating } from './utils/profileCache';
import { deduplicateAnimeList } from './utils/animeDeduplicator';
import { getCustomAnimeEdits, saveCustomAnimeEdit } from './utils/customEditsStorage';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('anime_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  // Navigation state: 'catalog' | 'anime-detail' | 'profile' | 'profile-edit'
  const [view, setView] = useState('catalog');
  const [selectedAnimeId, setSelectedAnimeId] = useState(null);

  // Auth state
  const [user, setUser] = useState(() => getCachedUserProfile());
  const [token, setToken] = useState(() => localStorage.getItem('anime_auth_token') || '');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSort, setActiveSort] = useState('newest'); // 'newest' | 'rating' | 'recommendations'
  const [activeGenres, setActiveGenres] = useState([]);
  const [activeType, setActiveType] = useState('all');
  const [activeYear, setActiveYear] = useState('all');
  const [profileInitialTab, setProfileInitialTab] = useState('ratings');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'friends_rated' | 'my_rated' | 'my_unrated'
  const [page, setPage] = useState(1);

  // Debounce search query input to smoothly fetch as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Data states
  const [animeList, setAnimeList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [genres, setGenres] = useState([]);
  const [types, setTypes] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recommendationCount, setRecommendationCount] = useState(0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [renderedLimit, setRenderedLimit] = useState(isMobile ? 12 : 20);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const seenNotificationIdsRef = useRef(new Set());
  const isFirstNotificationFetchRef = useRef(true);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Infinite scroll trigger ref
  const observerTarget = useRef(null);

  // Handle URL Hash navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/anime/')) {
        const id = parseInt(hash.replace('#/anime/', ''), 10);
        if (!isNaN(id)) {
          setSelectedAnimeId(id);
          setView('anime-detail');
          return;
        }
      } else if (hash === '#/profile') {
        setView('profile');
        return;
      } else if (hash === '#/profile/edit') {
        setView('profile-edit');
        return;
      } else if (hash === '#/dev' || hash === '#/admin' || hash === '#/dev-console') {
        setView('dev-console');
        return;
      }
      setView('catalog');
      setSelectedAnimeId(null);
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Listen to live anime updates from DevConsole
  useEffect(() => {
    const handleLiveAnimeUpdated = (e) => {
      const updated = e.detail;
      if (!updated || !updated.id) return;
      const numId = Number(updated.id);
      const fullUpdated = applyCustomAnimeEdits(updated);
      setAnimeList((prev) => {
        const exists = prev.some(
          (item) => Number(item.id) === numId || (Array.isArray(item.aliasIds) && item.aliasIds.includes(numId))
        );
        if (exists) {
          return prev.map((item) =>
            Number(item.id) === numId || (Array.isArray(item.aliasIds) && item.aliasIds.includes(numId))
              ? { ...item, ...fullUpdated }
              : item
          );
        } else {
          return [fullUpdated, ...prev];
        }
      });
    };
    window.addEventListener('anilex:anime-updated', handleLiveAnimeUpdated);
    return () => window.removeEventListener('anilex:anime-updated', handleLiveAnimeUpdated);
  }, []);

  const navigateTo = (newView, animeId = null) => {
    if (newView === 'anime-detail' && animeId) {
      window.location.hash = `#/anime/${animeId}`;
    } else if (newView === 'profile') {
      window.location.hash = '#/profile';
    } else if (newView === 'profile-edit') {
      window.location.hash = '#/profile/edit';
    } else if (newView === 'dev-console') {
      window.location.hash = '#/dev';
    } else {
      window.location.hash = '#/';
    }
  };

  // Apply dark mode class to HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('anime_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('anime_theme', 'light');
    }
  }, [darkMode]);

  // Check auth on mount
  useEffect(() => {
    if (token) {
      fetch(apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Unauthorized');
        })
        .then((data) => {
          setUser(data.user);
          setCachedUserProfile(data.user);
        })
        .catch(() => {
          localStorage.removeItem('anime_auth_token');
          clearCachedUserProfile();
          setToken('');
          setUser(null);
        });
    } else {
      clearCachedUserProfile();
      setUser(null);
    }
  }, [token]);

  // Fetch metadata (genres, types, friends)
  const fetchMetadata = useCallback(async () => {
    try {
      const [genresRes, typesRes, friendsRes] = await Promise.all([
        fetch(apiUrl('/api/genres')),
        fetch(apiUrl('/api/types')),
        fetch(apiUrl('/api/friends'))
      ]);

      if (genresRes.ok) {
        const data = await genresRes.json();
        setGenres(data.genres || []);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setTypes(data.types || []);
      }
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Fetch user notifications
  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }
    try {
      const res = await fetch(apiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.notifications || [];
        setNotifications(items);

        // Toast trigger for new unread notifications received in background
        if (isFirstNotificationFetchRef.current) {
          items.forEach((it) => seenNotificationIdsRef.current.add(it.id));
          isFirstNotificationFetchRef.current = false;
        } else {
          const newUnread = items.filter(
            (it) => !it.isRead && !seenNotificationIdsRef.current.has(it.id)
          );
          if (newUnread.length > 0) {
            newUnread.forEach((it) => seenNotificationIdsRef.current.add(it.id));
            setToasts((prev) => [...newUnread, ...prev]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [token]);

  // Notifications polling (every 5s when authenticated)
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [token, fetchNotifications]);

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const handleDismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleMarkNotificationAsRead = async (id) => {
    if (!token) return;
    try {
      await fetch(apiUrl(`/api/notifications/${id}/read`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: 1 } : n))
      );
      handleDismissToast(id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    if (!token) return;
    try {
      await fetch(apiUrl('/api/notifications/read-all'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
      setToasts([]);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleDeleteNotification = async (id) => {
    if (!token) return;
    try {
      await fetch(apiUrl(`/api/notifications/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      handleDismissToast(id);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleAcceptFriendNotification = async (notif) => {
    const requestId = notif.data?.requestId;
    if (!requestId || !token) return;
    try {
      const res = await fetch(apiUrl(`/api/friends/respond/${requestId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'accept' })
      });
      if (res.ok) {
        handleMarkNotificationAsRead(notif.id);
        fetchMetadata();
      }
    } catch (err) {
      console.error('Error accepting friend request from notification:', err);
    }
  };

  const handleRejectFriendNotification = async (notif) => {
    const requestId = notif.data?.requestId;
    if (!requestId || !token) return;
    try {
      const res = await fetch(apiUrl(`/api/friends/respond/${requestId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'reject' })
      });
      if (res.ok) {
        handleMarkNotificationAsRead(notif.id);
      }
    } catch (err) {
      console.error('Error rejecting friend request from notification:', err);
    }
  };

  const handleNavigateAnimeNotification = (notif) => {
    handleMarkNotificationAsRead(notif.id);
    if (notif.data?.animeId) {
      navigateTo('anime-detail', notif.data.animeId);
      const targetCommentId = notif.data?.commentId || notif.data?.replyId;
      setTimeout(() => {
        if (targetCommentId) {
          const el = document.getElementById(`comment-${targetCommentId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-neutral-400', 'dark:ring-neutral-500');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-neutral-400', 'dark:ring-neutral-500');
            }, 3000);
            return;
          }
        }
        const section = document.getElementById('comments-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  };

  // Fetch initial or refreshed anime list
  const fetchAnime = useCallback(
    async (targetPage = 1, isAppend = false) => {
      const isSearching = Boolean(debouncedSearch.trim());
      const catalogKey = `s${activeSort}_t${activeType}_y${activeYear}_st${filterStatus}_g${activeGenres.slice().sort().join('_')}_q${debouncedSearch.trim()}_u${user ? user.id : 'anon'}`;
      let cached = null;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        if (targetPage === 1 && !isSearching) {
          cached = getCachedCatalog(catalogKey);
          if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
            let items = cached.items.map((it) => applyCustomAnimeEdits(it));
            if (activeSort === 'unrated') {
              items = items.filter((it) => it.myScore === null || it.myScore === undefined);
            }
            setAnimeList(items);
            setTotalCount(activeSort === 'unrated' ? items.length : (cached.total || 0));
            setTotalPages(cached.totalPages || 1);
            setRecommendationCount(cached.recommendationGenresCount || 0);
            setPage(cached.page || 1);
            setLoading(false);
          } else {
            setLoading(true);
          }
        } else {
          setLoading(true);
        }
      }

      try {
        const params = new URLSearchParams();
        if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
        if (activeSort) params.append('sort', activeSort);
        if (activeType !== 'all') params.append('type', activeType);
        if (activeYear && activeYear !== 'all') params.append('year', activeYear);
        if (filterStatus !== 'all') params.append('filterStatus', filterStatus);
        if (activeGenres.length > 0) params.append('genres', activeGenres.join(','));
        params.append('page', targetPage);
        params.append('limit', isMobile ? 12 : 15);

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(apiUrl(`/api/anime?${params.toString()}`), { headers });
        if (!res.ok) throw new Error('Failed to load anime');

        const data = await res.json();
        const rawItems = data.items || [];
        const newItems = rawItems.map((it) => applyCustomAnimeEdits(it));

        const hiddenIds = getHiddenAnimeIds(user?.id);
        let deletedAnimeIds = new Set();
        try {
          deletedAnimeIds = new Set(JSON.parse(localStorage.getItem('anilex_deleted_anime_ids') || '[]').map(Number));
        } catch (e) {}

        const sanitizeList = (list) => {
          const seen = new Set();
          return list
            .map((it) => applyCustomAnimeEdits(it))
            .filter((item) => {
              const numId = Number(item.id);
              if (deletedAnimeIds.has(numId)) {
                return false;
              }
              const img = (item.imageUrl || item.image_url || '').toLowerCase();
              const t = (item.title || '').toLowerCase();
              const orig = (item.originalTitle || item.original_title || '').toLowerCase();
              if (!isSearching && (img.includes('missing_original') || img.includes('404'))) {
                return false;
              }
              if (t.includes('сникерс') || orig.includes('snickers')) {
                return false;
              }
              if ([7155, 7156, 7157, 7215, 6106, 6107, 6109, 7169].includes(item.id)) {
                return false;
              }
              // On main catalog (not searching): hide titles marked as not interested
              if (!isSearching && (Boolean(item.isHidden) || hiddenIds.has(item.id))) {
                return false;
              }
              // When sorting by 'unrated', exclude titles rated by current user (myScore !== null),
              // while allowing titles rated by other users (averageScore exists)
              if (activeSort === 'unrated' && item.myScore !== null && item.myScore !== undefined) {
                return false;
              }
              const key = isSearching ? String(item.id) : `${(item.title || '').trim().toLowerCase()}_${item.year || ''}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).map((item) => {
              // Guard for Naruto descriptions & genres
              if (item.title === 'Наруто' || (item.title && /наруто/i.test(item.title) && !/ураганные|боруто|хроники|фильм/i.test(item.title))) {
                if (!item.description || item.description.trim() === '' || item.description === 'Описание отсутствует.') {
                  item.description =
                    'В день рождения Наруто Удзумаки на деревню Коноха напал легендарный демон — Девятихвостый Демонический Лис. Чтобы спасти деревню, глава селения, Четвёртый Хокагэ, пожертвовал своей жизнью и запечатал демона внутри новорождённого Наруто. Повзрослев, мальчик столкнулся с презрением жителей деревни. Однако Наруто не сдался: его мечта — стать Хокагэ, сильнейшим ниндзя и лидером Конохи. Вместе с Саскэ Утихой и Сакурой Харуно под началом Какаси Хатакэ он начинает свой путь ниндзя.';
                }
                if (!Array.isArray(item.genres) || item.genres.length === 0) {
                  item.genres = ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен', 'Боевые искусства'];
                }
              }
              return {
                ...item,
                isHidden: Boolean(item.isHidden || hiddenIds.has(item.id))
              };
            });
        };

        let sanitized = deduplicateAnimeList(sanitizeList(newItems));

        // Ensure all custom anime edits are injected into existing items
        const allCustomEdits = getCustomAnimeEdits();
        for (let i = 0; i < sanitized.length; i++) {
          const it = sanitized[i];
          const custom = allCustomEdits[Number(it.id)];
          if (custom) {
            sanitized[i] = applyCustomAnimeEdits({ ...it, ...custom });
          }
        }

        // If searching for Overlord, guarantee Overlord 2 appears in results
        if (isSearching && /повелитель/i.test(debouncedSearch)) {
          if (!sanitized.some((it) => /повелитель\s*2\b/i.test(it.title))) {
            sanitized.push({
              id: 7179,
              slug: 'shiki-35073',
              title: 'Повелитель 2',
              originalTitle: 'Overlord II',
              year: '2018',
              type: 'Сериал',
              imageUrl: 'https://shikimori.one/system/animes/original/35073.jpg?1711968222',
              genres: ['Экшен', 'Фэнтези', 'Приключения', 'Магия'],
              description: 'Момонга, взявший имя Аинз Оал Гоун, продолжает укреплять позиции Великой Гробницы Назарик в Новом Мире.',
              myScore: null,
              averageScore: null,
              ratingCount: 0
            });
            sanitized = deduplicateAnimeList(sanitized);
          }
        }

        // 1. If searching, ensure custom edited anime matching the search query appear in search!
        if (isSearching) {
          const searchLower = debouncedSearch.trim().toLowerCase();
          const matchingCustoms = Object.values(allCustomEdits).filter((item) => {
            if (!item || !item.id || !item.title) return false;
            if (deletedAnimeIds.has(Number(item.id))) return false;
            const t = (item.title || '').toLowerCase();
            const ot = (item.originalTitle || item.original_title || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            return t.includes(searchLower) || ot.includes(searchLower) || desc.includes(searchLower);
          });

          for (const cItem of matchingCustoms) {
            const fullCustom = applyCustomAnimeEdits(cItem);
            const idx = sanitized.findIndex(
              (it) => Number(it.id) === Number(fullCustom.id) || (Array.isArray(it.aliasIds) && it.aliasIds.includes(Number(fullCustom.id)))
            );
            if (idx !== -1) {
              sanitized[idx] = { ...sanitized[idx], ...fullCustom };
            } else {
              sanitized.unshift({
                ...fullCustom,
                aliasIds: [fullCustom.id],
                myScore: null,
                averageScore: null,
                ratingCount: 0,
                isFavorite: false,
                isHidden: false,
                commentsCount: 0
              });
            }
          }
          sanitized = deduplicateAnimeList(sanitized);
        }

        // 2. On main feed (page 1, not searching), ensure custom edited anime appear in the feed!
        if (!isSearching && targetPage === 1 && activeSort !== 'unrated') {
          const customItems = Object.values(allCustomEdits)
            .filter((item) => item && item.id && item.title && !deletedAnimeIds.has(Number(item.id)))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

          for (const cItem of customItems) {
            const fullCustom = applyCustomAnimeEdits(cItem);
            const idx = sanitized.findIndex(
              (it) => Number(it.id) === Number(fullCustom.id) || (Array.isArray(it.aliasIds) && it.aliasIds.includes(Number(fullCustom.id)))
            );
            if (idx !== -1) {
              sanitized[idx] = { ...sanitized[idx], ...fullCustom };
            } else {
              sanitized.unshift({
                ...fullCustom,
                aliasIds: [fullCustom.id],
                myScore: null,
                averageScore: null,
                ratingCount: 0,
                isFavorite: false,
                isHidden: false,
                commentsCount: 0
              });
            }
          }
          sanitized = deduplicateAnimeList(sanitized);
        }

        if (isAppend) {
          setAnimeList((prev) => {
            const combined = deduplicateAnimeList([...prev, ...sanitized]);
            const updated = sanitizeList(combined);
            // Save cumulative list to user's cache
            if (!isSearching) {
              setCachedCatalog(catalogKey, {
                items: updated,
                page: targetPage,
                total: data.total,
                totalPages: data.totalPages,
                recommendationGenresCount: data.recommendationGenresCount
              });
            }
            return updated;
          });
        } else {
          if (!cached || hasCatalogChanged(cached.items, sanitized)) {
            setAnimeList(sanitized);
            if (!isSearching) {
              setCachedCatalog(catalogKey, {
                items: sanitized,
                page: 1,
                total: data.total,
                totalPages: data.totalPages,
                recommendationGenresCount: data.recommendationGenresCount
              });
            }
          }
        }

        const countReduction = newItems.length - sanitized.length;
        const adjustedTotal = Math.max(sanitized.length, (data.total || 0) - Math.max(0, countReduction));
        setTotalCount(adjustedTotal);
        setTotalPages(data.totalPages || 1);
        setPage(targetPage);
        setRecommendationCount(data.recommendationGenresCount || 0);
      } catch (err) {
        console.error('Error loading anime catalog:', err);
        if (!isAppend && !cached) {
          setAnimeList([]);
          setTotalCount(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, activeSort, activeType, activeYear, filterStatus, activeGenres, token, user]
  );

  // Reset to page 1 on filter or search change
  useEffect(() => {
    fetchAnime(1, false);
  }, [fetchAnime]);

  // Refs to prevent duplicate fetches or runaway cascading
  const isFetchingMoreRef = useRef(false);
  const pageRef = useRef(page);
  const totalPagesRef = useRef(totalPages);
  const loadingRef = useRef(loading || loadingMore);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  useEffect(() => {
    loadingRef.current = loading || loadingMore;
  }, [loading, loadingMore]);

  // 1. Catalog Scroll Listener: Loads next 15 titles when user scrolls down
  useEffect(() => {
    if (view !== 'catalog') return;
    if (debouncedSearch.trim().length > 0) return; // Search is handled separately

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        if (loadingRef.current || isFetchingMoreRef.current) return;

        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        // Trigger loading next 15 when user scrolls down within 300px of page bottom
        if (scrollTop + clientHeight >= scrollHeight - 300) {
          const isGeneralCatalog = activeGenres.length === 0 && activeType === 'all' && (!activeYear || activeYear === 'all') && filterStatus === 'all';
          const canLoadMore = isGeneralCatalog || pageRef.current < totalPagesRef.current;

          if (canLoadMore) {
            isFetchingMoreRef.current = true;
            fetchAnime(pageRef.current + 1, true).finally(() => {
              isFetchingMoreRef.current = false;
            });
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [view, debouncedSearch, activeGenres, activeType, activeYear, filterStatus, fetchAnime]);

  // Progressive rendering: mount cards smoothly in small batches for phones
  useEffect(() => {
    setRenderedLimit(isMobile ? 12 : 20);
  }, [debouncedSearch, activeSort, activeType, activeYear, filterStatus, activeGenres, isMobile]);

  useEffect(() => {
    if (view !== 'catalog') return;
    const handleProgressiveScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const clientHeight = window.innerHeight;
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        setRenderedLimit((prev) => Math.min(animeList.length, prev + (isMobile ? 8 : 15)));
      }
    };
    window.addEventListener('scroll', handleProgressiveScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleProgressiveScroll);
  }, [view, animeList.length, isMobile]);

  // 2. Search Mode: Untouched IntersectionObserver for search results
  useEffect(() => {
    if (view !== 'catalog') return;
    if (!debouncedSearch.trim()) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
          fetchAnime(page + 1, true);
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [view, loading, loadingMore, page, totalPages, fetchAnime, debouncedSearch]);

  // Toggle Favorite handler
  const handleToggleFavorite = async (animeId) => {
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/anime/${animeId}/favorite`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Favorite toggle failed');

      const data = await res.json();

      setAnimeList((prev) =>
        prev.map((item) =>
          (item.id === animeId || (item.aliasIds && item.aliasIds.includes(animeId)))
            ? { ...item, isFavorite: data.isFavorite }
            : item
        )
      );
    } catch (err) {
      console.error('Favorite toggle error:', err);
    }
  };

  // Toggle Hide ("Не интересует") handler
  const handleToggleHide = async (animeId, forcedState = null) => {
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    const animeObj = animeList.find((it) => it.id === animeId || (it.aliasIds && it.aliasIds.includes(animeId))) || { id: animeId };
    const newHidden = await toggleHiddenAnime(animeObj, token, user?.id, forcedState);

    const isSearching = Boolean(debouncedSearch.trim());

    if (!isSearching && newHidden) {
      // Main catalog: remove immediately from list
      setAnimeList((prev) => prev.filter((item) => item.id !== animeId && !(item.aliasIds && item.aliasIds.includes(animeId))));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } else {
      // Search mode (Photo 1) or un-hiding: update isHidden in current animeList to dim/undim
      setAnimeList((prev) =>
        prev.map((item) =>
          (item.id === animeId || (item.aliasIds && item.aliasIds.includes(animeId))) ? { ...item, isHidden: newHidden } : item
        )
      );
    }
  };

  // Logo click handler (resets everything to clean homepage)
  const handleLogoClick = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setActiveGenres([]);
    setActiveType('all');
    setActiveYear('all');
    setActiveSort('newest');
    setFilterStatus('all');
    setSelectedAnimeId(null);
    window.location.hash = '#/';
    setView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Rate anime handler
  const handleRate = async (animeId, score) => {
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/anime/${animeId}/rate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ score })
      });

      if (!res.ok) throw new Error('Rating failed');

      const data = await res.json();

      // Update in local state
      const targetAnime = animeList.find((it) => it.id === animeId || (it.aliasIds && it.aliasIds.includes(animeId)));
      if (activeSort === 'unrated' && data.myScore !== null && data.myScore !== undefined) {
        setAnimeList((prev) =>
          prev.filter((item) => item.id !== animeId && !(item.aliasIds && item.aliasIds.includes(animeId)))
        );
        setTotalCount((prev) => Math.max(0, prev - 1));
      } else {
        setAnimeList((prev) =>
          prev.map((item) =>
            (item.id === animeId || (item.aliasIds && item.aliasIds.includes(animeId)))
              ? {
                  ...item,
                  myScore: data.myScore,
                  averageScore: data.averageScore,
                  ratingCount: data.ratingCount,
                  friendsRatings: data.friendsRatings
                }
              : item
          )
        );
      }

      // Update in cached catalog and user ratings cache
      updateCachedAnimeItem(animeId, {
        myScore: data.myScore,
        averageScore: data.averageScore,
        ratingCount: data.ratingCount
      });
      if (targetAnime?.aliasIds) {
        targetAnime.aliasIds.forEach((aid) => {
          updateCachedAnimeItem(aid, {
            myScore: data.myScore,
            averageScore: data.averageScore,
            ratingCount: data.ratingCount
          });
        });
      }
      updateCachedUserRating(user?.id, animeId, data.myScore, targetAnime);

      fetchMetadata();
    } catch (err) {
      console.error('Rate error:', err);
    }
  };

  // Genre click handler
  const handleGenreClick = (genre) => {
    if (genre === 'clear_all') {
      setActiveGenres([]);
      return;
    }
    setActiveGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync AnimeGO handler
  const handleSyncAnimeGo = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(apiUrl('/api/anime/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: [4, 5, 6] })
      });
      const data = await res.json();
      await fetchMetadata();
      await fetchAnime(1, false);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  // Login handler
  const handleLoginSuccess = (newUser, newToken) => {
    setUser(newUser);
    setToken(newToken);
    setCachedUserProfile(newUser);
    localStorage.setItem('anime_auth_token', newToken);
    isFirstNotificationFetchRef.current = true;
    seenNotificationIdsRef.current.clear();
    fetchMetadata();
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    clearCachedUserProfile();
    setToken('');
    setNotifications([]);
    setToasts([]);
    seenNotificationIdsRef.current.clear();
    isFirstNotificationFetchRef.current = true;
    localStorage.removeItem('anime_auth_token');
    navigateTo('catalog');
  };

  // Reset filters
  const handleResetFilters = () => {
    setActiveGenres([]);
    setActiveType('all');
    setActiveYear('all');
    setFilterStatus('all');
    setActiveSort('newest');
    setSearchQuery('');
    setDebouncedSearch('');
  };

  // Open friends tab in profile
  const handleOpenFriendsSearch = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setProfileInitialTab('friends');
    navigateTo('profile');
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      
      {/* Header */}
      <Header
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={(loading || searchQuery !== debouncedSearch) && searchQuery.trim().length > 0}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onNavigate={navigateTo}
        onLogoClick={handleLogoClick}
        notifications={notifications}
        unreadNotificationsCount={unreadNotificationsCount}
        onMarkNotificationAsRead={handleMarkNotificationAsRead}
        onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
        onDeleteNotification={handleDeleteNotification}
        onAcceptFriendNotification={handleAcceptFriendNotification}
        onRejectFriendNotification={handleRejectFriendNotification}
        onNavigateAnimeNotification={handleNavigateAnimeNotification}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* VIEW 1: ANIME DETAIL PAGE */}
        {view === 'anime-detail' && selectedAnimeId && (
          <AnimeDetailPage
            animeId={selectedAnimeId}
            user={user}
            onBack={() => navigateTo('catalog')}
            onGenreClick={handleGenreClick}
            onRequireAuth={() => setAuthModalOpen(true)}
            onSelectAnime={(id) => navigateTo('anime-detail', id)}
          />
        )}

        {/* VIEW 2: PROFILE PAGE */}
        {view === 'profile' && (
          <ProfilePage
            user={user}
            genres={genres}
            initialTab={profileInitialTab}
            onNavigate={navigateTo}
            onSelectAnime={(id) => navigateTo('anime-detail', id)}
            onRateAnime={handleRate}
            onToggleFavorite={handleToggleFavorite}
            onToggleHide={handleToggleHide}
          />
        )}

        {/* VIEW 3: PROFILE SETTINGS PAGE */}
        {view === 'profile-edit' && (
          <ProfileEditPage
            user={user}
            onNavigate={navigateTo}
            onUserUpdated={handleLoginSuccess}
          />
        )}

        {/* VIEW: DEVELOPER CONSOLE (JUST ONLY) */}
        {view === 'dev-console' && (
          <DevConsolePage
            user={user}
            token={token}
            onNavigate={navigateTo}
            onAnimeUpdated={(updatedAnime) => {
              if (updatedAnime && updatedAnime.id) {
                saveCustomAnimeEdit(updatedAnime.id, updatedAnime);
                updateCachedAnimeItem(updatedAnime.id, updatedAnime);
                upsertCachedAnimeItem(updatedAnime);
                setAnimeList((prev) => {
                  const exists = prev.some((item) => Number(item.id) === Number(updatedAnime.id));
                  if (exists) {
                    return prev.map((item) => (Number(item.id) === Number(updatedAnime.id) ? { ...item, ...updatedAnime } : item));
                  } else {
                    return [updatedAnime, ...prev];
                  }
                });
              }
            }}
            onAnimeDeleted={(deletedId) => {
              if (deletedId) {
                const numId = Number(deletedId);
                try {
                  const deletedList = JSON.parse(localStorage.getItem('anilex_deleted_anime_ids') || '[]');
                  if (!deletedList.includes(numId)) {
                    deletedList.push(numId);
                    localStorage.setItem('anilex_deleted_anime_ids', JSON.stringify(deletedList));
                  }
                } catch (e) {}
                removeCachedAnimeItem(numId);
                setAnimeList((prev) => prev.filter((item) => Number(item.id) !== numId));
                setTotalCount((prev) => Math.max(0, prev - 1));
              }
            }}
            onCatalogUpdated={(change) => {
              if (change?.isDeleted && change?.id) {
                const numId = Number(change.id);
                try {
                  const deletedList = JSON.parse(localStorage.getItem('anilex_deleted_anime_ids') || '[]');
                  if (!deletedList.includes(numId)) {
                    deletedList.push(numId);
                    localStorage.setItem('anilex_deleted_anime_ids', JSON.stringify(deletedList));
                  }
                } catch (e) {}
                removeCachedAnimeItem(numId);
                setAnimeList((prev) => prev.filter((item) => Number(item.id) !== numId));
                setTotalCount((prev) => Math.max(0, prev - 1));
              } else if (change && change.id) {
                saveCustomAnimeEdit(change.id, change);
                updateCachedAnimeItem(change.id, change);
                upsertCachedAnimeItem(change);
                setAnimeList((prev) => {
                  const exists = prev.some((item) => Number(item.id) === Number(change.id));
                  if (exists) {
                    return prev.map((item) => (Number(item.id) === Number(change.id) ? { ...item, ...change } : item));
                  } else {
                    return [change, ...prev];
                  }
                });
              }
            }}
            onUserUpdated={(updatedUser) => {
              if (user && updatedUser && Number(user.id) === Number(updatedUser.id)) {
                handleLoginSuccess({ user: updatedUser, token });
              }
            }}
          />
        )}

        {/* VIEW 4: CATALOG (MAIN SCREEN) */}
        {view === 'catalog' && (
          <div>
            {/* Top Horizontal Carousel: Top Rated / My Ratings / Newest Switcher (Hidden during active search) */}
            {!searchQuery.trim() && (
              <FeaturedCarousel
                user={user}
                token={token}
                friends={friends}
                onRequireAuth={() => setAuthModalOpen(true)}
                onSelectAnime={(id) => navigateTo('anime-detail', id)}
              />
            )}

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* LEFT / CENTER: Anime List */}
              <div className="flex-1 w-full min-w-0">
                
                {/* Sort Bar */}
                <SortBar
                  currentSort={activeSort}
                  onSortChange={setActiveSort}
                  totalCount={totalCount}
                  user={user}
                  recommendationCount={recommendationCount}
                />

                {/* Recommendations Banner if active */}
                {activeSort === 'recommendations' && (
                  <div className="mb-6 p-4 rounded-3xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-white/10 dark:bg-neutral-900/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-amber-400 dark:text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">Персональные рекомендации</h3>
                        <p className="text-xs opacity-80 mt-0.5">
                          {user
                            ? 'Подбор тайтлов основан на жанрах, которым вы поставили оценку 8 и выше'
                            : 'Войдите в профиль и оцените аниме на 8+, чтобы сформировать рекомендации'}
                        </p>
                      </div>
                    </div>

                    {!user && (
                      <button
                        onClick={() => setAuthModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white text-xs font-semibold shrink-0"
                      >
                        Войти
                      </button>
                    )}
                  </div>
                )}

                {/* Active filters badges */}
                {activeGenres.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="text-xs text-neutral-400 mr-1">Жанры:</span>
                    {activeGenres.map((g) => (
                      <span
                        key={g}
                        className="px-2.5 py-1 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5"
                      >
                        {g}
                        <button
                          onClick={() => handleGenreClick(g)}
                          className="hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Initial Loading Indicator */}
                {loading && animeList.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-medium">Загрузка каталога аниме...</span>
                  </div>
                )}

                {/* Empty State */}
                {!loading && animeList.length === 0 && (
                  <div className="py-16 text-center rounded-3xl bg-white dark:bg-[#151518] p-8 shadow-sm">
                    <Film className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-3" />
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      Тайтлы не найдены
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
                      Попробуйте изменить выбранные фильтры или сбросить поиск.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-4 px-4 py-2 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold"
                    >
                      Сбросить фильтры
                    </button>
                  </div>
                )}

                {/* Live searching indicator bar */}
                {(loading || searchQuery !== debouncedSearch) && searchQuery.trim().length > 0 && animeList.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-xl bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-300 text-xs w-fit animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500 dark:text-neutral-400" />
                    <span>Поиск «{searchQuery}»...</span>
                  </div>
                )}

                {/* List of Anime Cards */}
                {animeList.length > 0 && (
                  <div className="space-y-4 sm:space-y-5">
                    {animeList.slice(0, renderedLimit).map((anime) => (
                      <AnimeCard
                        key={anime.id}
                        anime={anime}
                        user={user}
                        friends={friends}
                        onRate={handleRate}
                        onGenreClick={handleGenreClick}
                        activeGenres={activeGenres}
                        onRequireAuth={() => setAuthModalOpen(true)}
                        onSelectAnime={(id) => navigateTo('anime-detail', id)}
                        onToggleFavorite={handleToggleFavorite}
                        onToggleHide={handleToggleHide}
                      />
                    ))}
                  </div>
                )}

                {/* Infinite Scroll Bottom Anchor */}
                <div ref={observerTarget} className="py-8 text-center">
                  {loadingMore && (
                    <div className="flex items-center justify-center gap-2 text-xs text-neutral-400 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Автоматическая загрузка новых тайтлов с AnimeGO...</span>
                    </div>
                  )}
                  {!loadingMore && searchQuery.trim() && page >= totalPages && animeList.length > 0 && (
                    <p className="text-xs text-neutral-400">
                      Больше тайтлов по запросу «{searchQuery.trim()}» не найдено
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: Filter Sidebar */}
              <FilterSidebar
                genres={genres}
                activeGenres={activeGenres}
                onToggleGenre={handleGenreClick}
                types={types}
                activeType={activeType}
                onSelectType={setActiveType}
                activeYear={activeYear}
                onSelectYear={setActiveYear}
                filterStatus={filterStatus}
                onSelectStatus={setFilterStatus}
                sort={activeSort}
                onSelectSort={setActiveSort}
                onResetFilters={handleResetFilters}
                onSyncAnimeGo={handleSyncAnimeGo}
                syncLoading={syncLoading}
                friends={friends}
                user={user}
                onOpenFriendsSearch={handleOpenFriendsSearch}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating Frosted Toast Notifications */}
      <NotificationToast
        toasts={toasts}
        onDismiss={handleDismissToast}
        onAcceptFriend={handleAcceptFriendNotification}
        onRejectFriend={handleRejectFriendNotification}
        onNavigateAnime={handleNavigateAnimeNotification}
      />

      {/* Auth Modal (Clean, no mocks) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
