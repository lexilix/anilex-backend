/**
 * Creative Otaku Ranks and Levels configuration based on number of rated anime.
 */

export const LEVELS_CONFIG = [
  {
    level: 1,
    minCount: 0,
    maxCount: 4,
    title: 'Звёздное дитя',
    franchise: 'Ребёнок идола',
    iconName: 'OshiStar',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Ребёнок идола: Первые звёзды харизмы зажглись во взгляде. Твоё путешествие в захватывающий мир аниме только начинается!',
    rewards: [
      'Статус «Звёздное дитя» в аниме-клубе',
      'Возможность оценивать тайтлы от 0 до 10',
      'Добавление тайтлов в избранное и поиск друзей'
    ]
  },
  {
    level: 2,
    minCount: 5,
    maxCount: 14,
    title: 'Пешка Иманити',
    franchise: 'Нет игры — нет жизни',
    iconName: 'ChessPawn',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Нет игры — нет жизни: «Пешка способна переломить ход всей партии». Твои первые уверенные ходы в мире историй!',
    rewards: [
      'Монотонный бейдж Пешки Иманити в профиле',
      'Доступ к фильтрации каталога по личным оценкам',
      'Открытие вкладки персональных рекомендаций'
    ]
  },
  {
    level: 3,
    minCount: 15,
    maxCount: 29,
    title: 'Проводник Душ',
    franchise: 'Шаман Кинг',
    iconName: 'SpiritFlame',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Шаман Кинг: Твоя связь с миром духов крепнет. Дух-хранитель указывает путь к лучшим историям.',
    rewards: [
      'Специальный монотонный бейдж Проводника Душ',
      'Доступ к жанровой фильтрации в профиле друга',
      'Повышенное доверие к твоим рецензиям'
    ]
  },
  {
    level: 4,
    minCount: 30,
    maxCount: 49,
    title: 'Ценитель классики',
    franchise: 'Магическая битва',
    iconName: 'CursedFlash',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Магическая битва: Кокусэн! Вспышка концентрированной энергии. Ты мгновенно отличаешь золотую классику от проходных тайтлов.',
    rewards: [
      'Монотонный бейдж знатока в профиле и друзьях',
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
    iconName: 'StageSparkles',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Ребёнок идола: Сияние софитов главной сцены! Тебя знают завсегдатаи сообщества, а твоим оценкам доверяют единомышленники.',
    rewards: [
      'Статус яркого завсегдатая сообщества',
      'Доступ к углубленной статистике жанров',
      'Монохромная стильная плашка ранга'
    ]
  },
  {
    level: 6,
    minCount: 100,
    maxCount: 199,
    title: 'Король Шаманов',
    franchise: 'Шаман Кинг',
    iconName: 'ShamanBlade',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Шаман Кинг: Полный контроль фурёку и единение с великим духом. Ты завоевал титул Короля Шаманов.',
    rewards: [
      'Королевский бейдж Короля Шаманов в профиле',
      'VIP-ранг в списке друзей и рекомендациях',
      'Доступ к эксклюзивной аналитике франшиз'
    ]
  },
  {
    level: 7,
    minCount: 200,
    maxCount: 349,
    title: 'Нет жизни',
    franchise: 'Нет игры — нет жизни',
    iconName: 'BlankBrackets',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Нет игры — нет жизни: «Пустые никогда не проигрывают». В мире Дисборда для тебя больше не существует непреодолимых преград.',
    rewards: [
      'Легендарный титул «Нет жизни» в профиле',
      'Отметка мастера сюжетов высшего класса',
      'Титул признанного гроссмейстера сообщества'
    ]
  },
  {
    level: 8,
    minCount: 350,
    maxCount: 499,
    title: 'Легенда Аниме-мира',
    franchise: 'Магическая битва',
    iconName: 'SixEyes',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
    description: 'Магическая битва: Шесть Глаз Рикуган. Ты улавливаешь мельчайшие детали анимации, режиссуры и работы сейю.',
    rewards: [
      'Особый монохромный бейдж Рикуган',
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
    iconName: 'LimitlessVoid',
    barColor: 'bg-neutral-800 dark:bg-neutral-200',
    iconBg: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    bgBadge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    border: 'border-neutral-200 dark:border-neutral-800',
    accentColor: '#737373',
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
