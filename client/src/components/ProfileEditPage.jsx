import React, { useState, useRef } from 'react';
import { ArrowLeft, User, Mail, Lock, Check, AlertCircle, Camera, Image, Trash2 } from 'lucide-react';
import { apiUrl } from '../api';
import { invalidateMediaCache, cacheMediaDataUrl } from '../utils/userMediaCache';
import { saveCustomUserEdit } from '../utils/customEditsStorage';
import { setCachedUserProfile } from '../utils/profileCache';

export default function ProfileEditPage({
  user,
  onNavigate,
  onUserUpdated
}) {
  const [nickname, setNickname] = useState(user ? user.nickname : '');
  const [email, setEmail] = useState(user ? user.email : '');
  const [avatarUrl, setAvatarUrl] = useState(user ? user.avatarUrl || '' : '');
  const [bannerUrl, setBannerUrl] = useState(user ? (user.bannerUrl || '').split('#top5=')[0] : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  if (!user) {
    return (
      <div className="py-24 text-center">
        <p className="text-base font-bold text-neutral-900 dark:text-white">
          Пожалуйста, войдите в систему
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

  // Compress image to fast-loading WebP/JPEG using client-side canvas
  const compressImageFile = (file, maxWidth, maxHeight, quality = 0.85) => {
    return new Promise((resolve) => {
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle local image file read with automated canvas compression
  const handleFileChange = async (e, setUrl, type = 'avatar') => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError('Файл слишком большой. Выберите изображение до 20 МБ.');
      return;
    }

    try {
      const maxWidth = type === 'banner' ? 1280 : 400;
      const maxHeight = type === 'banner' ? 500 : 400;
      const optimizedDataUrl = await compressImageFile(file, maxWidth, maxHeight, 0.85);
      setUrl(optimizedDataUrl);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = () => setUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('anime_auth_token');

      let finalBanner = bannerUrl ? bannerUrl.split('#top5=')[0] : null;
      let top5Frag = '';
      if (user?.bannerUrl && user.bannerUrl.includes('#top5=')) {
        top5Frag = '#top5=' + user.bannerUrl.split('#top5=')[1];
      } else {
        try {
          const saved = localStorage.getItem('anilex_top5_' + user?.id);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.length > 0) top5Frag = '#top5=' + parsed.join(',');
          }
        } catch (err) {}
      }
      if (finalBanner && top5Frag) {
        finalBanner = finalBanner + top5Frag;
      } else if (!finalBanner && top5Frag) {
        finalBanner = top5Frag;
      }

      // Optimistic updated user object
      const updatedUser = {
        ...user,
        nickname: nickname.trim(),
        email: email.trim(),
        avatarUrl: avatarUrl || null,
        bannerUrl: finalBanner
      };

      // 1. Immediately persist locally (0ms) so it's NEVER lost
      if (user?.id) {
        saveCustomUserEdit(user.id, {
          nickname: updatedUser.nickname,
          email: updatedUser.email,
          avatarUrl: updatedUser.avatarUrl,
          bannerUrl: updatedUser.bannerUrl
        });
        setCachedUserProfile(updatedUser);
        if (avatarUrl && avatarUrl.startsWith('data:')) {
          cacheMediaDataUrl(updatedUser.avatarUrl, avatarUrl);
        }
        if (finalBanner && finalBanner.startsWith('data:')) {
          cacheMediaDataUrl(updatedUser.bannerUrl, finalBanner);
        }
      }

      const body = {
        nickname: nickname.trim(),
        email: email.trim(),
        avatarUrl: avatarUrl || null,
        bannerUrl: finalBanner
      };

      if (newPassword.trim()) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword.trim();
      }

      let res = null;
      let data = null;
      try {
        res = await fetch(apiUrl('/api/auth/profile'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000)
        });
        if (res) data = await res.json();
      } catch (netErr) {
        console.warn('Network sync delayed/offline, changes saved locally:', netErr);
      }

      const activeUser = (data && data.user) ? data.user : updatedUser;
      const activeToken = (data && data.token) ? data.token : token;

      if (user?.avatarUrl && user.avatarUrl !== activeUser.avatarUrl) {
        invalidateMediaCache(user.avatarUrl);
      }
      if (user?.bannerUrl && user.bannerUrl !== activeUser.bannerUrl) {
        invalidateMediaCache(user.bannerUrl);
      }

      if (onUserUpdated) {
        onUserUpdated(activeUser, activeToken);
      }

      setSuccess('Профиль успешно обновлен!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-150">
      
      {/* Back button */}
      <button
        onClick={() => onNavigate('profile')}
        className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#151518] text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Назад в профиль</span>
      </button>

      {/* Main Settings Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151518] p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Редактирование профиля
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Загрузите свой баннер, аватарку и настройте данные аккаунта
          </p>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Banner & Avatar Visual Preview & Upload Area */}
        <div className="space-y-4">
          
          {/* Banner Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Баннер профиля
            </label>
            <div className="relative h-36 sm:h-44 rounded-3xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center group">
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt="Баннер профиля"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Image className="w-8 h-8 mx-auto text-neutral-400 mb-1 opacity-60" />
                  <p className="text-xs text-neutral-400">Баннер не установлен</p>
                </div>
              )}

              {/* Banner Controls Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current && bannerInputRef.current.click()}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-xs font-semibold flex items-center gap-2 shadow-lg"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{bannerUrl ? 'Заменить баннер' : 'Загрузить баннер'}</span>
                </button>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    title="Удалить баннер"
                    className="p-2 rounded-xl bg-red-600 text-white text-xs font-semibold shadow-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Hidden file input for banner */}
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, setBannerUrl, 'banner')}
            />
          </div>

          {/* Avatar Upload Box */}
          <div className="flex items-center gap-5 pt-2">
            <div className="relative w-20 h-20 rounded-3xl overflow-hidden bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-2xl shrink-0 shadow-md group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Аватарка"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{nickname ? nickname.charAt(0).toUpperCase() : 'U'}</span>
              )}

              {/* Overlay on hover */}
              <div
                onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Аватарка профиля
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors"
                >
                  Выбрать файл
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-3 py-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-medium transition-colors"
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Поддерживаются форматы PNG, JPG, WebP до 15 МБ
              </p>
            </div>

            {/* Hidden file input for avatar */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, setAvatarUrl, 'avatar')}
            />
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-transparent">
          
          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              Имя пользователя (Никнейм)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ваш никнейм..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              Почта (Email)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-transparent">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Смена пароля (необязательно)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Текущий пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Новый пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 3 символа"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="px-5 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
