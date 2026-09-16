import React, { useState } from 'react';
import { Filter, X, Film, Star, Users, Calendar, RotateCcw, RefreshCw, Lock } from 'lucide-react';

export default function FilterSidebar({
  genres = [],
  activeGenres = [],
  onToggleGenre,
  types = [],
  activeType = 'all',
  onSelectType,
  activeYear = 'all',
  onSelectYear,
  filterStatus = 'all',
  onSelectStatus,
  sort = 'newest',
  onSelectSort,
  onResetFilters,
  onSyncAnimeGo,
  syncLoading,
  friends = [],
  user,
  onOpenFriendsSearch
}) {
  const [showAllGenres, setShowAllGenres] = useState(false);
  const displayedGenres = showAllGenres ? genres : genres.slice(0, 14);

  const hasActiveFilters =
    activeGenres.length > 0 ||
    activeType !== 'all' ||
    filterStatus !== 'all' ||
    (activeYear && activeYear !== 'all') ||
    sort === 'year_desc' ||
    sort === 'year_asc';

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
      
      {/* Filters Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 shadow-sm space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              Фильтры
            </h2>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1 font-medium"
            >
              <span>Сбросить</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Release Year Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Год релиза
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => onSelectYear && onSelectYear('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                !activeYear || activeYear === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Все
            </button>
            {['2026', '2025', '2024', '2023', '2022', '2021', '2020'].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => onSelectYear && onSelectYear(activeYear === yr ? 'all' : yr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  activeYear === yr
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* More years selector */}
          <div className="relative">
            <select
              value={['2026', '2025', '2024', '2023', '2022', '2021', '2020', 'all'].includes(activeYear) ? '' : activeYear}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectYear && onSelectYear(e.target.value);
                }
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-none outline-none cursor-pointer"
            >
              <option value="">Другой год...</option>
              {Array.from({ length: 30 }, (_, i) => String(2019 - i)).map((y) => (
                <option key={y} value={y}>
                  {y} год
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Статус оценки
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80">
            {[
              { id: 'all', label: 'Все тайтлы' },
              { id: 'friends_rated', label: 'Есть оценки' },
              { id: 'my_rated', label: 'Мои оценки' },
              { id: 'my_unrated', label: 'Не оценённые' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectStatus(st.id)}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium text-center transition-colors truncate ${
                  filterStatus === st.id
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Тип тайтла
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSelectType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                activeType === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Все
            </button>
            {types.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => onSelectType(t.type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  activeType === t.type
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t.type}
              </button>
            ))}
          </div>
        </div>

        {/* Genres Multi-select */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Жанры {activeGenres.length > 0 && `(${activeGenres.length})`}
            </label>
            {activeGenres.length > 0 && (
              <button
                type="button"
                onClick={() => onToggleGenre('clear_all')}
                className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                Очистить
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {displayedGenres.map((g) => {
              const isSelected = activeGenres.includes(g.name);
              return (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => onToggleGenre(g.name)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold scale-105 shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <span>{g.name}</span>
                  {g.count !== undefined && (
                    <span
                      className={`text-[10px] ${
                        isSelected ? 'opacity-70' : 'text-neutral-400'
                      }`}
                    >
                      {g.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {genres.length > 14 && (
            <button
              type="button"
              onClick={() => setShowAllGenres(!showAllGenres)}
              className="mt-2.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-medium block transition-colors"
            >
              {showAllGenres ? 'Свернуть список' : `Показать все жанры (${genres.length})`}
            </button>
          )}
        </div>

        {/* Sync from AnimeGO button */}
        <div className="pt-2 border-t border-transparent">
          <button
            type="button"
            disabled={syncLoading}
            onClick={onSyncAnimeGo}
            className="w-full py-2.5 px-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
            <span>{syncLoading ? 'Синхронизация...' : 'Загрузить ещё с AnimeGO'}</span>
          </button>
          <p className="text-[10px] text-neutral-400 text-center mt-1.5">
            Каталог с картинками animego.me
          </p>
        </div>
      </div>

      {/* Friends (Sticky sidebar) */}
      <div className="rounded-3xl bg-white dark:bg-[#151518] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              Друзья
            </h2>
          </div>
          {onOpenFriendsSearch && (
            <button
              type="button"
              onClick={onOpenFriendsSearch}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-medium transition-colors"
            >
              Найти →
            </button>
          )}
        </div>

        {!user ? (
          <div className="p-3.5 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 space-y-2.5">
            <Lock className="w-5 h-5 mx-auto text-neutral-400" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-snug">
              Войдите или зарегистрируйтесь, чтобы добавлять друзей и видеть их оценки.
            </p>
            <button
              type="button"
              onClick={onOpenFriendsSearch}
              className="w-full py-2 px-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white text-xs font-semibold transition-colors"
            >
              Войти в аккаунт
            </button>
          </div>
        ) : (
          <>
            {friends && friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold flex items-center justify-center shrink-0">
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt={friend.nickname} className="w-full h-full object-cover" />
                        ) : (
                          <span>{friend.nickname ? friend.nickname.charAt(0).toUpperCase() : 'U'}</span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-neutral-900 dark:text-white block">
                          {friend.nickname}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {friend.rated_count || 0}
                      </span>
                      <span className="text-neutral-400 ml-1 text-[11px]">оценок</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900/40">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Пока нет друзей.
                </p>
              </div>
            )}

            {onOpenFriendsSearch && (
              <button
                type="button"
                onClick={onOpenFriendsSearch}
                className="w-full py-2 px-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Найти друзей</span>
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
