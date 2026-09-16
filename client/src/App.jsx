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
import { Sparkles, Film, Loader2 } from 'lucide-react';
import { apiUrl } from './api';

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
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('anime_auth_token') || '');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('newest'); // 'newest' | 'rating' | 'recommendations'
  const [activeGenres, setActiveGenres] = useState([]);
  const [activeType, setActiveType] = useState('all');
  const [activeYear, setActiveYear] = useState('all');
  const [profileInitialTab, setProfileInitialTab] = useState('ratings');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'friends_rated' | 'my_rated' | 'my_unrated'
  const [page, setPage] = useState(1);

  // Data states
  const [animeList, setAnimeList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [genres, setGenres] = useState([]);
  const [types, setTypes] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recommendationCount, setRecommendationCount] = useState(0);

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
      }
      setView('catalog');
      setSelectedAnimeId(null);
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateTo = (newView, animeId = null) => {
    if (newView === 'anime-detail' && animeId) {
      window.location.hash = `#/anime/${animeId}`;
    } else if (newView === 'profile') {
      window.location.hash = '#/profile';
    } else if (newView === 'profile-edit') {
      window.location.hash = '#/profile/edit';
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
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('anime_auth_token');
          setToken('');
          setUser(null);
        });
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

  // Notifications polling (every 10s when authenticated)
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
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
    }
  };

  // Fetch initial or refreshed anime list
  const fetchAnime = useCallback(
    async (targetPage = 1, isAppend = false) => {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        if (activeSort) params.append('sort', activeSort);
        if (activeType !== 'all') params.append('type', activeType);
        if (activeYear && activeYear !== 'all') params.append('year', activeYear);
        if (filterStatus !== 'all') params.append('filterStatus', filterStatus);
        if (activeGenres.length > 0) params.append('genres', activeGenres.join(','));
        params.append('page', targetPage);
        params.append('limit', 20);

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(apiUrl(`/api/anime?${params.toString()}`), { headers });
        if (!res.ok) throw new Error('Failed to load anime');

        const data = await res.json();
        const newItems = data.items || [];

        if (isAppend) {
          setAnimeList((prev) => {
            // Avoid duplicates by ID
            const existingIds = new Set(prev.map((i) => i.id));
            const filtered = newItems.filter((i) => !existingIds.has(i.id));
            return [...prev, ...filtered];
          });
        } else {
          setAnimeList(newItems);
        }

        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(targetPage);
        setRecommendationCount(data.recommendationGenresCount || 0);
      } catch (err) {
        console.error('Error loading anime catalog:', err);
        if (!isAppend) {
          setAnimeList([]);
          setTotalCount(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, activeSort, activeType, activeYear, filterStatus, activeGenres, token]
  );

  // Reset to page 1 on filter or search change
  useEffect(() => {
    fetchAnime(1, false);
  }, [fetchAnime]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (view !== 'catalog') return;

    const isGeneralCatalog = !searchQuery.trim() && activeGenres.length === 0 && activeType === 'all' && (!activeYear || activeYear === 'all') && filterStatus === 'all';

    const observer = new IntersectionObserver(
      (entries) => {
        const canLoadMore = isGeneralCatalog || page < totalPages;
        if (entries[0].isIntersecting && !loading && !loadingMore && canLoadMore) {
          fetchAnime(page + 1, true);
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [view, loading, loadingMore, page, totalPages, fetchAnime, searchQuery, activeGenres, activeType, activeYear, filterStatus]);

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
          item.id === animeId
            ? { ...item, isFavorite: data.isFavorite }
            : item
        )
      );
    } catch (err) {
      console.error('Favorite toggle error:', err);
    }
  };

  // Logo click handler (resets everything to clean homepage)
  const handleLogoClick = () => {
    setSearchQuery('');
    setActiveGenres([]);
    setActiveType('all');
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
      setAnimeList((prev) =>
        prev.map((item) =>
          item.id === animeId
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
    localStorage.setItem('anime_auth_token', newToken);
    isFirstNotificationFetchRef.current = true;
    seenNotificationIdsRef.current.clear();
    fetchMetadata();
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
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

        {/* VIEW 4: CATALOG (MAIN SCREEN) */}
        {view === 'catalog' && (
          <div>
            {/* Top Horizontal Carousel: Top Rated / Newest Switcher (User Requirement 2) */}
            <FeaturedCarousel onSelectAnime={(id) => navigateTo('anime-detail', id)} />

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

                {/* List of Anime Cards */}
                {animeList.length > 0 && (
                  <div className="space-y-4 sm:space-y-5">
                    {animeList.map((anime) => (
                      <AnimeCard
                        key={anime.id}
                        anime={anime}
                        user={user}
                        onRate={handleRate}
                        onGenreClick={handleGenreClick}
                        activeGenres={activeGenres}
                        onRequireAuth={() => setAuthModalOpen(true)}
                        onSelectAnime={(id) => navigateTo('anime-detail', id)}
                        onToggleFavorite={handleToggleFavorite}
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
