import React, { useState, useEffect, useCallback } from 'react';
import { User, Settings, Star, Search, Filter, X, ArrowLeft, Film, Users, Calendar, Bookmark, Trash2, Check, UserPlus, UserCheck, Lock, Trophy, Sparkles, Award, ChevronRight, Download, RefreshCw, ExternalLink, HelpCircle, AlertCircle, Ghost, Swords, Gamepad2, Crown, Zap, Eye, EyeOff, Infinity } from 'lucide-react';
import { getScoreBadgeClass } from '../utils/scoreColors';
import { apiUrl, getImageUrl } from '../api';
import { getUserLevel, LEVELS_CONFIG } from '../utils/levels';
import { getStoredHiddenAnimeList, setAnimeHiddenLocally, toggleHiddenAnime } from '../utils/hiddenStorage';
import { getCachedUserRatings, setCachedUserRatings, updateCachedUserRating } from '../utils/profileCache';
import { executeImportWorkflow } from '../utils/importer';
import { deduplicateAnimeList } from '../utils/animeDeduplicator';

function LevelIcon({ iconName, className = 'w-5 h-5' }) {
  switch (iconName) {
    case 'OshiStar':
    case 'Star':
      // Ребёнок идола (Звезда Ай Хосино)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <path d="M6 6l1 1M18 6l-1 1M6 18l1-1M18 18l-1-1" strokeWidth="1.5" />
        </svg>
      );
    case 'SpiritFlame':
    case 'Ghost':
      // Шаман Кинг (Дух-хранитель / Пламя фурёку)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2.5C7.5 5.5 5 9.5 5 14a7 7 0 0 0 14 0c0-3.5-1.5-6.5-4.5-9L12 2.5z" />
          <path d="M12 9c-1.5 1.5-2 3.5-2 5a2 2 0 0 0 4 0c0-1.5-1-3-2-5z" fill="currentColor" fillOpacity="0.2" />
          <circle cx="12" cy="14" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'ChessPawn':
      // Нет игры — нет жизни (Пешка Иманити)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="6" r="3" />
          <path d="M9 10a4 4 0 0 0 6 0" />
          <path d="M10 10.5L9 16h6l-1-5.5" />
          <path d="M7 19h10l1 2H6l1-2z" />
          <path d="M6 21h12" strokeWidth="2" />
        </svg>
      );
    case 'CursedFlash':
    case 'Zap':
      // Магическая битва (Чёрная молния Кокусэн)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M13 2L4 13.5h6.5l-2 8.5 11.5-12.5h-6.5l2.5-9.5z" />
          <path d="M3 3l2 2M19 19l2 2M21 4l-2 2M5 20l-2-2" strokeWidth="1.5" />
        </svg>
      );
    case 'ChessKing':
    case 'BlankBrackets':
    case 'Gamepad2':
      // Нет игры — нет жизни (Шахматный Король Иманити / Фигура Расы)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Top Cross */}
          <path d="M12 2v4M10 4h4" />
          {/* King Crown Dome */}
          <path d="M8 8.5c0-2 1.8-2.5 4-2.5s4 .5 4 2.5c0 1.2-.8 2-1.5 2.5h-5C8.8 10.5 8 9.7 8 8.5z" />
          {/* Collar Ring */}
          <path d="M8.5 11h7" strokeWidth="1.6" />
          {/* Fluted Body */}
          <path d="M9.5 11.5L8 17h8l-1.5-5.5" />
          {/* Tet / Sora Spade Emblem */}
          <path d="M12 13c-.6-.7-1.2-.2-1 .4.2.6 1 1.1 1 1.1s.8-.5 1-1.1c.2-.6-.4-1.1-1-.4z" fill="currentColor" />
          <path d="M12 14.5v1" />
          {/* Stepped Base */}
          <path d="M7 17.5h10" />
          <path d="M5.5 20.5h13" strokeWidth="2" />
        </svg>
      );
    case 'StageSparkles':
    case 'Sparkles':
      // Ребёнок идола (Софиты главной сцены)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2L12 2z" />
          <path d="M18.5 16.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z" />
          <circle cx="5" cy="5" r="1" fill="currentColor" />
        </svg>
      );
    case 'ImanityCrown':
    case 'Crown':
      // Нет игры — нет жизни (Корона Короля Иманити)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 18h18l-2-11-4.5 4L12 4 9.5 11 5 7 3 18z" />
          <path d="M3 20h18" strokeWidth="2" />
          <circle cx="12" cy="4" r="1.2" fill="currentColor" />
          <circle cx="5" cy="7" r="1.2" fill="currentColor" />
          <circle cx="19" cy="7" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'ShamanBlade':
    case 'Swords':
      // Шаман Кинг (Клинок Оверсоула Харусаме и пламя духа Амидамару)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Katana Blade */}
          <path d="M12 2l1.3 2.5v9h-2.6V4.5L12 2z" />
          <line x1="12" y1="3.5" x2="12" y2="13.5" strokeWidth="1" />
          {/* Circular Tsuba Guard */}
          <ellipse cx="12" cy="14" rx="4.8" ry="1.5" strokeWidth="1.8" />
          {/* Wrapped Tsuka Handle */}
          <path d="M10.8 15.5v5.5h2.4v-5.5" />
          <line x1="10.8" y1="17.3" x2="13.2" y2="17.3" strokeWidth="1.2" />
          <line x1="10.8" y1="19.3" x2="13.2" y2="19.3" strokeWidth="1.2" />
          <path d="M10 21.5h4" strokeWidth="1.6" />
          {/* Amidamaru Over Soul Spirit Flame */}
          <path d="M7 11.5c-1-3 1.5-6.5 5-8.5 0 2.5-1 4.5 1 5.5s3 3 2 5c-1 2-3 2.5-4 2.5-2.5 0-4-2-4-4.5z" strokeWidth="1.4" opacity="0.6" />
          <circle cx="12" cy="9.5" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'SixEyes':
    case 'Eye':
      // Магическая битва (Шесть Глаз Рикуган Сатору Годзё)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20" strokeWidth="1.5" />
        </svg>
      );
    case 'LimitlessVoid':
    case 'Infinity':
      // Магическая битва (Необъятная бездна Бесконечность)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
          <circle cx="12" cy="12" r="9.5" strokeDasharray="2 3" strokeWidth="1.2" />
        </svg>
      );
    default:
      return <Award className={className} />;
  }
}

export default function ProfilePage({
  user,
  genres = [],
  initialTab = 'ratings',
  onNavigate,
  onSelectAnime,
  onRateAnime,
  onToggleFavorite,
  onToggleHide
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'ratings');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Rated anime state
  const [ratedAnime, setRatedAnime] = useState(() => getCachedUserRatings(user?.id) || []);
  const [loading, setLoading] = useState(() => (getCachedUserRatings(user?.id)?.length > 0 ? false : true));
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

  // Hidden ('Не интересует') state
  const [hiddenList, setHiddenList] = useState([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [hiddenSearchQuery, setHiddenSearchQuery] = useState('');
  const [hiddenType, setHiddenType] = useState('all');

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
  const [friendScoreFilter, setFriendScoreFilter] = useState('top5');
  const [friendGenreFilter, setFriendGenreFilter] = useState('all');
  const [showLevelsModal, setShowLevelsModal] = useState(false);

  // Custom User Top-5 State (max 5 items, Photo 1 & Photo 2)
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

  // Multi-Platform Import state (Shikimori, AnimeLib, AnimeGO, raw list)
  const [showImportModal, setShowImportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importPlatform, setImportPlatform] = useState('shikimori'); // 'shikimori' | 'animelib' | 'animego' | 'raw'
  const [importInput, setImportInput] = useState('');
  const [importRawContent, setImportRawContent] = useState('');
  const [importActiveSubTab, setImportActiveSubTab] = useState('link'); // 'link' | 'raw'
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const getPlatformLabel = (p) => {
    switch (p) {
      case 'shikimori': return 'Shikimori';
      case 'animelib': return 'AnimeLib';
      case 'animego': return 'AnimeGO';
      default: return 'Свой список';
    }
  };

  const handleInitiateImport = () => {
    setImportError(null);
    const hasInput = Boolean(importInput && importInput.trim());
    const hasRaw = Boolean(importRawContent && importRawContent.trim());

    if (!hasInput && !hasRaw) {
      setImportError('Пожалуйста, укажите ссылку на профиль или вставьте данные для импорта');
      return;
    }

    // Ask user confirmation before starting import (Photo 1)
    setShowConfirmModal(true);
  };

  const handleExecuteImport = async () => {
    setShowConfirmModal(false);
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      const token = localStorage.getItem('anime_auth_token');
      if (!token) throw new Error('Требуется авторизация в профиле');

      const isRawMode = importActiveSubTab === 'raw' || importPlatform === 'raw';
      const result = await executeImportWorkflow({
        platform: isRawMode ? 'raw' : importPlatform,
        input: importInput.trim(),
        rawContent: importRawContent.trim(),
        token,
        userId: user?.id
      });

      setImportResult(result);
      fetchRated();
    } catch (err) {
      console.error('Import error:', err);
      let msg = err.message || 'Ошибка анализа профиля';
      if (msg.includes('Unexpected token') || msg.includes('<!DOCTYPE') || msg.includes('is not valid JSON')) {
        msg = 'Сервер обновляется или защищён от прямых запросов. Пожалуйста, скопируйте текст страницы профиля (Ctrl+A, Ctrl+C) и вставьте в поле «Код / текст страницы».';
      }
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  };

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
        let items = deduplicateAnimeList(data.items || []);
        if (selectedScore === 'top5') {
          items = items.filter((it) => myTop5Ids.includes(it.id));
        } else if (selectedScore !== 'all') {
          items = items.filter((it) => it.myScore === parseInt(selectedScore, 10));
        }
        setRatedAnime(items);
        if (!searchQuery.trim() && selectedType === 'all' && activeRatedGenres.length === 0 && selectedScore === 'all') {
          setCachedUserRatings(user?.id, items);
        }
      }
    } catch (err) {
      console.error('Error fetching rated anime:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortOption, selectedType, activeRatedGenres, selectedScore, myTop5Ids]);

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
        setFavoritesList(deduplicateAnimeList(data.items || []));
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

  // Fetch hidden anime ('Не интересует')
  const fetchHidden = useCallback(async () => {
    setHiddenLoading(true);
    try {
      // 1. Instantly load from local storage
      const localList = deduplicateAnimeList(getStoredHiddenAnimeList(user?.id));
      if (localList.length > 0) {
        setHiddenList(localList);
      }

      const token = localStorage.getItem('anime_auth_token');
      if (token) {
        const params = new URLSearchParams();
        if (hiddenSearchQuery.trim()) params.append('search', hiddenSearchQuery.trim());
        if (hiddenType !== 'all') params.append('type', hiddenType);

        const res = await fetch(apiUrl(`/api/user/hidden?${params.toString()}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const serverItems = deduplicateAnimeList(data.items || []);
          setHiddenList(serverItems);
          serverItems.forEach((it) => setAnimeHiddenLocally(it, true, user?.id));
        }
      }
    } catch (err) {
      console.error('Error fetching hidden anime:', err);
    } finally {
      setHiddenLoading(false);
    }
  }, [hiddenSearchQuery, hiddenType, user?.id]);

  useEffect(() => {
    if (activeTab === 'hidden') {
      fetchHidden();
    }
  }, [activeTab, fetchHidden]);

  // Quick remove from hidden ('Не интересует') — restores to catalog
  const handleRemoveHidden = async (e, anime) => {
    e.stopPropagation();
    const token = localStorage.getItem('anime_auth_token');
    setHiddenList((prev) => prev.filter((it) => it.id !== anime.id));
    await toggleHiddenAnime(anime, token, user?.id);
    if (onToggleHide) {
      onToggleHide(anime.id, false);
    }
  };

  // Quick delete rating directly from profile card (Photo 2)
  const handleDeleteRating = async (e, animeId) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('anime_auth_token');
      if (!token) return;

      // Optimistically remove from state and update cache
      setRatedAnime((prev) => prev.filter((it) => it.id !== animeId));
      updateCachedUserRating(user?.id, animeId, null);

      if (onRateAnime) {
        onRateAnime(animeId, null);
      } else {
        await fetch(apiUrl(`/api/anime/${animeId}/rate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ score: null })
        });
      }
    } catch (err) {
      console.error('Error deleting rating:', err);
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
      } else {
        setFriendsList([]);
      }
    } catch (err) {
      console.error('Error searching friends:', err);
      setFriendsList([]);
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

  // Sync user Top-5 from server
  useEffect(() => {
    if (!user?.id) return;
    const fetchTop5 = async () => {
      try {
        const token = localStorage.getItem('anime_auth_token');
        if (!token) return;

        let localSaved = [];
        try {
          const raw = localStorage.getItem('anilex_top5_' + user.id);
          if (raw) localSaved = JSON.parse(raw);
        } catch (e) {}

        const res = await fetch(apiUrl('/api/user/top5'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          let ids = Array.isArray(data.top5Ids) ? data.top5Ids : [];

          // If server top5 is empty but client has saved top5, sync client to server
          if (ids.length === 0 && localSaved.length > 0) {
            await fetch(apiUrl('/api/user/top5/set'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ animeIds: localSaved.slice(0, 5) })
            }).catch(() => {});
            ids = localSaved;
          }

          if (user?.nickname === 'MrTech' || user?.id === 20) {
            if (!ids.includes(7170)) ids.unshift(7170);
          }
          if (user?.nickname === 'Venicek' || user?.id === 21) {
            ids = ids.filter((id) => id !== 7170);
          }
          const finalTop5 = ids.slice(0, 5);
          setMyTop5Ids(finalTop5);
          localStorage.setItem('anilex_top5_' + user.id, JSON.stringify(finalTop5));
        }
      } catch (err) {
        console.warn('Error fetching top 5:', err);
      }
    };
    fetchTop5();
  }, [user?.id, user?.nickname]);

  // Toggle Top-5 for current user (Max 5 allowed - Photo 1 & 2)
  const handleToggleTop5 = async (e, anime) => {
    e.stopPropagation();
    const animeId = anime.id;
    const isMrTech = user?.nickname === 'MrTech' || user?.id === 20;

    // For MrTech: cannot unpin Lemon Girls (Photo 2 & 3)
    if (isMrTech && (animeId === 7170 || anime.title === 'Лимонные девочки')) {
      setTop5Toast('Этот тайтл закреплен навсегда и его нельзя снять');
      setTimeout(() => setTop5Toast(null), 3000);
      return;
    }

    const isAlreadyIn = myTop5Ids.includes(animeId);
    if (isAlreadyIn) {
      const updated = myTop5Ids.filter((id) => id !== animeId);
      setMyTop5Ids(updated);
      localStorage.setItem('anilex_top5_' + user?.id, JSON.stringify(updated));
      setTop5Toast(`«${anime.title}» убран из Топ-5`);
      setTimeout(() => setTop5Toast(null), 2500);

      try {
        const token = localStorage.getItem('anime_auth_token');
        if (token) {
          fetch(apiUrl('/api/user/top5/toggle'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ animeId })
          }).catch(() => {});
        }
      } catch (err) {}
    } else {
      if (myTop5Ids.length >= 5) {
        setTop5Toast('В Топ-5 можно добавить только 5 аниме, больше нельзя!');
        setTimeout(() => setTop5Toast(null), 3000);
        return;
      }
      const updated = [...myTop5Ids, animeId];
      setMyTop5Ids(updated);
      localStorage.setItem('anilex_top5_' + user?.id, JSON.stringify(updated));
      setTop5Toast(`«${anime.title}» добавлен в Топ-5 (${updated.length}/5)`);
      setTimeout(() => setTop5Toast(null), 2500);

      try {
        const token = localStorage.getItem('anime_auth_token');
        if (token) {
          fetch(apiUrl('/api/user/top5/toggle'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ animeId })
          }).catch(() => {});
        }
      } catch (err) {}
    }
  };

  // Load friend public profile
  const handleOpenFriend = async (friendId) => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/users/${friendId}/profile`), { headers });
      if (res.ok) {
        const data = await res.json();
        setSelectedFriend(data.user);
        let ratings = data.ratings || [];

        // Strictly purge Lemon Girls from Venicek (Photo 1)
        if (data.user?.nickname === 'Venicek' || data.user?.id === 21 || friendId === 21) {
          ratings = ratings.filter((r) => r.title !== 'Лимонные девочки' && r.id !== 7170 && !r.isSecretTop);
        }

        // For MrTech (id: 20): always guarantee Lemon Girls with 10/10 is pinned at index 0 (Photo 2 & 3)
        if (data.user?.nickname === 'MrTech' || data.user?.id === 20 || friendId === 20) {
          ratings = ratings.filter((r) => r.title !== 'Лимонные девочки' && r.id !== 7170);
          ratings.unshift({
            id: 7170,
            slug: 'shiki-82476',
            title: 'Лимонные девочки',
            imageUrl: 'https://cdn.myanimelist.net/images/anime/2/82476l.jpg',
            type: 'OVA',
            year: '2016',
            genres: ['Хентай'],
            score: 10,
            isSecretTop: true,
            isPinned: true,
            isPermanentPin: true,
            updatedAt: new Date().toISOString()
          });
        }

        // Retrieve top5Ids for friend from data or localStorage
        let friendTop5 = Array.isArray(data.top5Ids) ? data.top5Ids : [];
        if (friendTop5.length === 0) {
          try {
            const saved = localStorage.getItem('anilex_top5_' + (data.user?.id || friendId));
            if (saved) friendTop5 = JSON.parse(saved);
          } catch (e) {}
        }
        if (friendTop5.length === 0 && Array.isArray(ratings)) {
          friendTop5 = ratings.filter((r) => r.isPinned).map((r) => r.id);
        }
        if (data.user?.nickname === 'MrTech' || data.user?.id === 20 || friendId === 20) {
          if (!friendTop5.includes(7170)) friendTop5.unshift(7170);
        }
        if (data.user?.nickname === 'Venicek' || data.user?.id === 21 || friendId === 21) {
          friendTop5 = friendTop5.filter((id) => id !== 7170);
        }

        ratings = ratings.map((r) => ({
          ...r,
          isPinned: Boolean(
            r.isPinned ||
            r.isPermanentPin ||
            (r.isSecretTop && (data.user?.nickname === 'MrTech' || friendId === 20)) ||
            friendTop5.includes(r.id)
          )
        }));

        setFriendRatings(ratings);
        setFriendScoreFilter('top5');
        setFriendGenreFilter('all');
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
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-5 relative z-20">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              {/* Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-3xl font-bold flex items-center justify-center shrink-0 shadow-2xl ring-4 ring-white dark:ring-[#151518] relative z-20">
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

          {/* Otaku Level & Progression Card */}
          {(() => {
            const ratedCount = user ? (user.ratedCount ?? ratedAnime.length) : 0;
            const userLevelData = getUserLevel(ratedCount);

            return (
              <div className="mb-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${userLevelData.currentLevel.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
                    <LevelIcon iconName={userLevelData.currentLevel.iconName} className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        Уровень {userLevelData.currentLevel.level}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${userLevelData.currentLevel.bgBadge} flex items-center gap-1.5`}>
                        <LevelIcon iconName={userLevelData.currentLevel.iconName} className="w-3.5 h-3.5" />
                        <span>{userLevelData.currentLevel.title}</span>
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                      {userLevelData.currentLevel.description}
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-64 shrink-0 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                      {userLevelData.isMaxLevel ? (
                        'Максимальный ранг!'
                      ) : (
                        `До след. уровня: еще ${userLevelData.neededForNext} ${userLevelData.neededForNext === 1 ? 'оценка' : userLevelData.neededForNext < 5 ? 'оценки' : 'оценок'}`
                      )}
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      {userLevelData.progressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${userLevelData.currentLevel.barColor} transition-all duration-500`}
                      style={{ width: `${userLevelData.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowLevelsModal(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 transition-colors shadow-sm flex items-center gap-1.5 justify-center flex-1 md:flex-initial"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Уровни и ранги</span>
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(true);
                      setImportResult(null);
                      setImportError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md flex items-center gap-1.5 justify-center flex-1 md:flex-initial"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Импорт оценок</span>
                  </button>
                </div>
              </div>
            );
          })()}

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
              onClick={() => setActiveTab('hidden')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'hidden'
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                  : 'text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Не интересует ({hiddenList.length})</span>
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
              <button
                type="button"
                onClick={() => setSelectedScore(selectedScore === 'top5' ? 'all' : 'top5')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1 ${
                  selectedScore === 'top5'
                    ? 'bg-amber-500 text-white shadow-sm font-bold'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                }`}
              >
                <span>📌 Топ-5</span>
                <span className="text-[10px] opacity-90">({myTop5Ids.length}/5)</span>
              </button>
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
                {selectedScore === 'top5' ? 'В Топ-5 пока ничего не закреплено' : 'Нет оцененных тайтлов'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
                {selectedScore === 'top5'
                  ? 'Вы можете закрепить до 5 любимых тайтлов кнопкой «+ Топ-5» в списке ваших оценок.'
                  : 'Пока нет аниме, подходящих под выбранные фильтры.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ratedAnime.map((anime) => (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime.id)}
                  className="rounded-3xl bg-white dark:bg-[#151518] p-4 shadow-sm flex gap-4 cursor-pointer hover:shadow-md transition-all group relative"
                >
                  <div className="w-20 aspect-[5/7] rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
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
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mb-1">
                        {anime.type && <span>{anime.type}</span>}
                        {anime.year && <span>• {anime.year}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
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

                        {/* Quick Top-5 Pin Button (Photo 1 & 2) */}
                        {(() => {
                          const isInTop5 = myTop5Ids.includes(anime.id);
                          const isMrTechPermanent = (user?.nickname === 'MrTech' || user?.id === 20) && (anime.id === 7170 || anime.title === 'Лимонные девочки');
                          return (
                            <button
                              type="button"
                              onClick={(e) => handleToggleTop5(e, anime)}
                              title={
                                isMrTechPermanent
                                  ? 'Закреплено навсегда (нельзя снять)'
                                  : isInTop5
                                  ? 'Убрать из Топ-5'
                                  : 'Закрепить в Топ-5 (макс. 5)'
                              }
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ml-1 ${
                                isMrTechPermanent
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-not-allowed opacity-90'
                                  : isInTop5
                                  ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 font-bold'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700'
                              }`}
                            >
                              <span>📌</span>
                              <span className="text-[10px]">
                                {isInTop5 ? 'В Топ-5' : '+ Топ-5'}
                              </span>
                            </button>
                          );
                        })()}

                        {/* Quick Delete Rating on Hover (Photo 2) */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRating(e, anime.id)}
                          title="Удалить оценку"
                          className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all ml-0.5 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* TAB: HIDDEN ANIME ("Не интересует") */}
      {activeTab === 'hidden' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Search & Type filter bar */}
          <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={hiddenSearchQuery}
                  onChange={(e) => setHiddenSearchQuery(e.target.value)}
                  placeholder="Поиск по скрытым тайтлам..."
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                {['all', 'Сериал', 'Фильм', 'OVA', 'ONA'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setHiddenType(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors ${
                      hiddenType === t
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'Все типы' : t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List of Hidden Anime */}
          {hiddenLoading && hiddenList.length === 0 ? (
            <div className="py-20 text-center text-neutral-400 text-xs">
              Загрузка скрытых тайтлов...
            </div>
          ) : hiddenList.length === 0 ? (
            <div className="py-20 text-center rounded-3xl bg-white dark:bg-[#151518] p-8 shadow-sm">
              <EyeOff className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700 mb-3 opacity-50" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Список «Не интересует» пуст
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Тайтлы, которые вы помечаете значком перечёркнутого глаза, будут сохраняться здесь и скрываться с главной страницы.
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
              {hiddenList
                .filter((anime) => {
                  if (hiddenType !== 'all' && anime.type !== hiddenType) return false;
                  if (hiddenSearchQuery.trim()) {
                    const q = hiddenSearchQuery.toLowerCase();
                    const titleMatch = (anime.title || '').toLowerCase().includes(q);
                    const origMatch = (anime.originalTitle || '').toLowerCase().includes(q);
                    return titleMatch || origMatch;
                  }
                  return true;
                })
                .map((anime) => (
                  <div
                    key={anime.id}
                    onClick={() => onSelectAnime(anime.id)}
                    className="rounded-3xl bg-white dark:bg-[#151518] p-4 flex gap-4 cursor-pointer group hover:bg-neutral-50/80 dark:hover:bg-[#1a1a1f] transition-all relative border border-neutral-200/50 dark:border-neutral-800/60"
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

                          {/* Restore / Unhide button */}
                          <button
                            type="button"
                            onClick={(e) => handleRemoveHidden(e, anime)}
                            title="Убрать из скрытых (вернуть в каталог)"
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-50 dark:bg-rose-950/40 transition-all flex items-center gap-1 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Вернуть</span>
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
                          {anime.myScore !== null && anime.myScore !== undefined ? (
                            <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${getScoreBadgeClass(anime.myScore)}`}>
                              Моя оценка: {anime.myScore} / 10
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-500/80 font-medium">Скрыто из каталога</span>
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
                          {(() => {
                            const frLevel = getUserLevel(fr.ratedCount || 0);
                            return (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${frLevel.currentLevel.bgBadge}`}>
                                  <LevelIcon iconName={frLevel.currentLevel.iconName} className="w-3 h-3" />
                                  <span>Ур. {frLevel.currentLevel.level}</span>
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  {fr.ratedCount || 0} {fr.avgScore ? `• ★ ${fr.avgScore}` : ''}
                                </span>
                              </div>
                            );
                          })()}
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
                className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151518] shadow-2xl relative border border-neutral-200/60 dark:border-neutral-800"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Friend Custom Banner */}
                <div className="relative h-36 sm:h-48 w-full bg-neutral-200 dark:bg-neutral-800 shrink-0 overflow-hidden">
                  {selectedFriend.bannerUrl ? (
                    <img
                      src={selectedFriend.bannerUrl}
                      alt="Баннер профиля"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-neutral-800 via-neutral-900 to-neutral-800 flex items-center justify-center text-neutral-600">
                      <span className="text-xs font-medium uppercase tracking-widest opacity-40">
                        Томодачи Профиль
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none" />

                  {/* Close button inside banner */}
                  <button
                    type="button"
                    onClick={() => setSelectedFriend(null)}
                    className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-colors z-30"
                  >
                    ✕
                  </button>
                </div>

                {/* Friend Content */}
                <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 space-y-6 relative z-10">
                  {/* Friend Header with Avatar overlapping banner */}
                  <div className="flex items-end justify-between gap-4 -mt-12 sm:-mt-16 relative z-20">
                    <div className="flex items-end gap-4">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-2xl ring-4 ring-white dark:ring-[#151518] relative z-20">
                        {selectedFriend.avatarUrl ? (
                          <img src={selectedFriend.avatarUrl} alt={selectedFriend.nickname} className="w-full h-full object-cover" />
                        ) : (
                          <span>{selectedFriend.nickname ? selectedFriend.nickname.charAt(0).toUpperCase() : 'U'}</span>
                        )}
                      </div>

                      <div className="mb-1.5">
                        <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                          {selectedFriend.nickname}
                        </h3>
                        {(() => {
                          const fl = getUserLevel(selectedFriend.ratedCount || 0);
                          return (
                            <div className="flex items-center gap-2.5 text-xs text-neutral-400 mt-1 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${fl.currentLevel.bgBadge} flex items-center gap-1.5`}>
                                <LevelIcon iconName={fl.currentLevel.iconName} className="w-3.5 h-3.5" />
                                <span>{fl.currentLevel.title}</span>
                                <span className="opacity-75">· Ур. {fl.currentLevel.level}</span>
                              </span>
                              <span>{selectedFriend.ratedCount || 0} оценок</span>
                              {selectedFriend.isFriend && selectedFriend.avgScore !== null && (
                                <span className="flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  {selectedFriend.avgScore} средняя
                                </span>
                              )}
                              {!selectedFriend.isFriend && (
                                <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>Оценки скрыты</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                {/* Friend Otaku Level Card */}
                {(() => {
                  const fl = getUserLevel(selectedFriend.ratedCount || 0);
                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${fl.currentLevel.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                          <LevelIcon iconName={fl.currentLevel.iconName} className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                              Уровень {fl.currentLevel.level}
                            </span>
                            {fl.currentLevel.franchise && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                                {fl.currentLevel.franchise}
                              </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-neutral-200/40 dark:bg-neutral-800/60 text-neutral-500 font-medium">
                              {selectedFriend.ratedCount || 0} {(selectedFriend.ratedCount || 0) === 1 ? 'оценка' : (selectedFriend.ratedCount || 0) < 5 ? 'оценки' : 'оценок'}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                            {fl.currentLevel.title}
                          </h4>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            {fl.currentLevel.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Friend Ratings list or Privacy Lock */}
                {!selectedFriend.isFriend ? (
                  <div className="py-8 px-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/80 flex items-center justify-center mx-auto text-neutral-500">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Оценки доступны только взаимным друзьям
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                        Добавьте {selectedFriend.nickname} в друзья. Как только запрос будет подтверждён, откроются все оценки и статистика.
                      </p>
                    </div>
                    <div className="pt-2 flex justify-center">
                      {selectedFriend.friendshipStatus === 'accepted' ? (
                        <span className="px-4 py-2 rounded-2xl bg-emerald-500/10 text-emerald-500 text-xs font-semibold flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4" />
                          В друзьях
                        </span>
                      ) : selectedFriend.friendshipStatus === 'pending_sent' ? (
                        <span className="px-4 py-2 rounded-2xl bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-semibold">
                          Запрос отправлен
                        </span>
                      ) : selectedFriend.friendshipStatus === 'pending_received' ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await handleRespondFriendRequest(selectedFriend.requestId, 'accept');
                              handleOpenFriend(selectedFriend.id);
                            }}
                            className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                          >
                            Принять запрос
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await handleRespondFriendRequest(selectedFriend.requestId, 'reject');
                              setSelectedFriend(null);
                            }}
                            className="px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
                          >
                            Отклонить
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await handleSendFriendRequest(selectedFriend.id);
                            setSelectedFriend((prev) => ({ ...prev, friendshipStatus: 'pending_sent' }));
                          }}
                          className="px-5 py-2.5 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Добавить в друзья</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const isMrTechProfile = selectedFriend?.nickname === 'MrTech' || selectedFriend?.id === 20;
                      const isVenicekProfile = selectedFriend?.nickname === 'Venicek' || selectedFriend?.id === 21;

                      // Strict cleanse for Venicek (Photo 1)
                      let cleanFriendRatings = friendRatings;
                      if (isVenicekProfile) {
                        cleanFriendRatings = cleanFriendRatings.filter(
                          (item) => item.title !== 'Лимонные девочки' && item.id !== 7170 && !item.isSecretTop
                        );
                      }

                      // Sort with pinned items always at the very top (Photo 1 & 2)
                      const sortedFriendRatings = [...cleanFriendRatings].sort((a, b) => {
                        const aPinned = (a.isPinned || (isMrTechProfile && (a.isSecretTop || a.title === 'Лимонные девочки'))) ? 1 : 0;
                        const bPinned = (b.isPinned || (isMrTechProfile && (b.isSecretTop || b.title === 'Лимонные девочки'))) ? 1 : 0;
                        if (aPinned !== bPinned) return bPinned - aPinned;
                        return (b.score || 0) - (a.score || 0);
                      });

                      const availableScores = Array.from(
                        new Set(friendRatings.map((item) => item.score))
                      ).sort((a, b) => b - a);

                      const availableGenres = Array.from(
                        new Set(friendRatings.flatMap((item) => (Array.isArray(item.genres) ? item.genres : [])))
                      ).sort((a, b) => a.localeCompare(b, 'ru'));

                      let filteredByGenre = sortedFriendRatings;
                      if (friendGenreFilter !== 'all') {
                        filteredByGenre = filteredByGenre.filter((item) =>
                          Array.isArray(item.genres) && item.genres.includes(friendGenreFilter)
                        );
                      }

                      let displayedRatings = [];
                      if (friendScoreFilter === 'top5') {
                        // STRICTLY ONLY pinned items in Top-5! Do not fill with random 10s!
                        displayedRatings = filteredByGenre.filter((item) =>
                          Boolean(item.isPinned || (isMrTechProfile && (item.isSecretTop || item.title === 'Лимонные девочки')))
                        ).slice(0, 5);
                      } else if (friendScoreFilter === 'all') {
                        displayedRatings = filteredByGenre;
                      } else {
                        const targetScore = parseInt(friendScoreFilter, 10);
                        displayedRatings = filteredByGenre.filter(
                          (item) => item.score === targetScore
                        );
                      }

                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                {friendScoreFilter === 'top5'
                                  ? 'Топ-5 лучших тайтлов'
                                  : friendScoreFilter === 'all'
                                  ? `Все оценки (${filteredByGenre.length})`
                                  : `Оценка ${friendScoreFilter} / 10 (${displayedRatings.length})`}
                              </h4>
                              {friendGenreFilter !== 'all' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold">
                                  {friendGenreFilter}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-400">
                              {friendScoreFilter === 'top5'
                                ? `Закреплено ${displayedRatings.length} из 5`
                                : `Показано ${displayedRatings.length} из ${filteredByGenre.length}`}
                            </span>
                          </div>

                          {/* Filter Chips by Score */}
                          {friendRatings.length > 0 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                              <button
                                type="button"
                                onClick={() => setFriendScoreFilter('top5')}
                                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                                  friendScoreFilter === 'top5'
                                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                              >
                                <span>📌 Топ-5</span>
                                <span className="text-[10px] opacity-75">
                                  ({cleanFriendRatings.filter(it => it.isPinned || (isMrTechProfile && (it.isSecretTop || it.title === 'Лимонные девочки'))).length}/5)
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFriendScoreFilter('all')}
                                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                                  friendScoreFilter === 'all'
                                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                              >
                                Все ({filteredByGenre.length})
                              </button>
                              {availableScores.map((sc) => {
                                const count = filteredByGenre.filter((it) => it.score === sc).length;
                                if (count === 0 && friendGenreFilter !== 'all') return null;
                                return (
                                  <button
                                    key={sc}
                                    type="button"
                                    onClick={() => setFriendScoreFilter(String(sc))}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                                      friendScoreFilter === String(sc)
                                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                    }`}
                                  >
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>{sc}</span>
                                    <span className="text-[10px] opacity-70">({count})</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Filter Chips by Genre */}
                          {availableGenres.length > 0 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                              <span className="text-[11px] font-medium text-neutral-400 pl-0.5 shrink-0">Жанры:</span>
                              <button
                                type="button"
                                onClick={() => setFriendGenreFilter('all')}
                                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                                  friendGenreFilter === 'all'
                                    ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900'
                                    : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                              >
                                Все
                              </button>
                              {availableGenres.map((genre) => {
                                const count = friendRatings.filter((it) =>
                                  Array.isArray(it.genres) && it.genres.includes(genre)
                                ).length;
                                return (
                                  <button
                                    key={genre}
                                    type="button"
                                    onClick={() => setFriendGenreFilter(genre === friendGenreFilter ? 'all' : genre)}
                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
                                      friendGenreFilter === genre
                                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-xs'
                                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                    }`}
                                  >
                                    <span>{genre}</span>
                                    <span className="text-[9px] opacity-70">{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {friendRatings.length === 0 ? (
                            <p className="text-xs text-neutral-400 py-6 text-center">
                              У этого пользователя пока нет оценок.
                            </p>
                          ) : displayedRatings.length === 0 ? (
                            <div className="py-10 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 p-6 border border-neutral-100 dark:border-neutral-800/60">
                              <p className="text-xs text-neutral-400">
                                {friendScoreFilter === 'top5'
                                  ? 'Пользователь пока не закрепил тайтлы в Топ-5.'
                                  : 'Тайтлы с выбранными фильтрами не найдены.'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                              {displayedRatings.map((item) => (
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
                                    <div className="min-w-0">
                                      <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate block">
                                        {item.title}
                                      </span>
                                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5 flex-wrap">
                                        {item.year && <span>{item.year}</span>}
                                        {Array.isArray(item.genres) &&
                                          item.genres.slice(0, 2).map((g) => (
                                            <span
                                              key={g}
                                              className={`text-[10px] px-1 py-0.2 rounded ${
                                                friendGenreFilter === g
                                                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                                                  : 'text-neutral-400'
                                              }`}
                                            >
                                              • {g}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {(item.isPinned || (isMrTechProfile && (item.isSecretTop || item.title === 'Лимонные девочки'))) && (
                                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1 border border-amber-500/30">
                                        📌 Закреплено
                                      </span>
                                    )}
                                    <span className={`px-2.5 py-1 rounded-xl font-bold text-xs ${getScoreBadgeClass(item.score)}`}>
                                      {item.score} / 10
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Otaku Levels & Rewards Modal */}
      {showLevelsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowLevelsModal(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-2xl relative space-y-6 border border-neutral-200/60 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLevelsModal(false)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500 mb-1">
                <Trophy className="w-4 h-4" />
                <span>Система рангов Отаку</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Ранги Отаку Томодачи
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Оценивайте любимые тайтлы от 0 до 10, повышайте свой ранг отаку и открывайте эксклюзивные титулы и бейджи сообщества.
              </p>
            </div>

            {/* Current User Level Banner */}
            {(() => {
              const ratedCount = user ? (user.ratedCount ?? ratedAnime.length) : 0;
              const userLevelData = getUserLevel(ratedCount);

              return (
                <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-14 h-14 rounded-2xl ${userLevelData.currentLevel.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
                        <LevelIcon iconName={userLevelData.currentLevel.iconName} className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                            Уровень {userLevelData.currentLevel.level}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                            Ваш текущий ранг
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                          {userLevelData.currentLevel.title}
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Оценено: <strong className="text-neutral-800 dark:text-neutral-200">{userLevelData.count}</strong> тайтлов
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      {!userLevelData.isMaxLevel ? (
                        <div>
                          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                            До уровня {userLevelData.nextLevel.level}: <strong className="text-neutral-900 dark:text-white">{userLevelData.neededForNext}</strong> {userLevelData.neededForNext === 1 ? 'оценка' : userLevelData.neededForNext < 5 ? 'оценки' : 'оценок'}
                          </span>
                          <div className="w-full sm:w-48 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mt-1.5 ml-auto">
                            <div
                              className={`h-full rounded-full ${userLevelData.currentLevel.barColor}`}
                              style={{ width: `${userLevelData.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                          Максимальный божественный уровень!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Levels Roadmap List */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Все уровни гильдии ({LEVELS_CONFIG.length})
              </h3>

              <div className="space-y-3">
                {(() => {
                  const ratedCount = user ? (user.ratedCount ?? ratedAnime.length) : 0;
                  const userLevelData = getUserLevel(ratedCount);

                  return LEVELS_CONFIG.map((tier) => {
                    const isCurrent = tier.level === userLevelData.currentLevel.level;
                    const isUnlocked = userLevelData.count >= tier.minCount;
                    const remainingToUnlock = Math.max(0, tier.minCount - userLevelData.count);

                    return (
                      <div
                        key={tier.level}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isCurrent
                            ? 'bg-neutral-50 dark:bg-neutral-900/90 border-neutral-400/50 shadow-md ring-1 ring-neutral-400/30'
                            : isUnlocked
                            ? 'bg-white dark:bg-[#18181b] border-neutral-200/70 dark:border-neutral-800'
                            : 'bg-neutral-50/50 dark:bg-neutral-900/30 border-neutral-200/40 dark:border-neutral-800/40 opacity-75'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3.5">
                            <div className={`w-11 h-11 rounded-2xl ${tier.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                              <LevelIcon iconName={tier.iconName} className="w-5 h-5" />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                  Ур. {tier.level}
                                </span>
                                <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                                  {tier.title}
                                </h4>
                                {tier.franchise && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                                    {tier.franchise}
                                  </span>
                                )}
                                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-medium">
                                  {tier.minCount === 0 ? '0-4 оценок' : tier.maxCount > 1000 ? `${tier.minCount}+ оценок` : `${tier.minCount}-${tier.maxCount} оценок`}
                                </span>
                              </div>

                              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                {tier.description}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="sm:self-center shrink-0">
                            {isCurrent ? (
                              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 fill-current" />
                                <span>Текущий ранг</span>
                              </span>
                            ) : isUnlocked ? (
                              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" />
                                <span>Получено</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Еще {remainingToUnlock} {remainingToUnlock === 1 ? 'оценка' : remainingToUnlock < 5 ? 'оценки' : 'оценок'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Platform Import Modal (Shikimori, AnimeLib, AnimeGO, Custom) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Импорт оценок
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Перенос оценок и списков со сторонних сайтов в ваш профиль
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Platform Selector Tabs */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Выберите источник:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportPlatform('shikimori');
                      setImportError(null);
                      setImportResult(null);
                    }}
                    className={`p-2.5 rounded-2xl text-xs font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      importPlatform === 'shikimori'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="font-extrabold text-[13px]">Shikimori</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-300 font-medium">
                      API прямой
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportPlatform('animelib');
                      setImportError(null);
                      setImportResult(null);
                    }}
                    className={`p-2.5 rounded-2xl text-xs font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      importPlatform === 'animelib'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="font-extrabold text-[13px]">AnimeLib</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-medium">
                      v5.animelib
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportPlatform('animego');
                      setImportError(null);
                      setImportResult(null);
                    }}
                    className={`p-2.5 rounded-2xl text-xs font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      importPlatform === 'animego'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="font-extrabold text-[13px]">AnimeGO</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-medium">
                      animego.me
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportPlatform('raw');
                      setImportActiveSubTab('raw');
                      setImportError(null);
                      setImportResult(null);
                    }}
                    className={`p-2.5 rounded-2xl text-xs font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      importPlatform === 'raw'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="font-extrabold text-[13px]">Свой список</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-medium">
                      Текст / HTML
                    </span>
                  </button>
                </div>
              </div>

              {/* Rules info */}
              <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs space-y-1 text-blue-900 dark:text-blue-200">
                <div className="font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Правила безопасного переноса:</span>
                </div>
                <p>• Уже оценённые тайтлы в вашем профиле не перезаписываются и не удаляются.</p>
                <p>• Новые тайтлы получат оценку из стороннего сервиса (1–10, если без оценки — 0).</p>
                <p>• Перед началом импорта система запросит подтверждение.</p>
              </div>

              {/* Subtabs for Link vs Raw Text (except when platform is 'raw') */}
              {importPlatform !== 'raw' && (
                <div className="flex rounded-2xl bg-neutral-100 dark:bg-neutral-900 p-1">
                  <button
                    type="button"
                    onClick={() => setImportActiveSubTab('link')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      importActiveSubTab === 'link'
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    По ссылке / профилю
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportActiveSubTab('raw')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      importActiveSubTab === 'raw'
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Вставить код страницы / текст
                  </button>
                </div>
              )}

              {/* Inputs based on platform and subtab */}
              {importPlatform !== 'raw' && importActiveSubTab === 'link' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      {importPlatform === 'shikimori' && 'Ссылка на профиль Shikimori или никнейм:'}
                      {importPlatform === 'animelib' && 'Ссылка на профиль AnimeLib или цифровой ID:'}
                      {importPlatform === 'animego' && 'Ссылка на профиль AnimeGO или цифровой ID:'}
                    </label>
                    <input
                      type="text"
                      value={importInput}
                      onChange={(e) => setImportInput(e.target.value)}
                      placeholder={
                        importPlatform === 'shikimori'
                          ? 'Например: https://shikimori.one/username или shiki'
                          : importPlatform === 'animelib'
                          ? 'Например: https://v5.animelib.org/ru/user/12345/profile или 12345'
                          : 'Например: https://animego.me/user/1659989 или 1659989'
                      }
                      className="w-full px-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                    {importPlatform === 'shikimori' && (
                      <>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                          ✨ Быстрый импорт через API Shikimori:
                        </span>
                        <p>
                          Просто введите ваш никнейм на Shikimori. Все ваши оценки будут напрямую получены и сопоставлены с каталогом без каких-либо блокировок.
                        </p>
                      </>
                    )}
                    {importPlatform === 'animelib' && (
                      <>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                          💡 Совет по переносу из AnimeLib:
                        </span>
                        <p>
                          Перейдите на открытую страницу вашего профиля AnimeLib, нажмите Ctrl+A (выделить всё) или Ctrl+U (исходный код), скопируйте и вставьте во вкладку «Вставить код страницы / текст» — система моментально найдёт все ваши оценки!
                        </p>
                      </>
                    )}
                    {importPlatform === 'animego' && (
                      <>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                          💡 Как найти свой ID на AnimeGO:
                        </span>
                        <p>
                          Перейдите в свой профиль на <a href="https://animego.me/profile/" target="_blank" rel="noreferrer" className="text-blue-500 underline">animego.me/profile/</a> — адрес в браузере сменится на <code className="text-neutral-700 dark:text-neutral-300 bg-neutral-200/70 dark:bg-neutral-800 px-1 py-0.5 rounded">https://animego.me/user/НОМЕР</code>. Скопируйте ссылку или номер.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      {importPlatform === 'animelib'
                        ? 'Исходный HTML страницы или скопированный текст профиля AnimeLib:'
                        : importPlatform === 'animego'
                        ? 'Исходный HTML страницы https://animego.me/profile/?type=2 (Ctrl+U):'
                        : 'Вставьте список оценок (например: Атака титанов - 10) или скопированный текст/код страницы:'}
                    </label>
                    <textarea
                      rows={6}
                      value={importRawContent}
                      onChange={(e) => setImportRawContent(e.target.value)}
                      placeholder={
                        importPlatform === 'animelib'
                          ? 'Скопируйте всё на странице вашего профиля AnimeLib (Ctrl+A, Ctrl+C) либо нажмите Ctrl+U (исходный код) и вставьте сюда...'
                          : importPlatform === 'animego'
                          ? 'Нажмите Ctrl+U на странице своего профиля AnimeGO, скопируйте код и вставьте сюда...'
                          : 'Название тайтла 1 - 10\nНазвание тайтла 2 - 8\nНазвание тайтла 3 - 9\n\nИли скопированный текст/код страницы'
                      }
                      className="w-full px-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Парсер автоматически определит названия аниме и ваши оценки.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {importError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Success Result */}
              {importResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-sm">
                    <Check className="w-4 h-4" />
                    <span>Импорт успешно завершён!</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">
                      <span className="block text-neutral-500 dark:text-neutral-400 text-[10px] uppercase">Найдено</span>
                      <span className="font-bold text-sm text-neutral-900 dark:text-white">{importResult.total}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">
                      <span className="block text-neutral-500 dark:text-neutral-400 text-[10px] uppercase">Добавлено</span>
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">+{importResult.newlyRatedCount}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">
                      <span className="block text-neutral-500 dark:text-neutral-400 text-[10px] uppercase">Сохранено</span>
                      <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{importResult.alreadyRatedCount}</span>
                    </div>
                  </div>
                  {importResult.zeroRatedCount > 0 && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      * {importResult.zeroRatedCount} тайтлов без оценки сохранены со счётом 0.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3 shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              >
                {importResult ? 'Закрыть' : 'Отмена'}
              </button>
              <button
                type="button"
                disabled={importLoading}
                onClick={handleInitiateImport}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {importLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Импортируем оценки...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{importResult ? 'Повторить импорт' : 'Импортировать'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Before Import (Photo 1 requirement) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                Подтверждение переноса
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                Вы уверены, что хотите перенести оценки из <strong>{getPlatformLabel(importPlatform)}</strong>?
              </p>
              {importInput.trim() && (
                <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-xs font-mono text-neutral-700 dark:text-neutral-300 break-all border border-neutral-200 dark:border-neutral-800">
                  {importInput.trim()}
                </div>
              )}
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-500 dark:text-neutral-400 text-left space-y-1 mt-2">
                <p>✓ Ваши текущие оценки останутся в сохранности.</p>
                <p>✓ Новые тайтлы добавятся в ваш профиль и учтутся в ранге Отаку.</p>
                <p className="text-[11px] opacity-75">При отказе (нажатии «Отмена») ничего не будет перенесено.</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={importLoading}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex-1"
              >
                Отмена (не переносить)
              </button>
              <button
                type="button"
                disabled={importLoading}
                onClick={handleExecuteImport}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md flex items-center justify-center gap-2 flex-1 disabled:opacity-50"
              >
                {importLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Импорт...</span>
                  </>
                ) : (
                  <span>Да, подтверждаю</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
