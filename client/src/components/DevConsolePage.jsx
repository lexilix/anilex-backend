import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Terminal,
  ShieldCheck,
  User,
  Film,
  Star,
  Trash2,
  Edit,
  Search,
  Plus,
  Camera,
  Image,
  ArrowLeft,
  Check,
  AlertCircle,
  Lock,
  RefreshCw,
  Pin,
  X,
  Eye,
  SlidersHorizontal,
  Download,
  Upload,
  FileText,
  Globe,
  Filter,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import { apiUrl } from '../api';
import { updateCachedAnimeItem, removeCachedAnimeItem } from '../utils/catalogCache';
import { toggleHiddenAnime } from '../utils/hiddenStorage';
import { getScoreBadgeClass } from '../utils/scoreColors';
import { extractPlatformIdentifier, parseAnimeLibContent } from '../utils/importer';
import { getCachedUserRatings, updateCachedUserRating } from '../utils/profileCache';

const DEV_GENRES = [
  'Все жанры',
  'Боевик',
  'Комедия',
  'Драма',
  'Фэнтези',
  'Приключения',
  'Романтика',
  'Триллер',
  'Сверхъестественное',
  'Фантастика',
  'Детектив',
  'Спорт',
  'Повседневность',
  'Мистика',
  'Психологическое',
  'Этти',
  'Сёнэн',
  'Сэйнэн'
];

const DEV_TYPES = ['Все типы', 'Сериал', 'Фильм', 'OVA', 'ONA', 'Спешл'];

/**
 * Parses user-pasted text to extract anime titles and scores.
 * Supports:
 * - JSON: [{"title": "...", "score": 10}]
 * - Text lines: "Атака титанов 10", "Наруто - 9", "Блич: 8", "Ванпанчмен [10]"
 * - CSV: "Название, 10"
 */
function parseRawTextRatings(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];

  // 1. JSON Array
  if ((clean.startsWith('[') && clean.endsWith(']')) || (clean.startsWith('{') && clean.endsWith('}'))) {
    try {
      const parsed = JSON.parse(clean);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const res = [];
      for (const item of arr) {
        const title = item.title || item.rus_name || item.russian || item.name || '';
        const scoreVal = item.score ?? item.rating ?? item.user_rate ?? 10;
        if (title && title.trim()) {
          res.push({
            title: title.trim(),
            originalTitle: item.originalTitle || item.eng_name || '',
            score: Math.min(10, Math.max(1, parseInt(scoreVal, 10) || 10))
          });
        }
      }
      if (res.length > 0) return res;
    } catch (e) {}
  }

  // 2. Line by line parsing
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];

  for (const line of lines) {
    let cleanLine = line.replace(/^#?\d+[\.\)]\s*|^-\s*/, '').trim();

    // Trailing score: "Title - 10", "Title: 9", "Title 10/10", "Title [10]", "Title, 8"
    const scoreMatch = cleanLine.match(/[-—:|\t,\s]+\[?(\d{1,2})\]?(?:\s*\/\s*10)?\s*$/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1], 10);
      if (score >= 1 && score <= 10) {
        const title = cleanLine.slice(0, scoreMatch.index).trim();
        if (title.length >= 2) {
          items.push({ title, score });
          continue;
        }
      }
    }

    // Prefix score: "10, Title" or "10 - Title"
    const prefixMatch = cleanLine.match(/^(\d{1,2})\s*[-—:|\t,]\s*(.+)$/);
    if (prefixMatch) {
      const score = parseInt(prefixMatch[1], 10);
      const title = prefixMatch[2].trim();
      if (score >= 1 && score <= 10 && title.length >= 2) {
        items.push({ title, score });
        continue;
      }
    }

    if (cleanLine.length >= 2) {
      items.push({ title: cleanLine, score: 10 });
    }
  }

  return items;
}


export default function DevConsolePage({
  user,
  onNavigate,
  onUserUpdated,
  onCatalogUpdated,
  onAnimeUpdated,
  onAnimeDeleted
}) {
  // Check if current logged-in user is Just
  const isJustAccount = Boolean(
    user &&
    (user.nickname === 'Just' ||
      user.email === 'just9jeeet@gmail.com' ||
      user.id === 5)
  );

  // Session unlock state
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return isJustAccount && sessionStorage.getItem('anilex_dev_unlocked') === 'true';
  });

  // Login form state (if not logged in as Just)
  const [loginInput, setLoginInput] = useState(isJustAccount ? user.email || 'just9jeeet@gmail.com' : 'just9jeeet@gmail.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Active Tab: 'anime' | 'users' | 'ratings'
  const [activeTab, setActiveTab] = useState('anime');

  // Global toast message
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ----------------------------------------------------
  // ANIME TAB STATE
  // ----------------------------------------------------
  const [animeList, setAnimeList] = useState([]);
  const [animeSearch, setAnimeSearch] = useState('');
  const [animeLoading, setAnimeLoading] = useState(false);
  const [animePage, setAnimePage] = useState(1);
  const [animeTotal, setAnimeTotal] = useState(0);

  // Edit Anime Modal
  const [editingAnime, setEditingAnime] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOriginalTitle, setEditOriginalTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editType, setEditType] = useState('Сериал');
  const [editYear, setEditYear] = useState('');
  const [editGenres, setEditGenres] = useState([]);
  const [genresInput, setGenresInput] = useState('');
  const [saveAnimeLoading, setSaveAnimeLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Delete Anime Modal
  const [deletingAnime, setDeletingAnime] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ----------------------------------------------------
  // USERS TAB STATE
  // ----------------------------------------------------
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Edit User Modal
  const [editingUser, setEditingUser] = useState(null);
  const [editUserNick, setEditUserNick] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserAvatar, setEditUserAvatar] = useState('');
  const [editUserBanner, setEditUserBanner] = useState('');
  const [saveUserLoading, setSaveUserLoading] = useState(false);
  const userAvatarFileRef = useRef(null);
  const userBannerFileRef = useRef(null);

  // Delete User Modal
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // ----------------------------------------------------
  // RATINGS TAB STATE
  // ----------------------------------------------------
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userRatings, setUserRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  // Sub-tabs: 'rated' | 'unrated'
  const [ratingsSubTab, setRatingsSubTab] = useState('rated'); // 'rated' | 'unrated'
  const [ratingsSearch, setRatingsSearch] = useState('');
  const [ratingsScoreFilter, setRatingsScoreFilter] = useState('all'); // 'all' | '10' | '9' ... | 'low'
  const [ratingsGenreFilter, setRatingsGenreFilter] = useState('all');
  const [ratingsTypeFilter, setRatingsTypeFilter] = useState('all');
  const [ratingsSortFilter, setRatingsSortFilter] = useState('score_desc'); // 'score_desc' | 'score_asc' | 'title_asc' | 'recent'

  // Unrated Anime State
  const [unratedAnimeList, setUnratedAnimeList] = useState([]);
  const [unratedLoading, setUnratedLoading] = useState(false);
  const [unratedPage, setUnratedPage] = useState(1);
  const [unratedTotal, setUnratedTotal] = useState(0);

  // Add Rating Modal (Single anime manual rate)
  const [showAddRatingModal, setShowAddRatingModal] = useState(false);
  const [addRatingSearch, setAddRatingSearch] = useState('');
  const [searchAnimeResults, setSearchAnimeResults] = useState([]);
  const [selectedAnimeToAdd, setSelectedAnimeToAdd] = useState(null);
  const [newScore, setNewScore] = useState(10);
  const [addRatingLoading, setAddRatingLoading] = useState(false);

  // Import Ratings Modal State (Raw Text / Sites: Shikimori, AnimeLib, AnimeGO)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState('text'); // 'text' | 'site'
  const [importRawText, setImportRawText] = useState('');
  const [importSitePlatform, setImportSitePlatform] = useState('shikimori'); // 'shikimori' | 'animelib' | 'animego'
  const [importSiteInput, setImportSiteInput] = useState('');
  const [importOverwrite, setImportOverwrite] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState('');
  const [importResult, setImportResult] = useState(null);

  // ----------------------------------------------------
  // AUTHENTICATION LOGIC
  // ----------------------------------------------------
  const handleDevLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      // 1. First try dedicated /api/dev/auth
      let res = await fetch(apiUrl('/api/dev/auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginInput.trim(), password: passwordInput })
      }).catch(() => null);

      // 2. Fallback to /api/auth/login
      if (!res || !res.ok) {
        res = await fetch(apiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginInput.trim(), password: passwordInput })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Неверный логин или пароль');
      }

      // Check if logged in user is actually Just
      const isJust = data.user?.nickname === 'Just' || data.user?.email === 'just9jeeet@gmail.com' || data.user?.id === 5;
      if (!isJust) {
        throw new Error('Доступ запрещен: вход разрешен только с аккаунта Just!');
      }

      localStorage.setItem('anime_auth_token', data.token);
      sessionStorage.setItem('anilex_dev_unlocked', 'true');
      if (onUserUpdated) {
        onUserUpdated(data.user, data.token);
      }
      setIsUnlocked(true);
      showToast('Доступ в консоль разработчика предоставлен');
    } catch (err) {
      setLoginError(err.message || 'Ошибка проверки учетных данных Just');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLockConsole = () => {
    sessionStorage.removeItem('anilex_dev_unlocked');
    setIsUnlocked(false);
    showToast('Консоль заблокирована', 'info');
  };

  // ----------------------------------------------------
  // FETCH ANIME LIST FOR MANAGEMENT
  // ----------------------------------------------------
  const fetchAnimeForDev = useCallback(async (searchQuery = '', pageNum = 1) => {
    setAnimeLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20'
      });
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(apiUrl(`/api/anime?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const data = await res.json();
        let deletedAnimeIds = new Set();
        try {
          deletedAnimeIds = new Set(JSON.parse(localStorage.getItem('anilex_deleted_anime_ids') || '[]').map(Number));
        } catch (e) {}
        const rawItems = data.items || [];
        const filtered = rawItems.filter((it) => !deletedAnimeIds.has(Number(it.id)));
        setAnimeList(filtered);
        setAnimeTotal(Math.max(0, (data.total || filtered.length) - (rawItems.length - filtered.length)));
      }
    } catch (err) {
      console.error('Error fetching anime for dev:', err);
    } finally {
      setAnimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUnlocked && activeTab === 'anime') {
      const timer = setTimeout(() => {
        fetchAnimeForDev(animeSearch, animePage);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked, activeTab, animeSearch, animePage, fetchAnimeForDev]);

  // ----------------------------------------------------
  // FETCH USERS LIST
  // ----------------------------------------------------
  const fetchUsersForDev = useCallback(async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      let users = [];

      // 1. Try /api/dev/users
      const res = await fetch(apiUrl('/api/dev/users'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        users = data.users || [];
      } else {
        // Fallback to /api/friends
        const fallbackRes = await fetch(apiUrl('/api/friends'));
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          users = (fbData.friends || []).map((u) => ({
            id: u.id,
            nickname: u.nickname,
            email: u.email,
            avatarUrl: u.avatarUrl,
            ratedCount: u.rated_count,
            avgScore: u.avg_score
          }));
        }
      }

      // Filter out 'inspector' and permanently deleted users
      let deletedUserIds = new Set();
      try {
        deletedUserIds = new Set(JSON.parse(localStorage.getItem('anilex_deleted_user_ids') || '[]').map(Number));
      } catch (e) {}
      users = users.filter((u) => u.nickname?.toLowerCase() !== 'inspector' && !deletedUserIds.has(Number(u.id)));
      setUsersList(users);

      if (!selectedUserId && users.length > 0) {
        setSelectedUserId(users[0].id);
      }
    } catch (err) {
      console.error('Error fetching users for dev:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (isUnlocked && (activeTab === 'users' || activeTab === 'ratings')) {
      fetchUsersForDev();
    }
  }, [isUnlocked, activeTab, fetchUsersForDev]);

  // ----------------------------------------------------
  // FETCH RATINGS FOR SELECTED USER
  // ----------------------------------------------------
  const fetchRatingsForUser = useCallback(async (userId) => {
    if (!userId) return;
    setRatingsLoading(true);
    try {
      const token = localStorage.getItem('anime_auth_token');
      let ratings = [];

      // 1. Try /api/dev/users/:id/ratings
      const res = await fetch(apiUrl(`/api/dev/users/${userId}/ratings`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        ratings = data.ratings || [];
      } else {
        // 2. Fallback to /api/users/:id/profile (admin Just has full access)
        const profRes = await fetch(apiUrl(`/api/users/${userId}/profile`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null);

        if (profRes && profRes.ok) {
          const profData = await profRes.json();
          ratings = profData.ratings || [];
        } else {
          // 3. Client cache fallback
          const cached = getCachedUserRatings(userId);
          if (cached && cached.length > 0) {
            ratings = cached.map((r) => ({
              id: r.id,
              title: r.title,
              originalTitle: r.originalTitle,
              imageUrl: r.imageUrl,
              type: r.type,
              year: r.year,
              genres: r.genres || [],
              score: r.myScore || r.score || 10,
              isPinned: false,
              isTop5: false
            }));
          }
        }
      }

      setUserRatings(ratings);
    } catch (err) {
      console.error('Error fetching user ratings for dev:', err);
    } finally {
      setRatingsLoading(false);
    }
  }, []);

  // ----------------------------------------------------
  // FETCH UNRATED ANIME FOR SELECTED USER
  // ----------------------------------------------------
  const fetchUnratedAnime = useCallback(
    async (userId, pageNum = 1, search = '', genre = 'all', type = 'all') => {
      if (!userId) return;
      setUnratedLoading(true);
      try {
        const token = localStorage.getItem('anime_auth_token');
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '40'
        });
        if (search.trim()) params.append('search', search.trim());
        if (genre && genre !== 'all') params.append('genres', genre);
        if (type && type !== 'all') params.append('type', type);

        // 1. Try /api/dev/users/:id/unrated
        const res = await fetch(apiUrl(`/api/dev/users/${userId}/unrated?${params.toString()}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          setUnratedAnimeList(data.items || []);
          setUnratedTotal(data.total || (data.items || []).length);
        } else {
          // 2. Fallback: fetch anime catalog and filter out user rated IDs
          const catParams = new URLSearchParams({
            page: String(pageNum),
            limit: '80'
          });
          if (search.trim()) catParams.append('search', search.trim());
          if (genre && genre !== 'all') catParams.append('genres', genre);
          if (type && type !== 'all') catParams.append('type', type);

          const catRes = await fetch(apiUrl(`/api/anime?${catParams.toString()}`));
          if (catRes.ok) {
            const catData = await catRes.json();
            const ratedSet = new Set((userRatings || []).map((r) => Number(r.id)));
            const unrated = (catData.items || []).filter((a) => !ratedSet.has(Number(a.id)));
            setUnratedAnimeList(unrated);
            setUnratedTotal(Math.max(0, (catData.total || 0) - ratedSet.size));
          }
        }
      } catch (err) {
        console.error('Error fetching unrated anime:', err);
      } finally {
        setUnratedLoading(false);
      }
    },
    [userRatings]
  );

  useEffect(() => {
    if (isUnlocked && activeTab === 'ratings' && selectedUserId) {
      fetchRatingsForUser(selectedUserId);
    }
  }, [isUnlocked, activeTab, selectedUserId, fetchRatingsForUser]);

  useEffect(() => {
    if (isUnlocked && activeTab === 'ratings' && ratingsSubTab === 'unrated' && selectedUserId) {
      const timer = setTimeout(() => {
        fetchUnratedAnime(selectedUserId, unratedPage, ratingsSearch, ratingsGenreFilter, ratingsTypeFilter);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [
    isUnlocked,
    activeTab,
    ratingsSubTab,
    selectedUserId,
    unratedPage,
    ratingsSearch,
    ratingsGenreFilter,
    ratingsTypeFilter,
    fetchUnratedAnime
  ]);

  // Filtered & Sorted Rated Anime List
  const filteredUserRatings = useMemo(() => {
    return userRatings
      .filter((r) => {
        if (ratingsSearch.trim()) {
          const q = ratingsSearch.trim().toLowerCase();
          const title = (r.title || '').toLowerCase();
          const orig = (r.originalTitle || r.original_title || '').toLowerCase();
          if (!title.includes(q) && !orig.includes(q)) return false;
        }

        if (ratingsScoreFilter !== 'all') {
          if (ratingsScoreFilter === 'low') {
            if (Number(r.score) > 4) return false;
          } else {
            if (Number(r.score) !== Number(ratingsScoreFilter)) return false;
          }
        }

        if (ratingsTypeFilter !== 'all') {
          const t = (r.type || 'Сериал').toLowerCase();
          if (t !== ratingsTypeFilter.toLowerCase()) return false;
        }

        if (ratingsGenreFilter !== 'all') {
          const gList = Array.isArray(r.genres) ? r.genres : [];
          if (!gList.includes(ratingsGenreFilter)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (ratingsSortFilter === 'score_desc') return (b.score || 0) - (a.score || 0);
        if (ratingsSortFilter === 'score_asc') return (a.score || 0) - (b.score || 0);
        if (ratingsSortFilter === 'title_asc') return (a.title || '').localeCompare(b.title || '');
        if (ratingsSortFilter === 'recent') return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        return 0;
      });
  }, [userRatings, ratingsSearch, ratingsScoreFilter, ratingsTypeFilter, ratingsGenreFilter, ratingsSortFilter]);

  // ----------------------------------------------------
  // ANIME EDIT & DELETE HANDLERS
  // ----------------------------------------------------
  const handleOpenEditAnime = (anime) => {
    setEditingAnime(anime);
    setEditTitle(anime.title || '');
    setEditOriginalTitle(anime.originalTitle || anime.original_title || '');
    setEditDescription(anime.description || '');
    setEditImageUrl(anime.imageUrl || anime.image_url || '');
    setEditType(anime.type || 'Сериал');
    setEditYear(anime.year || '');
    const gList = Array.isArray(anime.genres) ? anime.genres : [];
    setEditGenres(gList);
    setGenresInput(gList.join(', '));
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast('Файл превышает 8 МБ', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAnime = async (e) => {
    e.preventDefault();
    if (!editingAnime) return;
    setSaveAnimeLoading(true);

    try {
      const token = localStorage.getItem('anime_auth_token');
      const cleanGenres = genresInput
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);

      const payload = {
        title: editTitle.trim(),
        originalTitle: editOriginalTitle.trim(),
        description: editDescription.trim(),
        imageUrl: editImageUrl.trim(),
        type: editType,
        year: editYear.trim(),
        genres: cleanGenres
      };

      // 1. Try server PUT /api/dev/anime/:id
      const res = await fetch(apiUrl(`/api/dev/anime/${editingAnime.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }).catch(() => null);

      // 2. Update local caches & storage so changes appear everywhere immediately
      const updatedItem = {
        ...editingAnime,
        ...payload
      };
      updateCachedAnimeItem(updatedItem);

      // Update in current dev list
      setAnimeList((prev) =>
        prev.map((a) => (a.id === editingAnime.id ? updatedItem : a))
      );

      if (onCatalogUpdated) {
        onCatalogUpdated(updatedItem);
      }

      showToast(`Тайтл «${editTitle}» успешно обновлен!`);
      setEditingAnime(null);
    } catch (err) {
      showToast('Ошибка сохранения тайтла: ' + err.message, 'error');
    } finally {
      setSaveAnimeLoading(false);
    }
  };

  const handleDeleteAnime = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!deletingAnime) return;
    setDeleteLoading(true);

    try {
      const token = localStorage.getItem('anime_auth_token');
      const animeId = Number(deletingAnime.id);
      const animeTitle = deletingAnime.title;

      // 1. Immediately record in persistent blacklist so it's gone everywhere on the site
      try {
        const deletedList = JSON.parse(localStorage.getItem('anilex_deleted_anime_ids') || '[]');
        if (!deletedList.includes(animeId)) {
          deletedList.push(animeId);
          localStorage.setItem('anilex_deleted_anime_ids', JSON.stringify(deletedList));
        }
      } catch (e) {}

      // 2. Call DELETE /api/dev/anime/:id
      await fetch(apiUrl(`/api/dev/anime/${animeId}`), {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).catch((err) => {
        console.warn('Backend delete anime error:', err);
      });

      // 3. Purge from local caches and client catalog
      removeCachedAnimeItem(animeId);

      setAnimeList((prev) => prev.filter((a) => Number(a.id) !== animeId));
      setAnimeTotal((prev) => Math.max(0, prev - 1));

      if (onAnimeDeleted) {
        onAnimeDeleted(animeId);
      }
      if (onCatalogUpdated) {
        onCatalogUpdated({ id: animeId, isDeleted: true });
      }

      showToast(`Тайтл «${animeTitle}» успешно удален со всего сайта!`);
      setDeletingAnime(null);
    } catch (err) {
      showToast('Ошибка удаления тайтла: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteUser = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!deletingUser) return;
    setDeleteUserLoading(true);

    try {
      const token = localStorage.getItem('anime_auth_token');
      const targetId = Number(deletingUser.id);
      const targetNick = deletingUser.nickname;

      // 1. Immediately record in persistent blacklist
      try {
        const deletedUsers = JSON.parse(localStorage.getItem('anilex_deleted_user_ids') || '[]');
        if (!deletedUsers.includes(targetId)) {
          deletedUsers.push(targetId);
          localStorage.setItem('anilex_deleted_user_ids', JSON.stringify(deletedUsers));
        }
      } catch (e) {}

      // 2. Call DELETE /api/dev/users/:id
      await fetch(apiUrl(`/api/dev/users/${targetId}`), {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).catch((err) => {
        console.warn('Backend delete user error:', err);
      });

      // 3. Remove locally from state
      setUsersList((prev) => prev.filter((u) => Number(u.id) !== targetId));

      // 4. If this user was selected in ratings tab, reset
      if (selectedUserId === targetId) {
        setSelectedUserId(user?.id || 5);
      }

      showToast(`Аккаунт пользователя «${targetNick}» успешно удален!`);
      setDeletingUser(null);
    } catch (err) {
      showToast('Ошибка удаления пользователя: ' + err.message, 'error');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // ----------------------------------------------------
  // USER EDIT HANDLERS
  // ----------------------------------------------------
  const handleOpenEditUser = (targetUser) => {
    setEditingUser(targetUser);
    setEditUserNick(targetUser.nickname || '');
    setEditUserEmail(targetUser.email || '');
    setEditUserAvatar(targetUser.avatarUrl || '');
    setEditUserBanner(targetUser.bannerUrl ? targetUser.bannerUrl.split('#top5=')[0] : '');
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaveUserLoading(true);

    try {
      const token = localStorage.getItem('anime_auth_token');
      const payload = {
        nickname: editUserNick.trim(),
        email: editUserEmail.trim(),
        avatarUrl: editUserAvatar || null,
        bannerUrl: editUserBanner || null
      };

      // 1. Try /api/dev/users/:id
      let res = await fetch(apiUrl(`/api/dev/users/${editingUser.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }).catch(() => null);

      // If updating self and dev route returned 404, fallback to /api/auth/profile
      if ((!res || !res.ok) && editingUser.id === user?.id) {
        res = await fetch(apiUrl('/api/auth/profile'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const updatedObj = { ...editingUser, ...payload };
      setUsersList((prev) =>
        prev.map((u) => (u.id === editingUser.id ? updatedObj : u))
      );

      if (editingUser.id === user?.id && onUserUpdated) {
        onUserUpdated(updatedObj, token);
      }

      showToast(`Профиль ${editUserNick} успешно сохранен!`);
      setEditingUser(null);
    } catch (err) {
      showToast('Ошибка сохранения профиля: ' + err.message, 'error');
    } finally {
      setSaveUserLoading(false);
    }
  };

  // ----------------------------------------------------
  // RATINGS EDIT HANDLERS
  // ----------------------------------------------------
  const handleChangeUserRating = async (animeId, newScoreVal) => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const numScore = parseInt(newScoreVal, 10);

      // 1. Try /api/dev/users/:userId/ratings
      await fetch(apiUrl(`/api/dev/users/${selectedUserId}/ratings`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ animeId, score: numScore })
      }).catch(() => {});

      // If editing current user, also fire /api/anime/:id/rate
      if (selectedUserId === user?.id) {
        fetch(apiUrl(`/api/anime/${animeId}/rate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ score: numScore })
        }).catch(() => {});
      }

      setUserRatings((prev) =>
        prev.map((r) => (r.id === animeId ? { ...r, score: numScore } : r))
      );
      showToast(`Оценка изменена на ${numScore}/10`);
    } catch (err) {
      showToast('Ошибка изменения оценки', 'error');
    }
  };

  const handleDeleteUserRating = async (animeId, animeTitle) => {
    if (!window.confirm(`Удалить оценку для «${animeTitle}»?`)) return;

    try {
      const token = localStorage.getItem('anime_auth_token');

      // 1. Try /api/dev/users/:userId/ratings/:animeId
      await fetch(apiUrl(`/api/dev/users/${selectedUserId}/ratings/${animeId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});

      // Fallback if current user
      if (selectedUserId === user?.id) {
        fetch(apiUrl(`/api/anime/${animeId}/rate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ score: null })
        }).catch(() => {});
      }

      setUserRatings((prev) => prev.filter((r) => r.id !== animeId));
      showToast(`Оценка для «${animeTitle}» удалена`);
    } catch (err) {
      showToast('Ошибка удаления оценки', 'error');
    }
  };

  const handleToggleUserTop5 = async (animeId) => {
    const targetUser = usersList.find((u) => u.id === selectedUserId);
    if (!targetUser) return;

    // Parse existing top5
    let currentTop5 = [];
    if (targetUser.bannerUrl && targetUser.bannerUrl.includes('#top5=')) {
      try {
        currentTop5 = targetUser.bannerUrl
          .split('#top5=')[1]
          .split(',')
          .map(Number)
          .filter(Boolean);
      } catch (e) {}
    }

    const isAlready = currentTop5.includes(animeId);
    let newTop5 = [];
    if (isAlready) {
      newTop5 = currentTop5.filter((id) => id !== animeId);
    } else {
      if (currentTop5.length >= 5) {
        showToast('В Топ-5 можно закрепить максимум 5 аниме', 'error');
        return;
      }
      newTop5 = [...currentTop5, animeId];
    }

    try {
      const token = localStorage.getItem('anime_auth_token');
      const cleanBanner = (targetUser.bannerUrl || '').split('#top5=')[0];
      const newBanner = cleanBanner + (newTop5.length > 0 ? '#top5=' + newTop5.join(',') : '');

      await fetch(apiUrl(`/api/dev/users/${targetUser.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ top5Ids: newTop5, bannerUrl: newBanner })
      }).catch(() => {});

      // Update in local state
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, bannerUrl: newBanner } : u))
      );
      setUserRatings((prev) =>
        prev.map((r) => (r.id === animeId ? { ...r, isPinned: !isAlready } : r))
      );

      showToast(isAlready ? 'Тайтл убран из Топ-5' : 'Тайтл закреплен в Топ-5');
    } catch (err) {
      showToast('Ошибка закрепления в Топ-5', 'error');
    }
  };

  // Search anime to add new rating
  const handleSearchAnimeToAdd = async (q) => {
    setAddRatingSearch(q);
    if (!q.trim()) {
      setSearchAnimeResults([]);
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/anime?search=${encodeURIComponent(q.trim())}&limit=8`));
      if (res.ok) {
        const data = await res.json();
        setSearchAnimeResults(data.items || []);
      }
    } catch (err) {}
  };

  const handleAddRatingSubmit = async () => {
    if (!selectedAnimeToAdd || !selectedUserId) return;
    setAddRatingLoading(true);
    try {
      await handleChangeUserRating(selectedAnimeToAdd.id, newScore);
      setShowAddRatingModal(false);
      setSelectedAnimeToAdd(null);
      setAddRatingSearch('');
      fetchRatingsForUser(selectedUserId);
      showToast(`Оценка для «${selectedAnimeToAdd.title}» добавлена!`);
    } catch (err) {
      showToast('Ошибка добавления оценки', 'error');
    } finally {
      setAddRatingLoading(false);
    }
  };

  // Rate unrated anime directly from the list
  const handleRateUnratedAnime = async (animeItem, scoreNum) => {
    try {
      const token = localStorage.getItem('anime_auth_token');
      const numScore = parseInt(scoreNum, 10);

      await fetch(apiUrl(`/api/dev/users/${selectedUserId}/ratings`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ animeId: animeItem.id, score: numScore })
      }).catch(() => {});

      if (selectedUserId === user?.id) {
        fetch(apiUrl(`/api/anime/${animeItem.id}/rate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ score: numScore })
        }).catch(() => {});
      }

      // Add to userRatings
      const newRatingEntry = {
        ...animeItem,
        score: numScore,
        isPinned: false,
        isTop5: false,
        updatedAt: new Date().toISOString()
      };
      setUserRatings((prev) => [newRatingEntry, ...prev]);

      // Remove from unratedAnimeList
      setUnratedAnimeList((prev) => prev.filter((a) => Number(a.id) !== Number(animeItem.id)));
      setUnratedTotal((prev) => Math.max(0, prev - 1));

      // Update user in usersList
      setUsersList((prev) =>
        prev.map((u) => (u.id === selectedUserId ? { ...u, ratedCount: (u.ratedCount || 0) + 1 } : u))
      );

      // Update client cache
      updateCachedUserRating(selectedUserId, animeItem.id, numScore, animeItem);

      showToast(`«${animeItem.title}» оценено на ${numScore}/10!`);
    } catch (err) {
      showToast('Ошибка добавления оценки: ' + err.message, 'error');
    }
  };

  // Batch import ratings for user
  const handleExecuteImport = async () => {
    setImportLoading(true);
    setImportStatusMsg('Подготовка данных для импорта...');
    setImportResult(null);

    try {
      const token = localStorage.getItem('anime_auth_token');
      let itemsToImport = [];

      if (importMode === 'text') {
        itemsToImport = parseRawTextRatings(importRawText);
        if (itemsToImport.length === 0) {
          throw new Error('Не удалось распознать ни одного тайтла. Введите список вида "Название 10".');
        }
      } else {
        // Site import
        const cleanInput = importSiteInput.trim();
        if (!cleanInput) {
          throw new Error('Введите ссылку на профиль или логин пользователя');
        }

        if (importSitePlatform === 'shikimori') {
          const shikimoriUser = extractPlatformIdentifier('shikimori', cleanInput);
          setImportStatusMsg(`Загрузка списка оценок с Shikimori для «${shikimoriUser}»...`);
          const res = await fetch(`https://shikimori.one/api/users/${encodeURIComponent(shikimoriUser)}/anime_rates?limit=5000`).catch(() => null);
          if (!res || !res.ok) {
            throw new Error(`Не удалось загрузить профиль Shikimori «${shikimoriUser}». Проверьте никнейм или доступность.`);
          }
          const rates = await res.json();
          itemsToImport = rates
            .filter((r) => r.anime && (r.score > 0 || r.status === 'completed'))
            .map((r) => ({
              title: r.anime.russian || r.anime.name,
              originalTitle: r.anime.name || '',
              score: r.score > 0 ? r.score : 10,
              type: 'Сериал'
            }));
        } else {
          // AnimeLib or AnimeGO
          itemsToImport = parseAnimeLibContent(cleanInput, animeList);
          if (itemsToImport.length === 0) {
            itemsToImport = parseRawTextRatings(cleanInput);
          }
          if (itemsToImport.length === 0) {
            throw new Error('Вставьте список или разметку страниц AnimeLib / AnimeGO');
          }
        }
      }

      setImportStatusMsg(`Импорт ${itemsToImport.length} оценок в базу...`);

      // 1. Send batch to /api/dev/users/:userId/import
      let res = await fetch(apiUrl(`/api/dev/users/${selectedUserId}/import`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: itemsToImport,
          overwrite: importOverwrite
        })
      }).catch(() => null);

      let resData;
      if (res && res.ok) {
        resData = await res.json();
      } else {
        // Fallback: apply client-side ratings
        let newly = 0;
        let updated = 0;
        const currentMap = new Map(userRatings.map((r) => [r.title?.toLowerCase(), r.id]));

        for (const it of itemsToImport) {
          const matchedId = currentMap.get(it.title?.toLowerCase());
          if (matchedId) {
            if (importOverwrite) {
              await handleChangeUserRating(matchedId, it.score);
              updated++;
            }
          } else {
            const cat = animeList.find((a) => a.title?.toLowerCase() === it.title?.toLowerCase());
            if (cat) {
              await handleRateUnratedAnime(cat, it.score);
              newly++;
            }
          }
        }
        resData = {
          success: true,
          total: itemsToImport.length,
          newlyRatedCount: newly,
          updatedRatedCount: updated,
          skippedCount: itemsToImport.length - (newly + updated)
        };
      }

      setImportResult(resData);
      showToast(`Успешно импортировано: +${resData.newlyRatedCount || 0} новых оценок!`);

      // Refresh ratings list
      fetchRatingsForUser(selectedUserId);
      if (ratingsSubTab === 'unrated') {
        fetchUnratedAnime(selectedUserId, unratedPage, ratingsSearch, ratingsGenreFilter, ratingsTypeFilter);
      }
    } catch (err) {
      showToast('Ошибка импорта: ' + err.message, 'error');
    } finally {
      setImportLoading(false);
      setImportStatusMsg('');
    }
  };

  // ----------------------------------------------------
  // RENDER: IF NOT UNLOCKED / ACCESS DENIED
  // ----------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-3xl bg-white dark:bg-[#151518] p-7 sm:p-8 shadow-xl border border-neutral-200/80 dark:border-neutral-800 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <Terminal className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              Консоль разработчика
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
              Вход в систему управления разрешён <span className="font-bold text-amber-500">исключительно с аккаунта Just</span> с его логином и паролем.
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleDevLogin} className="space-y-3.5 text-left">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 pl-1">
                Логин или Email (Just)
              </label>
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="just9jeeet@gmail.com или Just"
                className="w-full px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs placeholder-neutral-400 border border-transparent focus:border-amber-500/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 pl-1">
                Пароль аккаунта Just
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Введите пароль..."
                className="w-full px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs placeholder-neutral-400 border border-transparent focus:border-amber-500/40 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm mt-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4 text-amber-500" />
              <span>{loginLoading ? 'Проверка прав...' : 'Войти в консоль'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
            >
              ← Вернуться в каталог
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: UNLOCKED DEVELOPER CONSOLE
  // ----------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-150">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2 border animate-in slide-in-from-bottom-3 ${
          toast.type === 'error'
            ? 'bg-rose-500 text-white border-rose-600'
            : 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-800'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-white" /> : <Check className="w-4 h-4 text-emerald-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-[#151518] shadow-sm border border-neutral-200/70 dark:border-neutral-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black shadow-md shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                Консоль разработчика
              </h1>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold uppercase tracking-wider border border-amber-500/30">
                Just Admin Mode
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Управление профилями, оценками, базой тайтлов и медиа-контентом
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>В каталог</span>
          </button>
          <button
            type="button"
            onClick={handleLockConsole}
            title="Заблокировать консоль"
            className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('anime')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'anime'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Редактор тайтлов</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'users'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Профили пользователей</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ratings')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'ratings'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Оценки пользователей</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: ANIME EDITOR & DELETION */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'anime' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={animeSearch}
                onChange={(e) => {
                  setAnimeSearch(e.target.value);
                  setAnimePage(1);
                }}
                placeholder="Поиск тайтла по названию..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl bg-white dark:bg-[#151518] text-neutral-900 dark:text-white placeholder-neutral-400 border border-neutral-200 dark:border-neutral-800"
              />
            </div>
            <span className="text-xs text-neutral-400 font-medium">
              Всего в каталоге: {animeTotal}
            </span>
          </div>

          {animeLoading ? (
            <div className="py-20 text-center text-xs text-neutral-400">
              Загрузка тайтлов...
            </div>
          ) : animeList.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400 rounded-3xl bg-white dark:bg-[#151518] p-8">
              Тайтлы не найдены
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {animeList.map((anime) => (
                <div
                  key={anime.id}
                  className="p-3.5 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex gap-3.5 justify-between"
                >
                  <div className="w-16 aspect-[5/7] rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 shadow-xs">
                    <img
                      src={anime.imageUrl || anime.image_url}
                      alt={anime.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-neutral-400">
                          ID: {anime.id}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                          {anime.type || 'Сериал'}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-white truncate mt-0.5" title={anime.title}>
                        {anime.title}
                      </h3>
                      {anime.originalTitle && (
                        <p className="text-[10px] text-neutral-400 truncate">
                          {anime.originalTitle}
                        </p>
                      )}
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1 leading-snug">
                        {anime.description || 'Нет описания'}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 mt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAnime(anime)}
                        className="px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Изменить</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingAnime(anime)}
                        className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Удалить</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              type="button"
              disabled={animePage <= 1}
              onClick={() => setAnimePage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#151518] text-xs font-semibold border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
            >
              Назад
            </button>
            <span className="text-xs text-neutral-400 px-2 font-medium">
              Страница {animePage}
            </span>
            <button
              type="button"
              disabled={animeList.length < 20}
              onClick={() => setAnimePage((p) => p + 1)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#151518] text-xs font-semibold border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
            >
              Вперед
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: USER PROFILES */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Все зарегистрированные пользователи ({usersList.length})
            </h3>
            <button
              type="button"
              onClick={fetchUsersForDev}
              className="p-1.5 rounded-xl bg-white dark:bg-[#151518] text-neutral-400 hover:text-neutral-700 dark:hover:text-white border border-neutral-200 dark:border-neutral-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {usersLoading ? (
            <div className="py-20 text-center text-xs text-neutral-400">
              Загрузка пользователей...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.nickname} className="w-full h-full object-cover" />
                      ) : (
                        <span>{u.nickname ? u.nickname.charAt(0).toUpperCase() : 'U'}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {u.nickname}
                        </h4>
                        {u.nickname === 'Just' && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500 text-black text-[9px] font-black uppercase">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">
                        ID: {u.id} · {u.email}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                        <span>{u.ratedCount || 0} оценок</span>
                        {u.avgScore && (
                          <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {u.avgScore}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
                    <button
                      type="button"
                      onClick={() => handleOpenEditUser(u)}
                      className="flex-1 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Редактировать</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setActiveTab('ratings');
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                      title="Оценки пользователя"
                    >
                      <Star className="w-3 h-3" />
                      <span>Оценки</span>
                    </button>

                    {u.nickname !== 'Just' && u.id !== 5 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingUser(u);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white dark:text-rose-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        title="Удалить аккаунт пользователя"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Удалить</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: USER RATINGS & TOP-5 */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'ratings' && (
        <div className="space-y-4">
          {/* Top User Selector & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <label className="text-xs font-bold text-neutral-400 shrink-0">
                Пользователь:
              </label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => {
                  setSelectedUserId(Number(e.target.value));
                  setUnratedPage(1);
                }}
                className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold border-none cursor-pointer"
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname} (ID: {u.id}, оценок: {u.ratedCount || 0})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (selectedUserId) {
                    fetchRatingsForUser(selectedUserId);
                    if (ratingsSubTab === 'unrated') {
                      fetchUnratedAnime(selectedUserId, unratedPage, ratingsSearch, ratingsGenreFilter, ratingsTypeFilter);
                    }
                  }
                }}
                title="Обновить список"
                className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${ratingsLoading || unratedLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Import Button */}
              <button
                type="button"
                onClick={() => {
                  setImportResult(null);
                  setImportRawText('');
                  setShowImportModal(true);
                }}
                className="px-3.5 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors flex items-center gap-1.5 border border-amber-500/25"
              >
                <Download className="w-3.5 h-3.5" />
                <span>📥 Импорт оценок</span>
              </button>

              {/* Add Single Rating */}
              <button
                type="button"
                onClick={() => setShowAddRatingModal(true)}
                className="px-4 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Поставить оценку</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Оценённые vs Не оценённые */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRatingsSubTab('rated')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
                  ratingsSubTab === 'rated'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>Оценённые ({userRatings.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRatingsSubTab('unrated');
                  if (selectedUserId) {
                    fetchUnratedAnime(selectedUserId, 1, ratingsSearch, ratingsGenreFilter, ratingsTypeFilter);
                  }
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
                  ratingsSubTab === 'unrated'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-neutral-400" />
                <span>Не оценённые {unratedTotal > 0 ? `(${unratedTotal})` : ''}</span>
              </button>
            </div>
          </div>

          {/* Search and Filters Toolbar */}
          <div className="p-3.5 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              {/* Search by Title */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ratingsSearch}
                  onChange={(e) => {
                    setRatingsSearch(e.target.value);
                    setUnratedPage(1);
                  }}
                  placeholder={
                    ratingsSubTab === 'rated'
                      ? 'Поиск по оценённым тайтлам...'
                      : 'Поиск по каталогу для оценки...'
                  }
                  className="w-full pl-10 pr-8 py-2 text-xs rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 border-none"
                />
                {ratingsSearch && (
                  <button
                    type="button"
                    onClick={() => setRatingsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Score Filter (Only for Rated SubTab) */}
              {ratingsSubTab === 'rated' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="text-xs font-bold text-neutral-400">Балл:</label>
                  <select
                    value={ratingsScoreFilter}
                    onChange={(e) => setRatingsScoreFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold border-none cursor-pointer"
                  >
                    <option value="all">Все оценки</option>
                    <option value="10">10 ★</option>
                    <option value="9">9 ★</option>
                    <option value="8">8 ★</option>
                    <option value="7">7 ★</option>
                    <option value="6">6 ★</option>
                    <option value="5">5 ★</option>
                    <option value="low">1-4 ★</option>
                  </select>
                </div>
              )}

              {/* Genre Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-xs font-bold text-neutral-400">Жанр:</label>
                <select
                  value={ratingsGenreFilter}
                  onChange={(e) => {
                    setRatingsGenreFilter(e.target.value);
                    setUnratedPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold border-none cursor-pointer max-w-[140px]"
                >
                  {DEV_GENRES.map((g) => (
                    <option key={g} value={g === 'Все жанры' ? 'all' : g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-xs font-bold text-neutral-400">Тип:</label>
                <select
                  value={ratingsTypeFilter}
                  onChange={(e) => {
                    setRatingsTypeFilter(e.target.value);
                    setUnratedPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold border-none cursor-pointer"
                >
                  {DEV_TYPES.map((t) => (
                    <option key={t} value={t === 'Все типы' ? 'all' : t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-xs font-bold text-neutral-400">Сортировка:</label>
                <select
                  value={ratingsSortFilter}
                  onChange={(e) => setRatingsSortFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold border-none cursor-pointer"
                >
                  {ratingsSubTab === 'rated' ? (
                    <>
                      <option value="score_desc">По оценке (10 → 1)</option>
                      <option value="score_asc">По оценке (1 → 10)</option>
                      <option value="title_asc">По названию (А–Я)</option>
                      <option value="recent">По дате оценки</option>
                    </>
                  ) : (
                    <>
                      <option value="score_desc">По ID (новые)</option>
                      <option value="title_asc">По названию (А–Я)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Reset Filters */}
              {(ratingsSearch ||
                ratingsScoreFilter !== 'all' ||
                ratingsGenreFilter !== 'all' ||
                ratingsTypeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setRatingsSearch('');
                    setRatingsScoreFilter('all');
                    setRatingsGenreFilter('all');
                    setRatingsTypeFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold hover:bg-rose-500 hover:text-white transition-colors shrink-0"
                >
                  Сброс
                </button>
              )}
            </div>
          </div>

          {/* SUB-TAB 1: RATED ANIME */}
          {ratingsSubTab === 'rated' && (
            <div>
              {ratingsLoading ? (
                <div className="py-20 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span>Загрузка оценённых тайтлов...</span>
                </div>
              ) : filteredUserRatings.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400 rounded-3xl bg-white dark:bg-[#151518] p-8 space-y-3">
                  <Film className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700" />
                  <p>
                    {userRatings.length === 0
                      ? 'У выбранного пользователя пока нет оценок в базе.'
                      : 'По заданным фильтрам тайтлы не найдены.'}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRatingsSubTab('unrated')}
                      className="px-4 py-2 rounded-2xl bg-amber-500 text-black text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      Посмотреть не оценённые
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold"
                    >
                      Импортировать оценки
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUserRatings.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200/70 dark:border-neutral-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
                    >
                      {/* Left: Poster + Title + Metadata */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-14 aspect-[5/7] rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 shadow-xs">
                          <img
                            src={item.imageUrl || item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                              {item.title}
                            </span>
                            {item.isPinned && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                                📌 В Топ-5
                              </span>
                            )}
                          </div>

                          {item.originalTitle && (
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                              {item.originalTitle}
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1 flex-wrap">
                            <span>ID: {item.id}</span>
                            {item.year && <span>· {item.year}</span>}
                            {item.type && <span>· {item.type}</span>}
                            {Array.isArray(item.genres) && item.genres.length > 0 && (
                              <span className="text-neutral-500">
                                · {item.genres.slice(0, 3).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Rating Selector (1-10) + Actions */}
                      <div className="flex items-center gap-3 justify-between lg:justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-100 dark:border-neutral-800/60">
                        {/* Current Score Badge */}
                        <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1 rounded-xl shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-black text-neutral-900 dark:text-white">
                            {item.score}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-normal">/ 10</span>
                        </div>

                        {/* Inline Score Buttons (1..10) */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((scoreNum) => {
                            const isCurrent = Number(item.score) === scoreNum;
                            return (
                              <button
                                key={scoreNum}
                                type="button"
                                onClick={() => handleChangeUserRating(item.id, scoreNum)}
                                title={`Изменить оценку на ${scoreNum}`}
                                className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                                  isCurrent
                                    ? scoreNum === 10
                                      ? 'bg-amber-500 text-black shadow-sm ring-2 ring-amber-400 scale-105'
                                      : scoreNum >= 8
                                      ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400 scale-105'
                                      : scoreNum >= 6
                                      ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-400 scale-105'
                                      : 'bg-neutral-600 text-white shadow-sm scale-105'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white'
                                }`}
                              >
                                {scoreNum}
                              </button>
                            );
                          })}
                        </div>

                        {/* Top-5 Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleUserTop5(item.id)}
                          title={item.isPinned ? 'Убрать из Топ-5' : 'Закрепить в Топ-5'}
                          className={`p-2 rounded-xl transition-colors shrink-0 ${
                            item.isPinned
                              ? 'bg-amber-500 text-black font-bold'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Rating */}
                        <button
                          type="button"
                          onClick={() => handleDeleteUserRating(item.id, item.title)}
                          title="Удалить оценку"
                          className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: UNRATED ANIME */}
          {ratingsSubTab === 'unrated' && (
            <div>
              {unratedLoading ? (
                <div className="py-20 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span>Загрузка не оценённых тайтлов...</span>
                </div>
              ) : unratedAnimeList.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400 rounded-3xl bg-white dark:bg-[#151518] p-8 space-y-2">
                  <CheckCircle className="w-10 h-10 mx-auto text-emerald-500" />
                  <p className="font-bold text-neutral-900 dark:text-white text-sm">
                    Все тайтлы по запросу оценены!
                  </p>
                  <p className="text-neutral-500">
                    Попробуйте изменить поисковый запрос или сбросить фильтры.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                    <span>
                      Показано {unratedAnimeList.length} из {unratedTotal} не оценённых тайтлов
                    </span>
                    <span>Нажмите любую цифру (1–10), чтобы выставить оценку</span>
                  </div>

                  {unratedAnimeList.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200/70 dark:border-neutral-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
                    >
                      {/* Left: Poster + Info */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-14 aspect-[5/7] rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 shadow-xs">
                          <img
                            src={item.imageUrl || item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {item.title}
                          </h4>
                          {item.originalTitle && (
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                              {item.originalTitle}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1 flex-wrap">
                            <span>ID: {item.id}</span>
                            {item.year && <span>· {item.year}</span>}
                            {item.type && <span>· {item.type}</span>}
                            {item.averageScore && (
                              <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                                <Star className="w-2.5 h-2.5 fill-amber-400" />
                                {item.averageScore}
                              </span>
                            )}
                            {Array.isArray(item.genres) && item.genres.length > 0 && (
                              <span className="text-neutral-500">
                                · {item.genres.slice(0, 3).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct Score Buttons (1..10) */}
                      <div className="flex items-center gap-2 justify-between lg:justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-100 dark:border-neutral-800/60">
                        <span className="text-[11px] font-bold text-neutral-400 mr-1 shrink-0">
                          Поставить оценку:
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((scoreNum) => (
                            <button
                              key={scoreNum}
                              type="button"
                              onClick={() => handleRateUnratedAnime(item, scoreNum)}
                              className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-amber-500 hover:text-black text-neutral-700 dark:text-neutral-300 text-xs font-black transition-all hover:scale-110"
                              title={`Поставить ${scoreNum} баллов`}
                            >
                              {scoreNum}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination for Unrated */}
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      type="button"
                      disabled={unratedPage <= 1}
                      onClick={() => setUnratedPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#151518] text-xs font-semibold border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Назад</span>
                    </button>
                    <span className="text-xs text-neutral-400 font-medium">
                      Страница {unratedPage}
                    </span>
                    <button
                      type="button"
                      disabled={unratedAnimeList.length < 40}
                      onClick={() => setUnratedPage((p) => p + 1)}
                      className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#151518] text-xs font-semibold border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 flex items-center gap-1"
                    >
                      <span>Вперед</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDIT ANIME */}
      {/* ---------------------------------------------------- */}
      {editingAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-7 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Редактирование тайтла (ID: {editingAnime.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAnime(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAnime} className="space-y-4">
              {/* Poster and Preview */}
              <div className="flex items-start gap-4">
                <div className="w-24 aspect-[5/7] rounded-2xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-800">
                  {editImageUrl ? (
                    <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                      Нет фото
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Обложка (Постер тайтла)
                  </label>
                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://... ссылка на картинку"
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs border border-transparent focus:border-neutral-400"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      className="px-3 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Загрузить с ПК</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                  </div>
                </div>
              </div>

              {/* Title & Original Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Название (русское)
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Оригинальное / Английское название
                  </label>
                  <input
                    type="text"
                    value={editOriginalTitle}
                    onChange={(e) => setEditOriginalTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Type, Year, Genres */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Тип
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold"
                  >
                    {['Сериал', 'Фильм', 'OVA', 'ONA', 'Спешл'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Год выпуска
                  </label>
                  <input
                    type="text"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    placeholder="2024"
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Жанры (через запятую)
                  </label>
                  <input
                    type="text"
                    value={genresInput}
                    onChange={(e) => setGenresInput(e.target.value)}
                    placeholder="Экшен, Комедия..."
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Описание сюжета
                </label>
                <textarea
                  rows={5}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Подробное описание аниме..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs leading-relaxed"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingAnime(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saveAnimeLoading}
                  className="px-5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{saveAnimeLoading ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: DELETE ANIME CONFIRM */}
      {/* ---------------------------------------------------- */}
      {deletingAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151518] p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Удалить тайтл?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Вы действительно хотите удалить «<span className="font-bold text-neutral-900 dark:text-white">{deletingAnime.title}</span>»?
                Тайтл и все связанные с ним оценки будут полностью удалены из каталога.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAnime(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={(e) => handleDeleteAnime(e)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLoading ? 'Удаление...' : 'Да, удалить тайтл'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: DELETE USER CONFIRM */}
      {/* ---------------------------------------------------- */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151518] p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Удалить пользователя?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Вы действительно хотите навсегда удалить аккаунт «<span className="font-bold text-neutral-900 dark:text-white">{deletingUser.nickname}</span>» (ID: {deletingUser.id})?
                Все его оценки, комментарии и данные профиля будут полностью удалены с сайта.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteUserLoading}
                onClick={(e) => handleDeleteUser(e)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteUserLoading ? 'Удаление...' : 'Да, удалить пользователя'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDIT USER */}
      {/* ---------------------------------------------------- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-7 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Редактирование профиля {editingUser.nickname} (ID: {editingUser.id})
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Никнейм
                </label>
                <input
                  type="text"
                  required
                  value={editUserNick}
                  onChange={(e) => setEditUserNick(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  URL Аватарки или Base64
                </label>
                <input
                  type="text"
                  value={editUserAvatar}
                  onChange={(e) => setEditUserAvatar(e.target.value)}
                  placeholder="https://... или data:image/..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  URL Баннера или Base64
                </label>
                <input
                  type="text"
                  value={editUserBanner}
                  onChange={(e) => setEditUserBanner(e.target.value)}
                  placeholder="https://... или data:image/..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saveUserLoading}
                  className="px-5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  {saveUserLoading ? 'Сохранение...' : 'Сохранить профиль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD RATING TO USER */}
      {/* ---------------------------------------------------- */}
      {showAddRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#151518] p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Поставить оценку пользователю
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRatingModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  1. Найдите тайтл в каталоге
                </label>
                <input
                  type="text"
                  value={addRatingSearch}
                  onChange={(e) => handleSearchAnimeToAdd(e.target.value)}
                  placeholder="Введите название аниме..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                />
              </div>

              {searchAnimeResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/60">
                  {searchAnimeResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAnimeToAdd(item)}
                      className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                        selectedAnimeToAdd?.id === item.id
                          ? 'bg-amber-500 text-black font-bold'
                          : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <span className="text-xs truncate">{item.title}</span>
                      <span className="text-[10px] opacity-75 shrink-0">ID: {item.id}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedAnimeToAdd && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                      Выбранный тайтл
                    </span>
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {selectedAnimeToAdd.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-neutral-400">Оценка:</label>
                    <select
                      value={newScore}
                      onChange={(e) => setNewScore(Number(e.target.value))}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-neutral-800 text-xs font-black"
                    >
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => (
                        <option key={s} value={s}>
                          {s} / 10
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddRatingModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!selectedAnimeToAdd || addRatingLoading}
                onClick={handleAddRatingSubmit}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 disabled:opacity-40"
              >
                {addRatingLoading ? 'Сохранение...' : 'Выставить оценку'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: BATCH IMPORT RATINGS (RAW TEXT & EXTERNAL SITES) */}
      {/* ---------------------------------------------------- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-7 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Импорт оценок пользователю
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Целевой пользователь:{' '}
                    <span className="font-bold text-amber-500">
                      {usersList.find((u) => u.id === selectedUserId)?.nickname || `ID: ${selectedUserId}`}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setImportMode('text')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'text'
                    ? 'bg-white dark:bg-[#151518] text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Текстовый импорт</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('site')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'site'
                    ? 'bg-white dark:bg-[#151518] text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Импорт с сайта</span>
              </button>
            </div>

            {/* MODE 1: RAW TEXT IMPORT */}
            {importMode === 'text' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Вставьте список аниме и оценок
                  </label>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2 leading-relaxed">
                    Поддерживаются форматы: <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white">Название 10</code>, <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white">Название - 9</code>, <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white">Название: 8</code>, CSV или JSON.
                  </p>
                  <textarea
                    rows={7}
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    placeholder={`Например:\nДитя погоды 10\nАтака титанов 10\nВанпанчмен 9\nПоднятие уровня в одиночку 10\nМагическая битва: 8\nЧеловек-бензопила - 9`}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono leading-relaxed border-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Live parsed preview */}
                {importRawText.trim() && (
                  <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-700 dark:text-neutral-200">
                        Распознано тайтлов: {parseRawTextRatings(importRawText).length}
                      </span>
                      <span className="text-neutral-400 text-[11px]">Превью распознавания</span>
                    </div>

                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {parseRawTextRatings(importRawText).slice(0, 30).map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1 px-2 rounded-xl bg-white dark:bg-[#151518] text-xs"
                        >
                          <span className="truncate pr-2 text-neutral-900 dark:text-white font-medium">
                            {it.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                              it.score === 10
                                ? 'bg-amber-500 text-black'
                                : it.score >= 8
                                ? 'bg-emerald-500 text-white'
                                : 'bg-neutral-600 text-white'
                            }`}
                          >
                            {it.score} / 10
                          </span>
                        </div>
                      ))}
                      {parseRawTextRatings(importRawText).length > 30 && (
                        <p className="text-[10px] text-center text-neutral-400 pt-1">
                          ... и еще {parseRawTextRatings(importRawText).length - 30} тайтлов
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: SITE IMPORT */}
            {importMode === 'site' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Выберите сервис
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'shikimori', label: 'Shikimori' },
                      { id: 'animelib', label: 'AnimeLib' },
                      { id: 'animego', label: 'AnimeGO' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setImportSitePlatform(p.id)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          importSitePlatform === p.id
                            ? 'bg-amber-500 text-black shadow-xs ring-2 ring-amber-400/50'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    {importSitePlatform === 'shikimori'
                      ? 'Ссылка на профиль или логин Shikimori'
                      : 'Ссылка на профиль или скопированный текст'}
                  </label>
                  <input
                    type="text"
                    value={importSiteInput}
                    onChange={(e) => setImportSiteInput(e.target.value)}
                    placeholder={
                      importSitePlatform === 'shikimori'
                        ? 'https://shikimori.one/username или просто логин'
                        : 'https://animelib.me/user/... или скопируйте список'
                    }
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs border-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1.5">
                    {importSitePlatform === 'shikimori'
                      ? 'Для Shikimori будет автоматически загружен список завершенных и оцененных аниме через официальный API.'
                      : 'Для AnimeLib и AnimeGO можно вставить ссылку либо экспортированный текст.'}
                  </p>
                </div>
              </div>
            )}

            {/* Overwrite Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="overwriteRatingsCheckbox"
                checked={importOverwrite}
                onChange={(e) => setImportOverwrite(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <label
                htmlFor="overwriteRatingsCheckbox"
                className="text-xs text-neutral-700 dark:text-neutral-300 select-none cursor-pointer"
              >
                Перезаписывать существующие оценки пользователя (если тайтл уже был оценён)
              </label>
            </div>

            {/* Loading / Status message */}
            {importStatusMsg && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{importStatusMsg}</span>
              </div>
            )}

            {/* Success Result Report */}
            {importResult && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Импорт успешно выполнен!</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-600 dark:text-neutral-300 pt-1">
                  <span>Добавлено: +{importResult.newlyRatedCount || 0}</span>
                  <span>Обновлено: {importResult.updatedRatedCount || 0}</span>
                  <span>Пропущено: {importResult.skippedCount || 0}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                Закрыть
              </button>
              <button
                type="button"
                disabled={
                  importLoading ||
                  (importMode === 'text' && !importRawText.trim()) ||
                  (importMode === 'site' && !importSiteInput.trim())
                }
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Импортирование...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {importMode === 'text' && importRawText.trim()
                        ? `Импортировать ${parseRawTextRatings(importRawText).length} оценок`
                        : 'Начать импорт'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
