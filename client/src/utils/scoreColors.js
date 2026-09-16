// Color palette for scores 0-10 (No gradients, strict minimalist flat colors)
// 0: Red (#dc2626)
// 5: Yellow (#eab308)
// 10: Blue (#2563eb)
// Transitional shades between them

export const SCORE_COLORS = {
  0: { bg: 'bg-red-600', text: 'text-white', hex: '#dc2626', label: 'Ужасно' },
  1: { bg: 'bg-red-500', text: 'text-white', hex: '#ef4444', label: 'Очень плохо' },
  2: { bg: 'bg-orange-600', text: 'text-white', hex: '#ea580c', label: 'Плохо' },
  3: { bg: 'bg-orange-500', text: 'text-white', hex: '#f97316', label: 'Ниже среднего' },
  4: { bg: 'bg-amber-500', text: 'text-white', hex: '#f59e0b', label: 'Почти нормально' },
  5: { bg: 'bg-yellow-500', text: 'text-neutral-950 font-bold', hex: '#eab308', label: 'Средне' },
  6: { bg: 'bg-lime-500', text: 'text-neutral-950 font-bold', hex: '#84cc16', label: 'Выше среднего' },
  7: { bg: 'bg-emerald-500', text: 'text-white', hex: '#10b981', label: 'Хорошо' },
  8: { bg: 'bg-teal-500', text: 'text-white', hex: '#14b8a6', label: 'Отлично' },
  9: { bg: 'bg-cyan-600', text: 'text-white', hex: '#0891b2', label: 'Великолепно' },
  10: { bg: 'bg-blue-600', text: 'text-white', hex: '#2563eb', label: 'Шедевр' }
};

export function getScoreConfig(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return null;
  }
  const rounded = Math.round(Number(score));
  const clamped = Math.max(0, Math.min(10, rounded));
  return SCORE_COLORS[clamped] || SCORE_COLORS[5];
}

export function getScoreBgClass(score) {
  const cfg = getScoreConfig(score);
  return cfg ? cfg.bg : 'bg-neutral-800';
}

export function getScoreBadgeClass(score) {
  const cfg = getScoreConfig(score);
  return cfg ? `${cfg.bg} ${cfg.text}` : 'bg-neutral-800 text-neutral-300';
}
