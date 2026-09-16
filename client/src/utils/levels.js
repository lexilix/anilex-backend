/**
 * Creative Otaku Ranks and Levels configuration based on number of rated anime.
 */

export const LEVELS_CONFIG = [
  {
    level: 1,
    minCount: 0,
    maxCount: 4,
    title: 'Медиум Духов',
    franchise: 'Шаман Кинг',
    iconName: 'Ghost',
    barColor: 'bg-emerald-400 dark:bg-emerald-500',
    iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
    bgBadge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    accentColor: '#10b981',
    description: 'Шаман Кинг: Первые шаги в мире духов. Ты учишься видеть невидимое и делаешь свои первые шаги к великому турниру.',
    rewards: [
      'Базовый статус участника аниме-клуба',
      'Возможность оценивать тайтлы от 0 до 10',
      'Добавление тайтлов в избранное и поиск друзей'
    ]
  },
  {
    level: 2,
    minCount: 5,
    maxCount: 14,
    title: 'Мастер Оверсоула',
    franchise: 'Шаман Кинг',
    iconName: 'Swords',
    barColor: 'bg-sky-400 dark:bg-sky-500',
    iconBg: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60',
    bgBadge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    border: 'border-sky-200 dark:border-sky-800/50',
    accentColor: '#38bdf8',
    description: 'Шаман Кинг: Ты подчинил силу фурёку и воплотил истинный Оверсоул в любимом клинке Амидамару.',
    rewards: [
      'Специальный бейдж уровня в профиле',
      'Доступ к фильтрации каталога по личным оценкам',
      'Открытие вкладки персональных рекомендаций'
    ]
  },
  {
    level: 3,
    minCount: 15,
    maxCount: 29,
    title: 'Звезда Во Взгляде',
    franchise: 'Ребёнок идола',
    iconName: 'Star',
    barColor: 'bg-pink-400 dark:bg-pink-500',
    iconBg: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60',
    bgBadge: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border-pink-200 dark:border-pink-800/60',
    border: 'border-pink-200 dark:border-pink-800/50',
    accentColor: '#f472b6',
    description: 'Ребёнок идола: В твоих глазах зажглись звёзды харизмы Ай. Ты видишь сюжеты сквозь фасад сцены.',
    rewards: [
      'Пастельный бейдж Звезды в профиле и друзьях',
      'Доступ к жанровой фильтрации в профиле друга',
      'Повышенное доверие к твоим рецензиям'
    ]
  },
  {
    level: 4,
    minCount: 30,
    maxCount: 49,
    title: 'Сияние Софитов',
    franchise: 'Ребёнок идола',
    iconName: 'Sparkles',
    barColor: 'bg-orange-400 dark:bg-orange-500',
    iconBg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60',
    bgBadge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
    border: 'border-orange-200 dark:border-orange-800/50',
    accentColor: '#fb923c',
    description: 'Ребёнок идола: Главная сцена Токио Блейд твоя. Каждый просмотренный тайтл оставляет глубокий след.',
    rewards: [
      'Статус яркого завсегдатая сообщества',
      'Приоритетный блок Топ любимых тайтлов в профиле',
      'Стильная пастельная обводка карточки'
    ]
  },
  {
    level: 5,
    minCount: 50,
    maxCount: 99,
    title: 'Стратег 『　』',
    franchise: 'Нет игры — нет жизни',
    iconName: 'Gamepad2',
    barColor: 'bg-indigo-400 dark:bg-indigo-500',
    iconBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60',
    bgBadge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    border: 'border-indigo-200 dark:border-indigo-800/50',
    accentColor: '#818cf8',
    description: 'Нет игры — нет жизни: «Пустые никогда не проигрывают». Твой интеллект просчитывает сюжет на 20 ходов вперёд.',
    rewards: [
      'Титул «Стратег Пустых» рядом с никнеймом',
      'Доступ к углубленной статистике жанров',
      'Особый статус эксперта сложных сюжетов'
    ]
  },
  {
    level: 6,
    minCount: 100,
    maxCount: 199,
    title: 'Владыка Дисборда',
    franchise: 'Нет игры — нет жизни',
    iconName: 'Crown',
    barColor: 'bg-amber-400 dark:bg-amber-500',
    iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60',
    bgBadge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    border: 'border-amber-200 dark:border-amber-800/50',
    accentColor: '#fbbf24',
    description: 'Нет игры — нет жизни: Все 16 шахматных фигур рас собраны. Законы Дисборда подчиняются твоему вкусу.',
    rewards: [
      'Королевская монохромная корона в профиле',
      'VIP-ранг в списке друзей и рекомендациях',
      'Доступ к эксклюзивной аналитике франшиз'
    ]
  },
  {
    level: 7,
    minCount: 200,
    maxCount: 349,
    title: 'Чёрная Молния',
    franchise: 'Магическая битва',
    iconName: 'Zap',
    barColor: 'bg-slate-500 dark:bg-slate-400',
    iconBg: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
    bgBadge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    border: 'border-slate-300 dark:border-slate-700',
    accentColor: '#64748b',
    description: 'Магическая битва: Кокусэн! Вспышка искажения пространства. Твоё восприятие кинематографии вышло за грань.',
    rewards: [
      'Стальной монохромный бейдж мага 1-го класса',
      'Отметка опытного критика в обсуждениях',
      'Титул мастера боевых искусств и режиссуры'
    ]
  },
  {
    level: 8,
    minCount: 350,
    maxCount: 499,
    title: 'Шесть Глаз',
    franchise: 'Магическая битва',
    iconName: 'Eye',
    barColor: 'bg-teal-400 dark:bg-teal-500',
    iconBg: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60',
    bgBadge: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
    border: 'border-teal-200 dark:border-teal-800/50',
    accentColor: '#2dd4bf',
    description: 'Магическая битва: Рикуган. Ты улавливаешь мельчайшие детали анимации, режиссуры и работы сейю.',
    rewards: [
      'Особый пастельно-бирюзовый бейдж Рикуган',
      'Эксклюзивный статус высшего аналитика',
      'Высший авторитет в рекомендациях сообщества'
    ]
  },
  {
    level: 9,
    minCount: 500,
    maxCount: 999999,
    title: 'Бесконечность',
    franchise: 'Магическая битва',
    iconName: 'Infinity',
    barColor: 'bg-purple-400 dark:bg-purple-500',
    iconBg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60',
    bgBadge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    border: 'border-purple-200 dark:border-purple-800/50',
    accentColor: '#c084fc',
    description: 'Магическая битва: Необъятная бездна. Абсолютный ранг особого уровня, познавшего вечность анимации.',
    rewards: [
      'Символ Бесконечности мага особого уровня',
      'Вечный статус Патриарха Аниме-сообщества',
      'Абсолютный почёт всех поколений зрителей'
    ]
  }
];

export function getUserLevel(ratedCount = 0) {
  const count = Math.max(0, parseInt(ratedCount, 10) || 0);
  let currentLevel = LEVELS_CONFIG[0];
  let nextLevel = null;

  for (let i = 0; i < LEVELS_CONFIG.length; i++) {
    if (count >= LEVELS_CONFIG[i].minCount) {
      currentLevel = LEVELS_CONFIG[i];
      nextLevel = LEVELS_CONFIG[i + 1] || null;
    }
  }

  const neededForNext = nextLevel ? Math.max(0, nextLevel.minCount - count) : 0;
  const rangeTotal = nextLevel ? nextLevel.minCount - currentLevel.minCount : 1;
  const currentInRange = count - currentLevel.minCount;
  const progressPercent = nextLevel ? Math.min(100, Math.max(0, Math.round((currentInRange / rangeTotal) * 100))) : 100;

  return {
    currentLevel,
    nextLevel,
    count,
    neededForNext,
    progressPercent,
    isMaxLevel: !nextLevel
  };
}
