const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const initialCatalogPath = path.join(__dirname, '..', 'client', 'src', 'data', 'initialCatalog.json');
let initialCatalog = JSON.parse(fs.readFileSync(initialCatalogPath, 'utf8'));

const dbPath = path.join(__dirname, '..', 'data', 'anime_ratings.db');
const db = new DatabaseSync(dbPath);

const newTitles = [
  {
    id: 7220,
    slug: 'josee-to-tora-to-sakana-tachi',
    title: 'Её заветное желание',
    originalTitle: 'Josee to Tora to Sakana-tachi / Жозе, тигр и рыба / Жозе',
    aliasIds: [7220, 40787],
    imageUrl: 'https://shikimori.io/system/animes/original/40787.jpg?1711956345',
    type: 'Фильм',
    year: '2020',
    genres: ['Драма', 'Романтика', 'Повседневность'],
    description: 'Однажды в незамысловатой жизни студента по имени Цунэо появляется девушка, большую часть своих дней потратившая на чтение и рисование. Дело в том, что мечтательная Жозе — так зовёт себя девушка на манер героини Франсуазы Саган — прикована к инвалидному креслу, и многое из жизни обычных людей ей недоступно. Благодаря дружбе с Жозе, Цунэо начинает осознавать ценность того, что имеет, а девушка решает наконец встретиться лицом к лицу с реальным миром.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: []
  },
  {
    id: 7221,
    slug: 'kuroiwa-medaka-ni-watashi-no-kawaii-ga-tsuujinai',
    title: 'Мэдака Куроива не понимает моей привлекательности',
    originalTitle: 'Kuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai / Медака Куроива',
    aliasIds: [7221, 58853],
    imageUrl: 'https://shikimori.io/system/animes/original/58853.jpg?1715613861',
    type: 'Сериал',
    year: '2025',
    genres: ['Комедия', 'Романтика', 'Школа', 'Сёнен'],
    description: 'Мона Каваи привыкла быть в центре внимания — в какую бы комнату она ни вошла, все взгляды неизменно обращаются к ней. Однако непоколебимая уверенность Моны в собственной неотразимости даёт трещину, когда она встречает Мэдаку Куроиву — новичка, недавно переведённого в её старшую школу. Оказывается, безразличие Мэдаки к Моне объясняется его мечтой однажды стать буддийским монахом, а значит — оставить позади все мирские желания.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: []
  },
  {
    id: 7222,
    slug: 'toradora',
    title: 'ТораДора!',
    originalTitle: 'Toradora!',
    aliasIds: [7222, 4224],
    imageUrl: 'https://shikimori.io/system/animes/original/4224.jpg?1711978202',
    type: 'Сериал',
    year: '2008',
    genres: ['Комедия', 'Драма', 'Романтика', 'Школа'],
    description: 'В новом учебном году Рюдзи Такасу узнаёт, что оказался в одном классе не только со своим лучшим другом Юсаку Китамурой, но и с Минори Кусиэдой — девушкой, в которую он давно и безнадёжно влюблён. В тот же класс попадает и подруга Минори — Тайга Айсака, прозванная «карманным тигром». Случайно узнав секреты друг друга, парочка решает объединиться, чтобы помочь друг другу завоевать сердца своих возлюбленных.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: [
      { id: 7223, title: 'ТораДора! Секрет приготовления бэнто', relation: 'Спешл' }
    ]
  },
  {
    id: 7223,
    slug: 'toradora-bento-no-gokui',
    title: 'ТораДора! Секрет приготовления бэнто',
    originalTitle: 'Toradora!: Bentou no Gokui',
    aliasIds: [7223, 11553],
    imageUrl: 'https://shikimori.io/system/animes/original/11553.jpg?1704571396',
    type: 'Спешл',
    year: '2011',
    genres: ['Комедия', 'Гурман', 'Школа'],
    description: 'Дополнительный эпизод культового аниме-сериала «ТораДора!», посвящённый кулинарному поединку и секретам приготовления идеального японского школьного бэнто.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: [
      { id: 7222, title: 'ТораДора!', relation: 'Основной сериал' }
    ]
  },
  {
    id: 7224,
    slug: 'kono-kaisha-ni-suki-na-hito-ga-imasu',
    title: 'Ты умеешь хранить секреты?',
    originalTitle: 'Kono Kaisha ni Suki na Hito ga Imasu',
    aliasIds: [7224, 59361],
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1123/146384.jpg',
    type: 'Сериал',
    year: '2025',
    genres: ['Комедия', 'Романтика', 'Повседневность', 'Работа'],
    description: 'Коллеги Масугу Татэиси и Юи Мицуя начинают тайно встречаться. Во избежание лишних вопросов и сплетен на работе пара решает держать свои романтические отношения в строжайшем секрете и вести себя в офисе максимально непринуждённо, иногда даже притворяясь недружелюбно настроенными друг к другу.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: []
  },
  {
    id: 7225,
    slug: 'reincarnation-no-kaben',
    title: 'Лепестки реинкарнации',
    originalTitle: 'Reincarnation no Kaben',
    aliasIds: [7225, 59443],
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1064/155042.jpg',
    type: 'Сериал',
    year: '2026',
    genres: ['Экшен', 'Сверхъестественное', 'Сёнен'],
    description: 'Тоя Сэндзи всегда чувствовал себя неполноценным из-за постоянных сравнений с талантливым старшим братом. Всё меняется, когда он узнаёт о «лепестках реинкарнации» — загадочном способе пробудить в себе выдающиеся способности великих личностей из прошлых жизней.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: []
  },
  {
    id: 7226,
    slug: 'tongari-boushi-no-atelier',
    title: 'Ателье колдовских колпаков',
    originalTitle: 'Tongari Boushi no Atelier',
    aliasIds: [7226, 51553],
    imageUrl: 'https://shikimori.io/system/animes/original/51553.jpg?1714590953',
    type: 'Сериал',
    year: '2026',
    genres: ['Фэнтези', 'Приключения', 'Сэйнэн'],
    description: 'Маленькая Коко с детства грезила о магии, но в этом мире волшебниками могут быть лишь те, кто родился с даром. Случайно увидев, как маг Кифри творит заклинания с помощью особых начертаний, Коко повторяет их и невольно навлекает беду. Чтобы спасти свою мать, девочка становится ученицей Кифри в его ателье.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: []
  },
  {
    id: 7227,
    slug: 'mushoku-tensei-eris-no-goblin-toubatsu',
    title: 'Реинкарнация безработного: История о приключениях в другом мире — Эрис охотится на гоблинов',
    originalTitle: 'Mushoku Tensei: Isekai Ittara Honki Dasu - Eris no Goblin Toubatsu',
    aliasIds: [7227, 50360],
    imageUrl: 'https://shikimori.io/system/animes/original/50360.jpg?1716776922',
    type: 'OVA',
    year: '2022',
    genres: ['Приключения', 'Драма', 'Фэнтези', 'Исекай'],
    description: 'Специальный эпизод рассказывает о том, что происходило с Эрис и Руйджердом, когда те отправились уничтожать гоблинов в портовом городе, пока Рудеус встречался со своим отцом Полом.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: [
      { id: 6573, title: 'Реинкарнация безработного: История о приключениях в другом мире', relation: '1-й сезон' },
      { id: 6585, title: 'Реинкарнация безработного: История о приключениях в другом мире. Часть 2', relation: '1-й сезон (Часть 2)' },
      { id: 6586, title: 'Реинкарнация безработного: История о приключениях в другом мире 2', relation: '2-й сезон' },
      { id: 6584, title: 'Реинкарнация безработного: История о приключениях в другом мире 2. Часть 2', relation: '2-й сезон (Часть 2)' }
    ]
  },
  {
    id: 7228,
    slug: 'blue-lock-episode-nagi',
    title: 'Синяя тюрьма: Блю Лок — Эпизод с Наги',
    originalTitle: 'Blue Lock: Episode Nagi',
    aliasIds: [7228, 54866],
    imageUrl: 'https://shikimori.io/system/animes/original/54866.jpg?1711514722',
    type: 'Фильм',
    year: '2024',
    genres: ['Спорт', 'Сёнен'],
    description: 'Полнометражный фильм-спинофф популярного футбольного аниме, рассказывающий историю проекта «Блю Лок» с точки зрения гениального лентяя Сэйсиро Наги и его напарника Рео Микагэ.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: [
      { id: 6015, title: 'Синяя тюрьма: Блю Лок', relation: '1-й сезон' },
      { id: 7229, title: 'Синяя тюрьма: Блю Лок против юношеской сборной Японии', relation: '2-й сезон' }
    ]
  },
  {
    id: 7229,
    slug: 'blue-lock-vs-u20-japan',
    title: 'Синяя тюрьма: Блю Лок против юношеской сборной Японии',
    originalTitle: 'Blue Lock vs. U-20 Japan',
    aliasIds: [7229, 54865],
    imageUrl: 'https://shikimori.io/system/animes/original/54865.jpg?1711514722',
    type: 'Сериал',
    year: '2024',
    genres: ['Спорт', 'Сёнен'],
    description: 'Второй сезон аниме «Синяя тюрьма: Блю Лок». Эксперимент выходит на принципиально новый уровень, когда лучшим тридцати пяти нападающим предстоит сразиться в решающем матче против молодежной сборной Японии U-20.',
    myScore: null,
    averageScore: null,
    ratingCount: 0,
    isFavorite: false,
    isHidden: false,
    commentsCount: 0,
    linkedAnime: [
      { id: 6015, title: 'Синяя тюрьма: Блю Лок', relation: '1-й сезон' },
      { id: 7228, title: 'Синяя тюрьма: Блю Лок — Эпизод с Наги', relation: 'Фильм' }
    ]
  }
];

// 1. Update initialCatalog.json
for (const titleObj of newTitles) {
  const existingIdx = initialCatalog.findIndex(x => x.id === titleObj.id || x.slug === titleObj.slug);
  if (existingIdx >= 0) {
    initialCatalog[existingIdx] = { ...initialCatalog[existingIdx], ...titleObj };
  } else {
    initialCatalog.push(titleObj);
  }
}

// Update franchise links for Mushoku Tensei in initialCatalog
const mushokuLinks = [
  { id: 6573, title: 'Реинкарнация безработного: История о приключениях в другом мире', relation: '1-й сезон' },
  { id: 6585, title: 'Реинкарнация безработного: История о приключениях в другом мире. Часть 2', relation: '1-й сезон (Часть 2)' },
  { id: 7227, title: 'Реинкарнация безработного: Эрис охотится на гоблинов', relation: 'OVA' },
  { id: 6586, title: 'Реинкарнация безработного: История о приключениях в другом мире 2', relation: '2-й сезон' },
  { id: 6584, title: 'Реинкарнация безработного: История о приключениях в другом мире 2. Часть 2', relation: '2-й сезон (Часть 2)' }
];

[6573, 6585, 6586, 6584].forEach(mId => {
  const it = initialCatalog.find(x => x.id === mId);
  if (it) {
    it.linkedAnime = mushokuLinks.filter(l => l.id !== mId);
  }
});

// Update franchise links for Blue Lock in initialCatalog
const blueLockLinks = [
  { id: 6015, title: 'Синяя тюрьма: Блю Лок', relation: '1-й сезон' },
  { id: 7228, title: 'Синяя тюрьма: Блю Лок — Эпизод с Наги', relation: 'Фильм' },
  { id: 7229, title: 'Синяя тюрьма: Блю Лок против юношеской сборной Японии', relation: '2-й сезон' }
];

const bl1 = initialCatalog.find(x => x.id === 6015);
if (bl1) {
  bl1.linkedAnime = [
    { id: 7228, title: 'Синяя тюрьма: Блю Лок — Эпизод с Наги', relation: 'Фильм' },
    { id: 7229, title: 'Синяя тюрьма: Блю Лок против юношеской сборной Японии', relation: '2-й сезон' }
  ];
}

fs.writeFileSync(initialCatalogPath, JSON.stringify(initialCatalog, null, 2), 'utf8');
console.log('Updated initialCatalog.json with new Photo 4 titles and franchise links.');

// 2. Insert into SQLite DB table `anime`
const insertStmt = db.prepare(`
  INSERT INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug,
    title = excluded.title,
    title_lower = excluded.title_lower,
    original_title = excluded.original_title,
    original_title_lower = excluded.original_title_lower,
    image_url = excluded.image_url,
    type = excluded.type,
    year = excluded.year,
    genres = excluded.genres,
    description = excluded.description,
    related_json = excluded.related_json
`);

for (const t of newTitles) {
  try {
    insertStmt.run(
      t.id,
      t.slug,
      t.title,
      t.title.toLowerCase().replace(/ё/g, 'е'),
      t.originalTitle,
      (t.originalTitle || '').toLowerCase().replace(/ё/g, 'е'),
      t.imageUrl,
      t.type,
      t.year,
      JSON.stringify(t.genres),
      t.description,
      '',
      JSON.stringify(t.linkedAnime || [])
    );
    console.log(`Inserted anime ID ${t.id}: ${t.title}`);
  } catch (err) {
    console.error(`Error inserting anime ${t.id}:`, err.message);
  }
}

// Also update linked_json in DB for Mushoku Tensei and Blue Lock
[6573, 6585, 6586, 6584].forEach(mId => {
  const links = mushokuLinks.filter(l => l.id !== mId);
  db.prepare('UPDATE anime SET related_json = ? WHERE id = ?').run(JSON.stringify(links), mId);
});

db.prepare('UPDATE anime SET related_json = ? WHERE id = ?').run(
  JSON.stringify([
    { id: 7228, title: 'Синяя тюрьма: Блю Лок — Эпизод с Наги', relation: 'Фильм' },
    { id: 7229, title: 'Синяя тюрьма: Блю Лок против юношеской сборной Японии', relation: '2-й сезон' }
  ]),
  6015
);

// 3. Update backup files
const backupPath = path.join(__dirname, '..', 'data', 'accounts_backup.json');
const permBackupPath = path.join(__dirname, '..', 'data', 'accounts_backup_permanent.json');

[backupPath, permBackupPath].forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data.customAnime)) {
        for (const t of newTitles) {
          const idx = data.customAnime.findIndex(x => x.id === t.id);
          const dbRow = db.prepare('SELECT * FROM anime WHERE id = ?').get(t.id);
          if (dbRow) {
            if (idx >= 0) {
              data.customAnime[idx] = dbRow;
            } else {
              data.customAnime.push(dbRow);
            }
          }
        }
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated backup file: ${filePath}`);
    } catch (e) {
      console.error(`Error updating backup ${filePath}:`, e.message);
    }
  }
});

console.log('Seeding complete successfully!');
