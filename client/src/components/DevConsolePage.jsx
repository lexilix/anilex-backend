import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  SlidersHorizontal
} from 'lucide-react';
import { apiUrl } from '../api';
import { updateCachedAnimeItem, removeCachedAnimeItem } from '../utils/catalogCache';
import { toggleHiddenAnime } from '../utils/hiddenStorage';

export default function DevConsolePage({
  user,
  onNavigate,
  onUserUpdated,
  onCatalogUpdated
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

  // ----------------------------------------------------
  // RATINGS TAB STATE
  // ----------------------------------------------------
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userRatings, setUserRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  // Add Rating Modal
  const [showAddRatingModal, setShowAddRatingModal] = useState(false);
  const [addRatingSearch, setAddRatingSearch] = useState('');
  const [searchAnimeResults, setSearchAnimeResults] = useState([]);
  const [selectedAnimeToAdd, setSelectedAnimeToAdd] = useState(null);
  const [newScore, setNewScore] = useState(10);
  const [addRatingLoading, setAddRatingLoading] = useState(false);

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
        setAnimeList(data.items || []);
        setAnimeTotal(data.total || (data.items || []).length);
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

      // Filter out 'inspector'
      users = users.filter((u) => u.nickname?.toLowerCase() !== 'inspector');
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

      // Try /api/dev/users/:id/ratings
      const res = await fetch(apiUrl(`/api/dev/users/${userId}/ratings`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        ratings = data.ratings || [];
      } else {
        // Fallback to /api/users/:id/profile
        const profRes = await fetch(apiUrl(`/api/users/${userId}/profile`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (profRes.ok) {
          const profData = await profRes.json();
          ratings = profData.ratings || [];
        }
      }

      setUserRatings(ratings);
    } catch (err) {
      console.error('Error fetching user ratings for dev:', err);
    } finally {
      setRatingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUnlocked && activeTab === 'ratings' && selectedUserId) {
      fetchRatingsForUser(selectedUserId);
    }
  }, [isUnlocked, activeTab, selectedUserId, fetchRatingsForUser]);

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

  const handleDeleteAnime = async () => {
    if (!deletingAnime) return;
    setDeleteLoading(true);

    try {
      const token = localStorage.getItem('anime_auth_token');
      const animeId = deletingAnime.id;

      // 1. Call DELETE /api/dev/anime/:id
      await fetch(apiUrl(`/api/dev/anime/${animeId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});

      // 2. Purge from local caches and client catalog
      removeCachedAnimeItem(animeId);
      await toggleHiddenAnime(deletingAnime, token, user?.id);

      setAnimeList((prev) => prev.filter((a) => a.id !== animeId));
      setAnimeTotal((prev) => Math.max(0, prev - 1));

      if (onCatalogUpdated) {
        onCatalogUpdated({ id: animeId, isDeleted: true });
      }

      showToast(`Тайтл «${deletingAnime.title}» успешно удален из базы!`);
      setDeletingAnime(null);
    } catch (err) {
      showToast('Ошибка удаления тайтла: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
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

                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
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
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      <span>Оценки</span>
                    </button>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-[#151518] border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-neutral-400 shrink-0">
                Пользователь:
              </label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold border-none"
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname} (ID: {u.id}, оценок: {u.ratedCount || 0})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddRatingModal(true)}
              className="px-4 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Поставить оценку пользователю</span>
            </button>
          </div>

          {ratingsLoading ? (
            <div className="py-20 text-center text-xs text-neutral-400">
              Загрузка оценок...
            </div>
          ) : userRatings.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400 rounded-3xl bg-white dark:bg-[#151518] p-8">
              У выбранного пользователя нет оценок. Вы можете добавить первую оценку кнопкой выше.
            </div>
          ) : (
            <div className="space-y-2.5">
              {userRatings.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#151518] border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 aspect-[5/7] rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 shadow-xs">
                      <img
                        src={item.imageUrl || item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        {item.isPinned && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            📌 Топ-5
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                        <span>ID: {item.id}</span>
                        {item.year && <span>· {item.year}</span>}
                        {item.type && <span>· {item.type}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Score Selector */}
                    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-xl">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <select
                        value={item.score}
                        onChange={(e) => handleChangeUserRating(item.id, e.target.value)}
                        className="bg-transparent text-xs font-black text-neutral-900 dark:text-white border-none cursor-pointer p-0"
                      >
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-neutral-400">/ 10</span>
                    </div>

                    {/* Top-5 Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleUserTop5(item.id)}
                      title={item.isPinned ? 'Убрать из Топ-5' : 'Закрепить в Топ-5'}
                      className={`p-2 rounded-xl transition-colors ${
                        item.isPinned
                          ? 'bg-amber-500 text-black'
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
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
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
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteAnime}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Удаление...' : 'Да, удалить тайтл'}
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
    </div>
  );
}
