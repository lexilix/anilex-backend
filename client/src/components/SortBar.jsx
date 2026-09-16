import React, { useState } from 'react';
import { Sparkles, Clock, TrendingUp, ChevronDown, Star } from 'lucide-react';

const sortOptions = [
  { id: 'newest', label: 'Самые новые', icon: Clock, desc: 'По новизне и дате добавления' },
  { id: 'rating', label: 'С наилучшим рейтингом', icon: TrendingUp, desc: 'По оценкам пользователей сайта' },
  { id: 'my_score_desc', label: 'Топ мои оценки', icon: Star, desc: 'Сначала тайтлы с вашей максимальной оценкой' },
  { id: 'recommendations', label: 'Рекомендации', icon: Sparkles, desc: 'На основе ваших любимых жанров (оценка 8+)' }
];

export default function SortBar({
  currentSort,
  onSortChange,
  totalCount,
  user,
  recommendationCount
}) {
  const [open, setOpen] = useState(false);
  const activeOption = sortOptions.find(o => o.id === currentSort) || sortOptions[0];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      
      {/* Left Sort Dropdown */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-medium">Сортировка:</span>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#151518] text-neutral-900 dark:text-white text-xs sm:text-sm font-semibold shadow-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <activeOption.icon className="w-4 h-4 text-neutral-500" />
            <span>{activeOption.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-1" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#1a1a1e] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              {sortOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = opt.id === currentSort;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSortChange(opt.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}

              {currentSort === 'recommendations' && !user && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-700 dark:text-amber-300">
                  💡 Войдите в профиль и поставьте оценку 8 или выше, чтобы сайт рекомендовал тайтлы по вашим предпочтениям.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Count */}
      <div className="text-xs text-neutral-400 font-medium">
        Найдено: <span className="font-bold text-neutral-700 dark:text-neutral-200">{totalCount}</span> тайтлов
      </div>
    </div>
  );
}
