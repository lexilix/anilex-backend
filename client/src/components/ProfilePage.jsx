import React, { useState, useEffect, useCallback } from 'react';
import { User, Settings, Star, Search, Filter, X, ArrowLeft, Film, Users, Calendar, Bookmark, Trash2, Check, UserPlus, UserCheck } from 'lucide-react';
import { getScoreBadgeClass } from '../utils/scoreColors';
import { apiUrl, getImageUrl } from '../api';

export default function ProfilePage({
  user,
  genres = [],
  initialTab = 'ratings',
  onNavigate,
  onSelectAnime,
  onRateAnime,
  onToggleFavorite
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'ratings');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Rated anime state
  const [ratedAnime, setRatedAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('my_score_desc');
  const [activeRatedGenres, setActiveRatedGenres] = useState([]);
  const [showAllRatedGenres, setShowAllRatedGenres] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedScore, setSelectedScore] = useState('all');

  // Favorites state
  const [favoritesList, setFavoritesList] = useState([]);
  const [favLoading, setFavLoading] = useState(true);
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const [favType, setFavType] = useState('all');
  const [activeFavGenres, setActiveFavGenres] = useState([]);
  const [showAllFavGenres, setShowAllFavGenres] = useState(false);

  // Friends state
  const [friendsTab, setFriendsTab] = useState('my'); // 'my' | 'requests' | 'search'
  const [friendsList, setFriendsList] = useState([]);
  const [myFriends, setMyFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendsQuery, setFriendsQuery] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Public friend profile preview state
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendRatings, setFriendRatings] = useState([]);

  // Fetch rated anime
  const fetchRated = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      if (!token) return;

      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (sortOption) params.append('sort', sortOption);
      if (selectedType !== 'all') params.append('type', selectedType);
      if (activeRatedGenres.length > 0) params.append('genres', activeRatedGenres.join(','));

      const res = await fetch(apiUrl(`/api/user/rated-anime?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        let items = data.items || [];
        if (selectedScore !== 'all') {
          items = items.filter((it) => it.myScore === parseInt(selectedScore, 10));
        }
        setRatedAnime(items);
      }
    } catch (err) {
      console.error('Error fetching rated anime:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortOption, selectedType, activeRatedGenres, selectedScore]);

  useEffect(() => {
    if (activeTab === 'ratings') {
      fetchRated();
    }
  }, [activeTab, fetchRated]);

  // Fetch favorites
  const fetchFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      if (!token) return;

      const params = new URLSearchParams();
      if (favSearchQuery.trim()) params.append('search', favSearchQuery.trim());
      if (favType !== 'all') params.append('type', favType);
      if (activeFavGenres.length > 0) params.append('genres', activeFavGenres.join(','));

      const res = await fetch(apiUrl(`/api/user/favorites?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFavoritesList(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setFavLoading(false);
    }
  }, [favSearchQuery, favType, activeFavGenres]);

  useEffect(() => {
    if (activeTab === 'favorites') {
      fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  // Quick remove from favorites
  const handleRemoveFavorite = async (e, animeId) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('anime_auth_token');
      if (!token) return;

      const res = await fetch(apiUrl(`/api/anime/${animeId}/favorite`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setFavoritesList((prev) => prev.filter((it) => it.id !== animeId));
        if (onToggleFavorite) onToggleFavorite(animeId);
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  // Fetch friend requests and my confirmed friends
  const fetchFriendRequestsAndMyFriends = useCallback(async () => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      if (!token) return;

      const [requestsRes, myFriendsRes] = await Promise.all([
        fetch(apiUrl('/api/friends/requests'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/friends/my'), { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
      }
      if (myFriendsRes.ok) {
        const data = await myFriendsRes.json();
        setMyFriends(data.friends || []);
      }
    } catch (err) {
      console.error('Error fetching friends data:', err);
    }
  }, []);

  // Search users in friends club
  const searchFriends = useCallback(async (query = '') => {
    setFriendsLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/users/search?q=${encodeURIComponent(query)}`), { headers });
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data.users || []);
      }
    } catch (err) {
      console.error('Error searching friends:', err);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'friends') {
      fetchFriendRequestsAndMyFriends();
      searchFriends(friendsQuery);
    }
  }, [activeTab, friendsQuery, searchFriends, fetchFriendRequestsAndMyFriends]);

  // Send friend request
  const handleSendFriendRequest = async (targetUserId) => {
    setActionLoadingId(targetUserId);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/friends/request/${targetUserId}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriendsList((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, friendshipStatus: data.status } : u))
        );
        fetchFriendRequestsAndMyFriends();
      }
    } catch (err) {
      console.error('Send friend request error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Respond to incoming friend request (accept: green, reject: red)
  const handleRespondFriendRequest = async (requestId, action) => {
    setActionLoadingId(requestId);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const res = await fetch(apiUrl(`/api/friends/respond/${requestId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        setIncomingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
        fetchFriendRequestsAndMyFriends();
        searchFriends(friendsQuery);
      }
    } catch (err) {
      console.error('Respond friend request error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Load friend public profile
  const handleOpenFriend = async (friendId) => {
    try {
      const res = await fetch(apiUrl(`/api/users/${friendId}/profile`));
      if (res.ok) {
        const data = await res.json();
        setSelectedFriend(data.user);
        setFriendRatings(data.ratings || []);
      }
    } catch (err) {
      console.error('Error loading friend profile:', err);
    }
  };

  if (!user) {
    return (
      <div className="py-24 text-center">
        <p className="text-base font-bold text-neutral-900 dark:text-white">
          Пожалуйста, войдите в свой профиль
        </p>
        <button
          onClick={() => onNavigate('catalog')}
          className="mt-4 px-4 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold"
        >
          В каталог
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-150">
      
      {/* Top back & settings button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('catalog')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#151518] text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад в каталог</span>
        </button>

        <button
          onClick={() => onNavigate('profile-edit')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Редактировать профиль</span>
        </button>
      </div>

      {/* User Header with Custom Banner and Avatar */}
      <div className="rounded-3xl bg-white dark:bg-[#151518] overflow-hidden shadow-sm">
        
        {/* Banner */}
        <div className="relative h-44 sm:h-56 w-full bg-neutral-200 dark:bg-neutral-800">
          {user.bannerUrl ? (
            <img
              src={user.bannerUrl}
              alt="Баннер"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-neutral-800 dark:bg-neutral-900 flex items-center justify-center text-neutral-600">
              <span className="text-xs font-medium uppercase tracking-widest opacity-40">
                Томодачи Профиль
              </span>
            </div>
          )}
        </div>

        {/* User Avatar & Info Row */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-5">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              {/* Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-3xl font-bold flex items-center justify-center shrink-0 shadow-xl ring-4 ring-white dark:ring-[#151518]">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {user.nickname}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">{user.email}</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-center">
                <span className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                  Оценено
                </span>
                <span className="text-base font-bold text-neutral-900 dark:text-white">
                  {user.ratedCount || ratedAnime.length}
                </span>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-center">
                <span className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                  Избранное
                </span>
                <span className="text-base font-bold text-neutral-900 dark:text-white">
                  {favoritesList.length}
                </span>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-center">
                <span className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                  Ср. балл
                </span>
                <span className="text-base font-bold text-neutral-900 dark:text-white flex items-center justify-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {user.avgScore !== null ? user.avgScore : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Navigation Tabs */}
          <div className="flex gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex-wrap">
            <button
              onClick={() => setActiveTab('ratings')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors ${
                activeTab === 'ratings'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Мои оценки ({ratedAnime.length})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'favorites'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Избранное ({favoritesList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-colors relative ${
                activeTab === 'friends'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Друзья и поиск</span>
              {incomingRequests.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: RATED ANIME WITH FILTERS & GENRE PILLS (Photo 2) */}
      {activeTab === 'ratings' && (
        <div className="space-y-6">
          
          {/* Filter and Sort Toolbar */}
          <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по моим оценкам..."
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium shrink-0">Сортировка:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="px-3 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold cursor-pointer"
                >
                  <option value="my_score_desc">Высшая моя оценка</option>
                  <option value="my_score_asc">Низшая моя оценка</option>
                  <option value="recent_rated">Недавно оцененные</option>
                  <option value="newest">Новизна тайтла</option>
                </select>
              </div>
            </div>

            {/* Score filter buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-neutral-400 font-medium mr-1 shrink-0">Балл:</span>
              {['all', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'].map((sc) => (
                <button
                  key={sc}
                  onClick={() => setSelectedScore(sc)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                    selectedScore === sc
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                  }`}
                >
                  {sc === 'all' ? 'Все' : sc}
                </button>
              ))}
            </div>

            {/* Types Filter */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-transparent text-xs">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 rounded-xl font-medium transition-colors ${
                  selectedType === 'all'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                Все типы
              </button>
              {['Сериал', 'Фильм', 'OVA', 'ONA'].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(selectedType === t ? 'all' : t)}
                  className={`px-3 py-1 rounded-xl font-medium transition-colors ${
                    selectedType === t
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Genre Filter Pills from Home Page (Photo 2) */}
            {genres && genres.length > 0 && (
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Жанры {activeRatedGenres.length > 0 && `(${activeRatedGenres.length})`}
                  </span>
                  {activeRatedGenres.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveRatedGenres([])}
                      className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      Сбросить жанры
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllRatedGenres ? genres : genres.slice(0, 14)).map((g) => {
                    const isSelected = activeRatedGenres.includes(g.name);
                    return (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => {
                          setActiveRatedGenres((prev) =>
                            prev.includes(g.name) ? prev.filter((x) => x !== g.name) : [...prev, g.name]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
                {genres.length > 14 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRatedGenres(!showAllRatedGenres)}
                    className="mt-2 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors block"
                  >
                    {showAllRatedGenres ? 'Свернуть жанры' : `Показать все жанры (${genres.length})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List of Rated Anime */}
          {loading ? (
            <div className="py-20 text-center text-neutral-400 text-xs">
              Загрузка оцененных тайтлов...
            </div>
          ) : ratedAnime.length === 0 ? (
            <div className="py-20 text-center rounded-3xl bg-white dark:bg-[#151518] p-8 shadow-sm">
              <Film className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-3" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Нет оцененных тайтлов
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
                Пока нет аниме, подходящих под выбранные фильтры.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ratedAnime.map((anime) => (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime.id)}
                  className="rounded-3xl bg-white dark:bg-[#151518] p-4 shadow-sm flex gap-4 cursor-pointer hover:shadow-md transition-all"
                >
                  <div className="w-20 aspect-[5/7] rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    <img
                      src={getImageUrl(anime.imageUrl)}
                      alt={anime.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mb-1">
                        {anime.type && <span>{anime.type}</span>}
                        {anime.year && <span>• {anime.year}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {anime.title}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1">
                        {anime.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-transparent">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-neutral-400">Моя оценка:</span>
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${getScoreBadgeClass(anime.myScore)}`}>
                          {anime.myScore} / 10
                        </span>
                      </div>

                      {anime.averageScore !== null && (
                        <div className="flex items-center gap-1 text-neutral-500 text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{anime.averageScore}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FAVORITES WITH GENRE PILLS (Photo 2) */}
      {activeTab === 'favorites' && (
        <div className="space-y-6">
          {/* Favorites Filter / Search */}
          <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={favSearchQuery}
                  onChange={(e) => setFavSearchQuery(e.target.value)}
                  placeholder="Поиск по избранному..."
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                {['all', 'Сериал', 'Фильм', 'OVA', 'ONA'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFavType(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors ${
                      favType === t
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'Все типы' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre Filter Pills in Favorites (Photo 2) */}
            {genres && genres.length > 0 && (
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Жанры {activeFavGenres.length > 0 && `(${activeFavGenres.length})`}
                  </span>
                  {activeFavGenres.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFavGenres([])}
                      className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      Сбросить жанры
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllFavGenres ? genres : genres.slice(0, 14)).map((g) => {
                    const isSelected = activeFavGenres.includes(g.name);
                    return (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => {
                          setActiveFavGenres((prev) =>
                            prev.includes(g.name) ? prev.filter((x) => x !== g.name) : [...prev, g.name]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
                {genres.length > 14 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFavGenres(!showAllFavGenres)}
                    className="mt-2 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors block"
                  >
                    {showAllFavGenres ? 'Свернуть жанры' : `Показать все жанры (${genres.length})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Favorites Grid */}
          {favLoading ? (
            <div className="py-20 text-center text-neutral-400 text-xs">
              Загрузка избранного...
            </div>
          ) : favoritesList.length === 0 ? (
            <div className="py-20 text-center rounded-3xl bg-white dark:bg-[#151518] p-8 shadow-sm">
              <Bookmark className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700 mb-3 opacity-50" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                В избранном пока пусто
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Нажимайте на значок закладки в правом верхнем углу карточки аниме, чтобы сохранить его сюда.
              </p>
              <button
                onClick={() => onNavigate('catalog')}
                className="mt-5 px-5 py-2.5 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Перейти в каталог
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favoritesList.map((anime) => (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime.id)}
                  className="rounded-3xl bg-white dark:bg-[#151518] p-4 flex gap-4 cursor-pointer group hover:bg-neutral-50/80 dark:hover:bg-[#1a1a1f] transition-all relative"
                >
                  <div className="w-20 sm:w-24 aspect-[5/7] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    <img
                      src={getImageUrl(anime.imageUrl)}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                          {anime.type && <span>{anime.type}</span>}
                          {anime.year && <span>• {anime.year}</span>}
                        </div>

                        {/* Remove favorite button */}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveFavorite(e, anime.id)}
                          title="Удалить из избранного"
                          className="p-1 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Bookmark className="w-3.5 h-3.5 fill-current text-neutral-900 dark:text-white hover:text-red-500" />
                        </button>
                      </div>

                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
                        {anime.title}
                      </h4>
                      {anime.originalTitle && (
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {anime.originalTitle}
                        </p>
                      )}
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1">
                        {anime.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-transparent">
                      <div className="flex items-center gap-1.5">
                        {anime.myScore !== null ? (
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${getScoreBadgeClass(anime.myScore)}`}>
                            Моя оценка: {anime.myScore} / 10
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-400">Не оценено</span>
                        )}
                      </div>

                      {anime.averageScore !== null && (
                        <div className="flex items-center gap-1 text-neutral-500 text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{anime.averageScore}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FRIENDS & INCOMING REQUESTS (ACCEPT: GREEN, REJECT: RED) */}
      {activeTab === 'friends' && (
        <div className="space-y-6">
          
          {/* SECTION: INCOMING FRIEND REQUESTS */}
          {incomingRequests.length > 0 && (
            <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  Входящие заявки в друзья ({incomingRequests.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-base flex items-center justify-center shrink-0">
                        {req.user.avatarUrl ? (
                          <img src={req.user.avatarUrl} alt={req.user.nickname} className="w-full h-full object-cover" />
                        ) : (
                          <span>{req.user.nickname ? req.user.nickname.charAt(0).toUpperCase() : 'U'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {req.user.nickname}
                        </h4>
                        <span className="text-[11px] text-neutral-400">
                          {req.user.ratedCount || 0} оценок
                        </span>
                      </div>
                    </div>

                    {/* Green Accept & Red Reject buttons (User Requirement 3) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={actionLoadingId === req.requestId}
                        onClick={() => handleRespondFriendRequest(req.requestId, 'accept')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                        title="Принять заявку"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Принять</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoadingId === req.requestId}
                        onClick={() => handleRespondFriendRequest(req.requestId, 'reject')}
                        className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                        title="Отклонить заявку"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Отклонить</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: MY CONFIRMED FRIENDS */}
          {myFriends.length > 0 && (
            <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
                <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  Мои друзья ({myFriends.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {myFriends.map((fr) => (
                  <div
                    key={fr.id}
                    onClick={() => handleOpenFriend(fr.id)}
                    className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-sm flex items-center justify-center shrink-0">
                        {fr.avatarUrl ? (
                          <img src={fr.avatarUrl} alt={fr.nickname} className="w-full h-full object-cover" />
                        ) : (
                          <span>{fr.nickname ? fr.nickname.charAt(0).toUpperCase() : 'U'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {fr.nickname}
                        </h4>
                        <span className="text-[11px] text-neutral-400">
                          {fr.ratedCount || 0} оценок
                        </span>
                      </div>
                    </div>

                    {fr.avgScore !== null && (
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {fr.avgScore}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: SEARCH USERS & SEND REQUEST */}
          <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                Поиск пользователей клуба
              </h3>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={friendsQuery}
                onChange={(e) => setFriendsQuery(e.target.value)}
                placeholder="Поиск по никнейму..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400"
              />
            </div>

            {/* Users Results */}
            {friendsLoading ? (
              <div className="py-12 text-center text-neutral-400 text-xs">
                Поиск пользователей...
              </div>
            ) : friendsList.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700 mb-2" />
                <p className="text-xs text-neutral-400">
                  Пользователи не найдены.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {friendsList.map((fr) => {
                  const isSelf = fr.id === user.id || fr.friendshipStatus === 'self';
                  const isAccepted = fr.friendshipStatus === 'accepted';
                  const isPendingSent = fr.friendshipStatus === 'pending_sent';
                  const isPendingReceived = fr.friendshipStatus === 'pending_received';

                  return (
                    <div
                      key={fr.id}
                      onClick={() => handleOpenFriend(fr.id)}
                      className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-base flex items-center justify-center shrink-0">
                          {fr.avatarUrl ? (
                            <img src={fr.avatarUrl} alt={fr.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <span>{fr.nickname ? fr.nickname.charAt(0).toUpperCase() : 'U'}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {fr.nickname}
                          </h4>
                          <span className="text-[11px] text-neutral-400 block">
                            {fr.ratedCount} оценок {fr.avgScore ? `• ★ ${fr.avgScore}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Action / Status Button */}
                      <div className="pt-2 border-t border-neutral-200/50 dark:border-neutral-800 flex items-center justify-end">
                        {isSelf ? (
                          <span className="text-[11px] text-neutral-400 font-medium">Это вы</span>
                        ) : isAccepted ? (
                          <span className="text-[11px] text-neutral-600 dark:text-neutral-300 font-semibold flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-neutral-400" />
                            В друзьях
                          </span>
                        ) : isPendingSent ? (
                          <span className="text-[11px] text-neutral-400 font-medium">
                            Заявка отправлена
                          </span>
                        ) : isPendingReceived ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleRespondFriendRequest(fr.requestId, 'accept')}
                              className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition-colors"
                            >
                              Принять
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespondFriendRequest(fr.requestId, 'reject')}
                              className="px-2 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoadingId === fr.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendFriendRequest(fr.id);
                            }}
                            className="px-3 py-1 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[11px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Добавить</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Friend Profile Modal */}
          {selectedFriend && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
              onClick={() => setSelectedFriend(null)}
            >
              <div
                className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-2xl relative space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedFriend(null)}
                  className="absolute right-5 top-5 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>

                {/* Friend Header */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-2xl flex items-center justify-center shrink-0 shadow-md">
                    {selectedFriend.avatarUrl ? (
                      <img src={selectedFriend.avatarUrl} alt={selectedFriend.nickname} className="w-full h-full object-cover" />
                    ) : (
                      <span>{selectedFriend.nickname ? selectedFriend.nickname.charAt(0).toUpperCase() : 'U'}</span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                      {selectedFriend.nickname}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                      <span>{selectedFriend.ratedCount} оценок</span>
                      {selectedFriend.avgScore !== null && (
                        <span className="flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {selectedFriend.avgScore} средняя
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Friend Ratings list */}
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    Оценки друга ({friendRatings.length})
                  </h4>

                  {friendRatings.length === 0 ? (
                    <p className="text-xs text-neutral-400 py-6 text-center">
                      У этого пользователя пока нет оценок.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {friendRatings.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedFriend(null);
                            onSelectAnime(item.id);
                          }}
                          className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 aspect-[5/7] rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0">
                              <img
                                src={getImageUrl(item.imageUrl)}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                              {item.title}
                            </span>
                          </div>

                          <span className={`px-2.5 py-1 rounded-xl font-bold text-xs shrink-0 ${getScoreBadgeClass(item.score)}`}>
                            {item.score} / 10
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
