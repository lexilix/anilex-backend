const db = require('../server/db');

console.log('--- Updating and adding missing anime seasons ---');

// 1. Update id 6970: Восхождение в тени! Season 1
const s1Row = db.prepare('SELECT * FROM anime WHERE id = 6970').get();
if (s1Row) {
  const relatedS1 = [
    {
      id: 6096,
      title: 'Восхождение в тени! 2',
      originalTitle: 'Kage no Jitsuryokusha ni Naritakute! 2nd Season',
      year: '2023',
      type: 'Сериал',
      relation: '2-й сезон'
    },
    {
      id: 5655,
      title: 'Восхождение в тени! Реверберация',
      originalTitle: 'Kage no Jitsuryokusha ni Naritakute! Movie: Zankyou-hen',
      year: '2027',
      type: 'Фильм',
      relation: 'Фильм'
    }
  ];

  db.prepare(`
    UPDATE anime SET
      title = ?,
      title_lower = ?,
      original_title = ?,
      original_title_lower = ?,
      year = ?,
      season = ?,
      genres = ?,
      related_json = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 6970
  `).run(
    'Восхождение в тени!',
    'восхождение в тени!',
    'Kage no Jitsuryokusha ni Naritakute! / The Eminence in Shadow',
    'kage no jitsuryokusha ni naritakute! / the eminence in shadow',
    '2022',
    '1-й сезон',
    '["Экшен","Комедия","Фэнтези","Исекай"]',
    JSON.stringify(relatedS1)
  );
  console.log('Updated id 6970: Восхождение в тени! 1 сезон');
}

// Update id 6096: Восхождение в тени! 2
const s2Row = db.prepare('SELECT * FROM anime WHERE id = 6096').get();
if (s2Row) {
  const relatedS2 = [
    {
      id: 6970,
      title: 'Восхождение в тени!',
      originalTitle: 'Kage no Jitsuryokusha ni Naritakute! / The Eminence in Shadow',
      year: '2022',
      type: 'Сериал',
      relation: '1-й сезон'
    },
    {
      id: 5655,
      title: 'Восхождение в тени! Реверберация',
      originalTitle: 'Kage no Jitsuryokusha ni Naritakute! Movie: Zankyou-hen',
      year: '2027',
      type: 'Фильм',
      relation: 'Фильм'
    }
  ];

  db.prepare(`
    UPDATE anime SET
      season = '2-й сезон',
      related_json = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 6096
  `).run(JSON.stringify(relatedS2));
  console.log('Updated id 6096: Восхождение в тени! 2 (2-й сезон)');
}

// 2. Add / Update other missing 1st seasons:
const missingItems = [
  {
    targetS2Id: 1128,
    s2Title: 'Время пыток, принцесса! 2',
    s1: {
      slug: 'hime-sama-goumon-no-jikan-desu-s1',
      title: 'Время пыток, принцесса!',
      originalTitle: 'Hime-sama "Goumon" no Jikan desu / \'Tis Time for "Torture," Princess',
      imageUrl: 'https://shikimori.one/system/animes/original/52490.jpg',
      type: 'Сериал',
      year: '2024',
      season: '1-й сезон',
      genres: JSON.stringify(['Комедия', 'Фэнтези', 'Гурман']),
      description: 'Шёл долгий и ожесточённый конфликт между армией людей и армией демонов. Принцесса, будучи командиром Третьего королевского отряда рыцарей, попала в плен к демонам. Теперь её ждут изощрённые и беспощадные... "пытки" свежайшей выпечкой, горячим рамэном и другими невероятными лакомствами!'
    }
  },
  {
    targetS2Id: 1177,
    s2Title: 'Труська, Чулко и пресвятой Подвяз 2',
    s1: {
      slug: 'panty-and-stocking-with-garterbelt-s1',
      title: 'Труська, Чулко и пресвятой Подвяз',
      originalTitle: 'Panty & Stocking with Garterbelt',
      imageUrl: 'https://shikimori.one/system/animes/original/8795.jpg',
      type: 'Сериал',
      year: '2010',
      season: '1-й сезон',
      genres: JSON.stringify(['Экшен', 'Комедия', 'Сверхъестественное', 'Пародия', 'Этти']),
      description: 'Две сестры-ангела, Панти и Стокинг, были изгнаны из Рая за своё неподобающее поведение на Землю, в город Датен-Сити, находящийся на границе между Небесами и Адом. Чтобы вернуться обратно, им нужно истреблять злых призраков и собирать небесные монеты.'
    }
  },
  {
    targetS2Id: 1179,
    s2Title: 'Пуниру — милая слизь 2',
    s1: {
      slug: 'puniru-wa-kawaii-slime-s1',
      title: 'Пуниру — милая слизь',
      originalTitle: 'Puniru wa Kawaii Slime',
      imageUrl: 'https://shikimori.one/system/animes/original/57802.jpg',
      type: 'Сериал',
      year: '2024',
      season: '1-й сезон',
      genres: JSON.stringify(['Комедия', 'Повседневность']),
      description: 'Котаро создал живую слизь по имени Пуниру семь лет назад. Со временем слизь научилась превращаться в милую девочку, и теперь беззаботные деньки Котаро наполнены забавными и милыми выходками Пуниру.'
    }
  },
  {
    targetS2Id: 971,
    s2Title: 'Список нечисти 2',
    s1: {
      slug: 'yaoguai-mingdan-s1',
      title: 'Список нечисти',
      originalTitle: 'Yaoguai Mingdan / Monster List',
      imageUrl: 'https://shikimori.one/system/animes/original/28929.jpg',
      type: 'Сериал',
      year: '2014',
      season: '1-й сезон',
      genres: JSON.stringify(['Экшен', 'Комедия', 'Фэнтези', 'Гарем', 'Романтика']),
      description: 'Фэн Си — обычный студент, стремящийся к спокойной жизни. Однако его судьба резко меняется, когда он встречает загадочную девушку Су Цзюэр, оказавшуюся девятихвостой лисой. Вскоре Фэн Си узнает, что мир полон духов, демонов и даосов.'
    }
  }
];

const insertAnimeStmt = db.prepare(`
  INSERT INTO anime (slug, title, title_lower, original_title, original_title_lower, image_url, type, year, season, genres, description, related_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

for (const item of missingItems) {
  // Check if season 1 already exists
  let s1Row = db.prepare('SELECT id, title FROM anime WHERE slug = ? OR title = ?').get(item.s1.slug, item.s1.title);
  let s1Id = s1Row ? s1Row.id : null;

  const s2Row = db.prepare('SELECT id, title, image_url, year, type, original_title FROM anime WHERE id = ?').get(item.targetS2Id);

  const relatedForS1 = s2Row ? [
    {
      id: s2Row.id,
      title: s2Row.title,
      originalTitle: s2Row.original_title || '',
      year: s2Row.year || '',
      type: s2Row.type || 'Сериал',
      imageUrl: s2Row.image_url || '',
      relation: '2-й сезон'
    }
  ] : [];

  if (!s1Id) {
    const res = insertAnimeStmt.run(
      item.s1.slug,
      item.s1.title,
      item.s1.title.toLowerCase(),
      item.s1.originalTitle,
      item.s1.originalTitle.toLowerCase(),
      item.s1.imageUrl,
      item.s1.type,
      item.s1.year,
      item.s1.season,
      item.s1.genres,
      item.s1.description,
      JSON.stringify(relatedForS1)
    );
    s1Id = res.lastInsertRowid;
    console.log(`+ Created Season 1 [${s1Id}]: ${item.s1.title}`);
  } else {
    db.prepare(`
      UPDATE anime SET
        season = '1-й сезон',
        related_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(relatedForS1), s1Id);
    console.log(`✓ Updated Season 1 [${s1Id}]: ${item.s1.title}`);
  }

  // Update Season 2 with reciprocal relation
  if (s2Row && s1Id) {
    const relatedForS2 = [
      {
        id: s1Id,
        title: item.s1.title,
        originalTitle: item.s1.originalTitle,
        year: item.s1.year,
        type: item.s1.type,
        imageUrl: item.s1.imageUrl,
        relation: '1-й сезон'
      }
    ];
    db.prepare(`
      UPDATE anime SET
        season = '2-й сезон',
        related_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(relatedForS2), s2Row.id);
    console.log(`✓ Linked Season 2 [${s2Row.id}]: ${s2Row.title} <-> Season 1 [${s1Id}]`);
  }
}

// 3. Save to backup
if (typeof db.saveAccountsBackup === 'function') {
  db.saveAccountsBackup();
  console.log('Saved accounts backup with all missing seasons!');
}
