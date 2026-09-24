const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const initialCatalogPath = path.join(__dirname, '..', 'client', 'src', 'data', 'initialCatalog.json');
let catalog = JSON.parse(fs.readFileSync(initialCatalogPath, 'utf8'));

const dbPath = path.join(__dirname, '..', 'data', 'anime_ratings.db');
const db = new DatabaseSync(dbPath);

const backupPath = path.join(__dirname, '..', 'data', 'accounts_backup.json');
const permBackupPath = path.join(__dirname, '..', 'data', 'accounts_backup_permanent.json');

const slimeFranchiseList = [
  { id: 7191, title: 'О моём перерождении в слизь', imageUrl: 'https://shikimori.one/system/animes/original/37430.jpg?1711977107', type: 'Сериал', year: '2018', relation: '1-й сезон' },
  { id: 7192, title: 'О моём перерождении в слизь 2', imageUrl: 'https://shikimori.one/system/animes/original/39551.jpg?1711977070', type: 'Сериал', year: '2021', relation: '2-й сезон' },
  { id: 7197, title: 'О моём перерождении в слизь 2. Часть 2', imageUrl: 'https://shikimori.one/system/animes/original/41487.jpg?1711977051', type: 'Сериал', year: '2021', relation: '2-й сезон часть 2' },
  { id: 7198, title: 'О моём перерождении в слизь: Алые узы', imageUrl: 'https://shikimori.one/system/animes/original/49877.jpg?1709524281', type: 'Фильм', year: '2022', relation: 'Фильм 1' },
  { id: 7199, title: 'О моём перерождении в слизь: Мечта Колеуса', imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883', type: 'ONA', year: '2023', relation: 'Спешл' },
  { id: 1446, title: 'О моём перерождении в слизь 3', imageUrl: 'https://img.cdngos.com/v/250x350/anime/66/66732cd781462452350534', type: 'Сериал', year: '2024', relation: '3-й сезон' },
  { id: 650, title: 'О моём перерождении в слизь: Слёзы синего моря', imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a46479ee4c2c213407168', type: 'Фильм', year: '2026', relation: 'Фильм 2' },
  { id: 914, title: 'О моём перерождении в слизь 4', imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a3a42979381c559599569', type: 'Сериал', year: '2026', relation: '4-й сезон' }
];

const slimeLinksFor = (id) => slimeFranchiseList.filter(x => x.id !== id);

const updates = [
  {
    id: 7191,
    slug: 'shiki-37430',
    title: 'О моём перерождении в слизь',
    originalTitle: 'Tensei shitara Slime Datta Ken / That Time I Got Reincarnated as a Slime',
    aliasIds: [7191, 37430],
    imageUrl: 'https://shikimori.one/system/animes/original/37430.jpg?1711977107',
    type: 'Сериал',
    year: '2018',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'Знакомьтесь! Сатору Миками, 37-летний рядовой служащий крупной финансовой компании. Погибнув от ножевого ранения грабителя, он перерождается в фэнтезийном мире в виде разумной слизи с уникальным навыком «Великий Мудрец» и «Хищник».',
    season: '1-й сезон',
    linkedAnime: slimeLinksFor(7191)
  },
  {
    id: 7192,
    slug: 'shiki-39551',
    title: 'О моём перерождении в слизь 2',
    originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season / That Time I Got Reincarnated as a Slime Season 2',
    aliasIds: [7192, 39551],
    imageUrl: 'https://shikimori.one/system/animes/original/39551.jpg?1711977070',
    type: 'Сериал',
    year: '2021',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'После перерождения Сатору в новом мире в качестве слизи по имени Римуру Темпест, основанное им государство монстров процветает. Однако мирная жизнь рушится, когда на Темпест нападают враждебные королевства.',
    season: '2-й сезон',
    linkedAnime: slimeLinksFor(7192)
  },
  {
    id: 7197,
    slug: 'shiki-41487',
    title: 'О моём перерождении в слизь 2. Часть 2',
    originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season Part 2 / That Time I Got Reincarnated as a Slime Season 2 Part 2',
    aliasIds: [7197, 41487],
    imageUrl: 'https://shikimori.one/system/animes/original/41487.jpg?1711977051',
    type: 'Сериал',
    year: '2021',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'Справившись с обрушившейся на страну трагедией, Римуру Темпест, пробудившийся как истинный Князь Тьмы, готовится заявить миру о правах монстров и столкнуться с коварным Клейманом на Вальпургиевом совете.',
    season: '2-й сезон часть 2',
    linkedAnime: slimeLinksFor(7197)
  },
  {
    id: 7198,
    slug: 'shiki-49877',
    title: 'О моём перерождении в слизь: Алые узы',
    originalTitle: 'Tensei shitara Slime Datta Ken Movie: Guren no Kizuna-hen / That Time I Got Reincarnated as a Slime: Scarlet Bond',
    aliasIds: [7198, 49877],
    imageUrl: 'https://shikimori.one/system/animes/original/49877.jpg?1709524281',
    type: 'Фильм',
    year: '2022',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'История разворачивается вокруг небольшого королевства Раджа к западу от Темпеста. Римуру и его союзники встречают Хииро — выжившего огра и названого брата Бенимару, чья верность королеве Тове ведет к масштабному конфликту.',
    season: 'Фильм 1',
    linkedAnime: slimeLinksFor(7198)
  },
  {
    id: 7199,
    slug: 'shiki-54565',
    title: 'О моём перерождении в слизь: Мечта Колеуса',
    originalTitle: 'Tensei shitara Slime Datta Ken: Coleus no Yume / That Time I Got Reincarnated as a Slime: Visions of Coleus',
    aliasIds: [7199, 54565],
    imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
    type: 'ONA',
    year: '2023',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'По просьбе Юки Кагурадзаки, Римуру отправляется в королевство Колеус, где назревает ожесточенная борьба за трон между принцами Сауроном и Асланом.',
    season: 'Спешл',
    linkedAnime: slimeLinksFor(7199)
  },
  {
    id: 7195,
    slug: 'shiki-60303',
    title: 'Мой подарок с уровнем 9999: Бесконечная гача',
    originalTitle: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu! / My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge! / Бесконечная гача',
    aliasIds: [7195, 7184, 60303],
    imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
    type: 'Сериал',
    year: '2025',
    genres: ['Экшен', 'Приключения', 'Фэнтези'],
    description: 'В мире, населённом девятью расами, люди занимают самое низкое положение и постоянно сталкиваются с презрением со стороны остальных. Лайт покидает родной дом, мечтая стать великим искателем приключений, однако его навык «Бесконечная гача», способный материализовывать случайные предметы, кажется окружающим совершенно бесполезным.\n\nВскоре Лайт становится представителем человечества в Союзе племён — отряде, объединившем представителей разных рас. Во время исследования Бездны, опаснейшего подземелья в мире, товарищи внезапно предают его и оставляют умирать среди чудовищ.\n\nОказавшись на грани гибели, Лайт вновь использует свой дар и неожиданно призывает Мэй — могущественную горничную 9999-го уровня, поклявшуюся ему в абсолютной верности. Открыв истинные возможности «Бесконечной гачи» и собрав вокруг себя невероятно сильных союзников, Лайт начинает готовить возмездие тем, кто обрёк его на смерть.',
    season: '',
    linkedAnime: []
  },
  {
    id: 7230,
    slug: 'hime-sama-goumon-no-jikan-desu-s1',
    title: 'Время пыток, принцесса!',
    originalTitle: 'Hime-sama "Goumon" no Jikan desu / \'Tis Time for "Torture," Princess',
    aliasIds: [7230, 52490],
    imageUrl: 'https://shikimori.one/system/animes/original/52490.jpg',
    type: 'Сериал',
    year: '2024',
    genres: ['Комедия', 'Фэнтези', 'Гурман'],
    description: 'Шёл долгий и ожесточённый конфликт между армией людей и армией демонов. Принцесса, будучи командиром Третьего королевского отряда рыцарей, попала в плен к демонам. Теперь её ждут изощрённые и беспощадные... "пытки" свежайшей выпечкой, горячим рамэном и другими невероятными лакомствами!',
    season: '1-й сезон',
    linkedAnime: [{ id: 1128, title: 'Время пыток, принцесса! 2', relation: '2-й сезон' }]
  },
  {
    id: 7231,
    slug: 'panty-and-stocking-with-garterbelt-s1',
    title: 'Труська, Чулко и пресвятой Подвяз',
    originalTitle: 'Panty & Stocking with Garterbelt',
    aliasIds: [7231, 8795],
    imageUrl: 'https://shikimori.one/system/animes/original/8795.jpg',
    type: 'Сериал',
    year: '2010',
    genres: ['Экшен', 'Комедия', 'Сверхъестественное', 'Пародия', 'Этти'],
    description: 'Две сестры-ангела, Панти и Стокинг, были изгнаны из Рая за своё неподобающее поведение на Землю, в город Датен-Сити, находящийся на границе между Небесами и Адом. Чтобы вернуться обратно, им нужно истреблять злых призраков и собирать небесные монеты.',
    season: '1-й сезон',
    linkedAnime: [{ id: 1177, title: 'Труська, Чулко и пресвятой Подвяз 2', relation: '2-й сезон' }]
  },
  {
    id: 7232,
    slug: 'puniru-wa-kawaii-slime-s1',
    title: 'Пуниру — милая слизь',
    originalTitle: 'Puniru wa Kawaii Slime',
    aliasIds: [7232, 57802],
    imageUrl: 'https://shikimori.one/system/animes/original/57802.jpg',
    type: 'Сериал',
    year: '2024',
    genres: ['Комедия', 'Повседневность'],
    description: 'Котаро создал живую слизь по имени Пуниру семь лет назад. Со временем слизь научилась превращаться в милую девочку, и теперь беззаботные деньки Котаро наполнены забавными и милыми выходками Пуниру.',
    season: '1-й сезон',
    linkedAnime: [{ id: 1179, title: 'Пуниру — милая слизь 2', relation: '2-й сезон' }]
  },
  {
    id: 7233,
    slug: 'yaoguai-mingdan-s1',
    title: 'Список нечисти',
    originalTitle: 'Yaoguai Mingdan / Monster List',
    aliasIds: [7233, 28929],
    imageUrl: 'https://shikimori.one/system/animes/original/28929.jpg',
    type: 'Сериал',
    year: '2014',
    genres: ['Экшен', 'Комедия', 'Фэнтези', 'Гарем', 'Романтика'],
    description: 'Фэн Си — обычный студент, стремящийся к спокойной жизни. Однако его судьба резко меняется, когда он встречает загадочную девушку Су Цзюэр, оказавшуюся девятихвостой лисой. Вскоре Фэн Си узнает, что мир полон духов, демонов и даосов.',
    season: '1-й сезон',
    linkedAnime: [{ id: 971, title: 'Список нечисти 2', relation: '2-й сезон' }]
  }
];

// Update other Slime titles (1446, 650, 914) with full slime links
[1446, 650, 914].forEach(sId => {
  const item = catalog.find(x => x.id === sId);
  if (item) {
    item.linkedAnime = slimeLinksFor(sId);
  }
});

for (const up of updates) {
  const idx = catalog.findIndex(x => x.id === up.id);
  if (idx >= 0) {
    catalog[idx] = { ...catalog[idx], ...up };
  } else {
    catalog.push({
      ...up,
      myScore: null,
      averageScore: null,
      ratingCount: 0,
      isFavorite: false,
      isHidden: false
    });
  }
}

fs.writeFileSync(initialCatalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('initialCatalog.json successfully updated! Total items:', catalog.length);

// Update DB
const insertOrReplaceStmt = db.prepare(`
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
    season = excluded.season,
    related_json = excluded.related_json
`);

for (const up of updates) {
  insertOrReplaceStmt.run(
    up.id,
    up.slug,
    up.title,
    up.title.toLowerCase().replace(/ё/g, 'е'),
    up.originalTitle || '',
    (up.originalTitle || '').toLowerCase().replace(/ё/g, 'е'),
    up.imageUrl || '',
    up.type || 'Сериал',
    up.year || '',
    JSON.stringify(up.genres || []),
    up.description || '',
    up.season || '',
    JSON.stringify(up.linkedAnime || [])
  );
}

// Ensure Slime 1446, 650, 914 in DB have updated related_json
[1446, 650, 914].forEach(sId => {
  db.prepare('UPDATE anime SET related_json = ? WHERE id = ?').run(JSON.stringify(slimeLinksFor(sId)), sId);
});

console.log('SQLite DB anime table updated!');

// Update backup files customAnime
[backupPath, permBackupPath].forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(data.customAnime)) {
      for (const up of updates) {
        const row = db.prepare('SELECT * FROM anime WHERE id = ?').get(up.id);
        if (row) {
          const cIdx = data.customAnime.findIndex(x => x.id === up.id);
          if (cIdx >= 0) {
            data.customAnime[cIdx] = row;
          } else {
            data.customAnime.push(row);
          }
        }
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log('Updated backup:', filePath);
    }
  }
});
