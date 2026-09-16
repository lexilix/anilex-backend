/**
 * Creative Otaku Ranks and Levels configuration based on number of rated anime.
 */

export const LEVELS_CONFIG = [
  {
    level: 1,
    minCount: 0,
    maxCount: 4,
    title: 'Новичок в гильдии',
    badge: '🌱',
    iconName: 'Sprout',
    color: 'from-emerald-400 to-teal-600',
    border: 'border-emerald-500/30',
    bgBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    accentColor: '#10b981',
    description: 'Ты только ступил на порог удивительного мира аниме. Впереди тысячи захватывающих приключений!',
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
    title: 'Искатель историй',
    badge: '📜',
    iconName: 'Scroll',
    color: 'from-blue-400 to-indigo-600',
    border: 'border-blue-500/30',
    bgBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    accentColor: '#3b82f6',
    description: 'Первые 5 тайтлов за спиной! Твой кругозор расширяется, начинают формироваться любимые жанры.',
    rewards: [
      'Бронзовый бейдж уровня в профиле',
      'Доступ к фильтрации каталога по личным оценкам',
      'Открытие вкладки персональных рекомендаций'
    ]
  },
  {
    level: 3,
    minCount: 15,
    maxCount: 29,
    title: 'Ценитель классики',
    badge: '⚔️',
    iconName: 'Sword',
    color: 'from-violet-400 to-purple-600',
    border: 'border-violet-500/30',
    bgBadge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    accentColor: '#8b5cf6',
    description: '15+ тайтлов! Ты уже легко отличишь сёнэн от сэйнэна и можешь давать взвешенные советы друзьям.',
    rewards: [
      'Серебряный бейдж в профиле и списке друзей',
      'Доступ к расширенной жанровой фильтрации в профиле друга',
      'Повышенный авторитет в обсуждениях и комментариях'
    ]
  },
  {
    level: 4,
    minCount: 30,
    maxCount: 49,
    title: 'Завсегдатай клуба',
    badge: '🏮',
    iconName: 'Flame',
    color: 'from-amber-400 to-orange-600',
    border: 'border-amber-500/30',
    bgBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    accentColor: '#f59e0b',
    description: '30+ тайтлов! Тебя знают завсегдатаи сообщества, а твоим оценкам доверяют единомышленники.',
    rewards: [
      'Золотой мерцающий бейдж с искрами',
      'Приоритетный блок Топ-5 любимых тайтлов в профиле',
      'Особый статус завсегдатая аниме-сообщества'
    ]
  },
  {
    level: 5,
    minCount: 50,
    maxCount: 99,
    title: 'Сенсей жанров',
    badge: '🌸',
    iconName: 'Flower2',
    color: 'from-pink-400 to-rose-600',
    border: 'border-pink-500/30',
    bgBadge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    accentColor: '#ec4899',
    description: 'Полсотни шедевров! Твой вкус отточен как клинок катаны, ты видел золотые шедевры анимации.',
    rewards: [
      'Сакуровый бейдж «Сенсей» рядом с никнеймом',
      'Изумрудно-розовая градиентная рамка аватара в профиле',
      'Специальный статус эксперта редких онгоингов'
    ]
  },
  {
    level: 6,
    minCount: 100,
    maxCount: 199,
    title: 'Мастер Отаку',
    badge: '👑',
    iconName: 'Crown',
    color: 'from-yellow-400 via-amber-500 to-red-600',
    border: 'border-yellow-500/30',
    bgBadge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    accentColor: '#eab308',
    description: 'Сотня оцененных аниме! Твой багаж знаний превосходит целые библиотеки академии магии.',
    rewards: [
      'Королевская золотая корона в профиле',
      'Рубиновый статус и VIP-метка в друзьях',
      'Доступ к эксклюзивной аналитике любимых франшиз'
    ]
  },
  {
    level: 7,
    minCount: 200,
    maxCount: 349,
    title: 'Легенда Аниме-мира',
    badge: '🌌',
    iconName: 'Sparkles',
    color: 'from-cyan-400 via-blue-500 to-indigo-700',
    border: 'border-cyan-500/30',
    bgBadge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    accentColor: '#06b6d4',
    description: '200+ тайтлов! Никакие сюжетные повороты тебя не удивят. Ты ходячая энциклопедия мира анимации.',
    rewards: [
      'Космический анимированный градиент ранга',
      'Легендарная звёздная плашка в шапке профиля',
      'Титул «Легенда клуба» во всех списках'
    ]
  },
  {
    level: 8,
    minCount: 350,
    maxCount: 499,
    title: 'Владыка измерений',
    badge: '⚡',
    iconName: 'Zap',
    color: 'from-fuchsia-500 via-purple-600 to-cyan-500',
    border: 'border-fuchsia-500/30',
    bgBadge: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20',
    accentColor: '#d946ef',
    description: '350+ тайтлов! Ты путешествуешь между параллельными вселенными быстрее любого грузовика-сана.',
    rewards: [
      'Мифическая аура профиля с неоновыми молниями',
      'Эксклюзивный титул повелителя мультивселенной',
      'Высший уровень доверия и влияния в сообществе'
    ]
  },
  {
    level: 9,
    minCount: 500,
    maxCount: 999999,
    title: 'Хранитель Вечности',
    badge: '💎',
    iconName: 'Gem',
    color: 'from-rose-400 via-purple-500 to-amber-400',
    border: 'border-amber-400/40',
    bgBadge: 'bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/20',
    accentColor: '#f43f5e',
    description: '500+ тайтлов! Абсолютный божественный уровень. Твоё имя высечено алмазными рунами в вечности.',
    rewards: [
      'Божественный призматический бейдж Бесконечности',
      'Вечный статус Патриарха Аниме-сообщества',
      'Абсолютный почёт и уважение всех поколений отаку'
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
