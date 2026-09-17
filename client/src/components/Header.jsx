import React, { useState } from 'react';
import { Search, Moon, Sun, User, LogOut, Settings, Bookmark, Bell, Loader2, ShieldAlert } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

export default function Header({
  user,
  onOpenAuth,
  onLogout,
  searchQuery,
  onSearchChange,
  isSearching = false,
  darkMode,
  setDarkMode,
  onNavigate,
  onLogoClick,
  notifications = [],
  unreadNotificationsCount = 0,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onDeleteNotification,
  onAcceptFriendNotification,
  onRejectFriendNotification,
  onNavigateAnimeNotification
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#f5f5f7]/90 dark:bg-[#0e0e11]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand / Logo - Navigates to home with full reset */}
        <div
          onClick={() => {
            if (onLogoClick) {
              onLogoClick();
            } else if (onNavigate) {
              onNavigate('catalog');
            }
          }}
          className="flex items-center gap-3 shrink-0 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 32 32" className="w-4.5 h-4.5 fill-current" aria-hidden="true">
              {/* Shaman King: Spirit of Fire (Hao Flame) with diamond core */}
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M16 3C18 9 20.5 13 20.5 18C20.5 24 16.5 28 16 28C15.5 28 11.5 24 11.5 18C11.5 13 14 9 16 3ZM16 14L18 18L16 22L14 18L16 14Z"
              />
              <path d="M12 11C10 14.5 6 18 6 22C6 26 9.5 28 12 27C9.5 24 9.5 20 12.5 15L12 11Z" />
              <path d="M20 11C22 14.5 26 18 26 22C26 26 22.5 28 20 27C22.5 24 22.5 20 19.5 15L20 11Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white leading-none group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
              Anilex
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal leading-tight mt-0.5">
              рейтинг аниме
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md relative hidden sm:block">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (onNavigate && e.target.value.trim()) {
                onNavigate('catalog');
              }
            }}
            placeholder="Поиск по названию аниме..."
            className="w-full pl-10 pr-9 py-2 text-sm rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:bg-white dark:focus:bg-neutral-800 transition-colors"
          />
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-neutral-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          ) : searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Dark / Light toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
            title={darkMode ? 'Светлая тема' : 'Темная тема'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowMenu(false);
                }}
                className="relative p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
                title="Уведомления"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <NotificationDropdown
                    notifications={notifications}
                    unreadCount={unreadNotificationsCount}
                    onClose={() => setShowNotifications(false)}
                    onMarkAsRead={onMarkNotificationAsRead}
                    onMarkAllAsRead={onMarkAllNotificationsAsRead}
                    onDeleteNotification={onDeleteNotification}
                    onAcceptFriend={onAcceptFriendNotification}
                    onRejectFriend={onRejectFriendNotification}
                    onNavigateAnime={onNavigateAnimeNotification}
                  />
                </>
              )}
            </div>
          )}

          {/* Dev Console button for Just */}
          {user && (user.nickname === 'Just' || user.email === 'just9jeeet@gmail.com' || user.id === 5) && (
            <button
              onClick={() => onNavigate('dev-console')}
              className="p-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Консоль разработчика Just"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span className="hidden md:inline">Dev Console</span>
            </button>
          )}

          {/* User auth or profile */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U'}</span>
                  )}
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-neutral-800 dark:text-neutral-200 max-w-[100px] truncate">
                  {user.nickname}
                </span>
                <span className="text-[10px] text-neutral-400">▼</span>
              </button>

              {/* User Dropdown (Clean, zero mocks) */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#1a1a1e] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2.5 border-b border-transparent">
                      <p className="text-xs text-neutral-400 font-medium">Текущий профиль</p>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {user.nickname}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                    </div>

                    <div className="py-1">
                      {/* Just Dev Console Link */}
                      {(user.nickname === 'Just' || user.email === 'just9jeeet@gmail.com' || user.id === 5) && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onNavigate('dev-console');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 flex items-center gap-2.5 transition-colors mb-1"
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-500" />
                          <span>Консоль разработчика</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onNavigate('profile');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors"
                      >
                        <User className="w-4 h-4 text-neutral-400" />
                        <span>Мой профиль и оценки</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onNavigate('profile');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors"
                      >
                        <Bookmark className="w-4 h-4 text-neutral-400" />
                        <span>Избранное</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onNavigate('profile-edit');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-neutral-400" />
                        <span>Настройки профиля</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-transparent">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Выйти из профиля</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <User className="w-4 h-4" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search input */}
      <div className="px-4 pb-3 sm:hidden">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (onNavigate && e.target.value.trim()) {
                onNavigate('catalog');
              }
            }}
            placeholder="Поиск аниме..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-neutral-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          ) : searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
