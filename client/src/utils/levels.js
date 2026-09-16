/**
 * Creative Otaku Ranks and Levels configuration based on number of rated anime.
 */

export const LEVELS_CONFIG = [
  {
    level: 1,
    minCount: 0,
    maxCount: 4,
    title: 'Новичок в гильдии',
    franchise: 'Ребёнок идола',
    iconName: 'Star',
    barColor: 'bg-pink-400 dark:bg-pink-500',
    iconBg: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60',
    bgBadge: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border-pink-200 dark:border-pink-800/60',
    border: 'border-pink-200 dark:border-pink-800/50',
    accentColor: '#f472b6',
    description: 'Ребёнок идола: Первые звёзды харизмы зажглись во взгляде. Ты только ступил на порог удивительного мира аниме!',
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
    title: 'Мастер Духов',
    franchise: 'Шаман Кинг',
    iconName: 'Ghost',
    barColor: 'bg-emerald-400 dark:bg-emerald-500',
    iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
    bgBadge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    accentColor: '#10b981',
    description: 'Шаман Кинг: Твоя связь с миром духов крепнет. Дух-хранитель указывает путь к лучшим историям.',
    rewards: [
      'Специальный бейдж Мастера Духов в профиле',
      'Доступ к фильтрации каталога по личным оценкам',
      'Открытие вкладки персональных рекомендаций'
    ]
  },
  {
    level: 3,
    minCount: 15,
    maxCount: 29,
    title: 'Ценитель классики',
    franchise: 'Магическая битва',
    iconName: 'Zap',
    barColor: 'bg-slate-500 dark:bg-slate-400',
    iconBg: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
    bgBadge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    border: 'border-slate-300 dark:border-slate-700',
    accentColor: '#64748b',
    description: 'Магическая битва: Кокусэн! Вспышка концентрированной энергии. Ты мгновенно отличаешь золотую классику от проходных тайтлов.',
    rewards: [
      'Пастельный бейдж знатока в профиле и друзьях',
      'Доступ к жанровой фильтрации в профиле друга',
      'Повышенное доверие к твоим рецензиям'
    ]
  },
  {
    level: 4,
    minCount: 30,
    maxCount: 49,
    title: 'Стратег',
    franchise: 'Нет игры — нет жизни',
    iconName: 'Gamepad2',
    barColor: 'bg-indigo-400 dark:bg-indigo-500',
    iconBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60',
    bgBadge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    border: 'border-indigo-200 dark:border-indigo-800/50',
    accentColor: '#818cf8',
    description: 'Нет игры — нет жизни: «Пустые никогда не проигрывают». Твой аналитический ум просчитывает сюжетные ходы на 20 шагов вперёд.',
    rewards: [
      'Титул «Стратег» рядом с никнеймом',
      'Приоритетный блок Топ любимых тайтлов в профиле',
      'Особый статус знатока запутанных сюжетов'
    ]
  },
  {
    level: 5,
    minCount: 50,
    maxCount: 99,
    title: 'Завсегдатай клуба',
    franchise: 'Ребёнок идола',
    iconName: 'Sparkles',
    barColor: 'bg-orange-400 dark:bg-orange-500',
    iconBg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60',
    bgBadge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
    border: 'border-orange-200 dark:border-orange-800/50',
    accentColor: '#fb923c',
    description: 'Ребёнок идола: Сияние софитов главной сцены! Тебя знают завсегдатаи сообщества, а твоим оценкам доверяют единомышленники.',
    rewards: [
      'Статус яркого завсегдатая сообщества',
      'Доступ к углубленной статистике жанров',
      'Пастельная персиковая плашка ранга'
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
    description: 'Нет игры — нет жизни: Все 16 шахматных фигур рас собраны. Законы Дисборда подчиняются твоему непревзойдённому вкусу.',
    rewards: [
      'Королевская корона Владыки Дисборда в профиле',
      'VIP-ранг в списке друзей и рекомендациях',
      'Доступ к эксклюзивной аналитике франшиз'
    ]
  },
  {
    level: 7,
    minCount: 200,
    maxCount: 349,
    title: 'Мастер Оверсоула',
    franchise: 'Шаман Кинг',
    iconName: 'Swords',
    barColor: 'bg-sky-400 dark:bg-sky-500',
    iconBg: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60',
    bgBadge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    border: 'border-sky-200 dark:border-sky-800/50',
    accentColor: '#38bdf8',
    description: 'Шаман Кинг: Полный контроль фурёку и единение с клинком. Ты воплотил непоколебимый Оверсоул.',
    rewards: [
      'Бейдж высшего шамана в профиле',
      'Отметка эксперта боевых сёнэнов в обсуждениях',
      'Титул признанного мастера сообщества'
    ]
  },
  {
    level: 8,
    minCount: 350,
    maxCount: 499,
    title: 'Легенда Аниме-мира',
    franchise: 'Магическая битва',
    iconName: 'Eye',
    barColor: 'bg-teal-400 dark:bg-teal-500',
    iconBg: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60',
    bgBadge: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
    border: 'border-teal-200 dark:border-teal-800/50',
    accentColor: '#2dd4bf',
    description: 'Магическая битва: Шесть Глаз Рикуган. Ты улавливаешь мельчайшие детали анимации, режиссуры и работы сейю.',
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
    title: 'Хранитель Вечности',
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
