const fs = require('fs');
const path = require('path');
const db = require('../server/db');

console.log('=== EXECUTING VARIANT 1 ===');

// 1. Restore ID 7184 to Mob Psycho 100
const mobRelated = [
  {
    id: 3117,
    title: 'Моб Психо 100: Рэйгэн — Чудо-экстрасенс, которого никто не знает',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/5a/5aedcc4986582413393678',
    year: '2018',
    type: 'Спешл',
    relation: 'Спешл'
  },
  {
    id: 2570,
    title: 'Моб Психо 100 2: Путешествие, которое склеивает сердце и исцеляет душу',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/67/67643dd7d61c1308421256',
    year: '2019',
    type: 'OVA',
    relation: 'OVA'
  },
  {
    id: 2986,
    title: 'Моб Психо 100 2',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/5c/5c2958626b166570759324',
    year: '2019',
    type: 'Сериал',
    relation: '2-й сезон'
  },
  {
    id: 1804,
    title: 'Моб Психо 100 3',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/63/632869bc6e777452668058',
    year: '2022',
    type: 'Сериал',
    relation: '3-й сезон'
  }
];

db.prepare(`
  INSERT INTO anime (id, slug, title, original_title, image_url, type, year, season, genres, description, created_at, updated_at, title_lower, original_title_lower, related_json)
  VALUES (
    7184,
    'mob-psycho-100-32182',
    'Моб Психо 100',
    'Mob Psycho 100',
    'https://shikimori.one/system/animes/original/32182.jpg',
    'Сериал',
    '2016',
    '1-й сезон',
    '["Экшен","Комедия","Сверхъестественное","Сёнен"]',
    'Сигэо Кагэяма по прозвищу Моб — ученик восьмого класса с невероятными экстрасенсорными способностями. Он изо всех сил старается подавлять эмоции, ведь при достижении уровня стресса 100% его сила выходит из-под контроля. Моб подрабатывает у шарлатана Аратаки Рэйгэна, пытаясь жить обычной подростковой жизнью.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'моб психо 100',
    'mob psycho 100',
    ?
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    original_title = excluded.original_title,
    image_url = excluded.image_url,
    type = excluded.type,
    year = excluded.year,
    season = excluded.season,
    genres = excluded.genres,
    description = excluded.description,
    title_lower = excluded.title_lower,
    original_title_lower = excluded.original_title_lower,
    related_json = excluded.related_json,
    updated_at = CURRENT_TIMESTAMP
`).run(JSON.stringify(mobRelated));

// 2. Set ID 7186 as the SINGLE entry for "Мой подарок с уровнем 9999: Бесконечная гача" (empty links)
db.prepare(`
  INSERT INTO anime (id, slug, title, original_title, image_url, type, year, season, genres, description, created_at, updated_at, title_lower, original_title_lower, related_json)
  VALUES (
    7186,
    'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7186',
    'Мой подарок с уровнем 9999: Бесконечная гача',
    'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge!',
    'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
    'Сериал',
    '2025',
    '2025',
    '["Экшен","Приключения","Фэнтези"]',
    'В мире, где люди занимают самое низкое положение, Лайт обладает навыком «Бесконечная гача». После предательства в Бездне он открывает истинную силу своего дара и собирает непобедимую армию союзниц 9999-го уровня.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'мой подарок с уровнем 9999: бесконечная гача',
    'my gift lvl 9999 unlimited gacha: backstabbed in a backwater dungeon, i am out for revenge!',
    '[]'
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    original_title = excluded.original_title,
    image_url = excluded.image_url,
    type = excluded.type,
    year = excluded.year,
    season = excluded.season,
    genres = excluded.genres,
    description = excluded.description,
    title_lower = excluded.title_lower,
    original_title_lower = excluded.original_title_lower,
    related_json = '[]',
    updated_at = CURRENT_TIMESTAMP
`).run();

// Clean up duplicate 7234 if exists
db.prepare('DELETE FROM anime WHERE id = 7234').run();
db.prepare('DELETE FROM ratings WHERE anime_id = 7234').run();

// 3. Set ID 7195 as "Бесконечная гача" (12 episodes, Autumn 2025, J.C.Staff, with score 0 for Just)
db.prepare(`
  INSERT INTO anime (id, slug, title, original_title, image_url, type, year, season, genres, description, created_at, updated_at, title_lower, original_title_lower, related_json)
  VALUES (
    7195,
    'beskonechnaya-gacha-7195',
    'Бесконечная гача',
    'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!',
    '/mugen_gacha_poster.jpg',
    'Сериал',
    '2025',
    'Осень 2025',
    '["Экшен","Фэнтези"]',
    'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'бесконечная гача',
    'shinjiteita nakama-tachi ni dungeon okuchi de korosarekaketa ga gift "mugen gacha" de level 9999 no nakama-tachi wo te ni irete moto party member to sekai ni fukushuu & "zamaa!" shimasu!',
    '[]'
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    original_title = excluded.original_title,
    image_url = excluded.image_url,
    type = excluded.type,
    year = excluded.year,
    season = excluded.season,
    genres = excluded.genres,
    description = excluded.description,
    title_lower = excluded.title_lower,
    original_title_lower = excluded.original_title_lower,
    related_json = '[]',
    updated_at = CURRENT_TIMESTAMP
`).run();

// Ensure rating 0 on 7195 for Just (user 5)
db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (5, 7195, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, anime_id) DO UPDATE SET score = 0, updated_at = CURRENT_TIMESTAMP
`).run();

// Ensure NO rating on 7186 or 7184 for Just
db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = 7186').run();
db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = 7184').run();

// Ensure 5655 is deleted for Just and 6970 is 7 for Just
db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = 5655').run();
db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (5, 6970, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, anime_id) DO UPDATE SET score = 7, updated_at = CURRENT_TIMESTAMP
`).run();

// Ensure Mob Psycho sequels (3117, 2570, 2986, 1804) properly link to 7184 as 1st season
const mobFirstSeasonLink = {
  id: 7184,
  title: 'Моб Психо 100',
  originalTitle: 'Mob Psycho 100',
  year: '2016',
  type: 'Сериал',
  imageUrl: 'https://shikimori.one/system/animes/original/32182.jpg',
  relation: '1-й сезон'
};

for (const mTarget of [3117, 2570, 2986, 1804]) {
  try {
    const row = db.prepare('SELECT id, related_json FROM anime WHERE id = ?').get(mTarget);
    if (row) {
      let links = [];
      try { links = JSON.parse(row.related_json || '[]'); } catch (e) { links = []; }
      const idx = links.findIndex(x => Number(x.id) === 7184);
      if (idx !== -1) {
        links[idx] = { ...links[idx], ...mobFirstSeasonLink };
      } else {
        links.unshift(mobFirstSeasonLink);
      }
      db.prepare('UPDATE anime SET related_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(links), mTarget);
    }
  } catch (e) {}
}

console.log('=== 4. Updating initialCatalog.json ===');
const catPath = path.join(__dirname, '..', 'client', 'src', 'data', 'initialCatalog.json');
let catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));

// Remove duplicate 7234 if exists
catalog = catalog.filter(a => a.id !== 7234);

// 7184: Mob Psycho 100
let it7184 = catalog.find(a => a.id === 7184);
if (!it7184) {
  it7184 = { id: 7184 };
  catalog.push(it7184);
}
Object.assign(it7184, {
  id: 7184,
  slug: 'mob-psycho-100-32182',
  title: 'Моб Психо 100',
  originalTitle: 'Mob Psycho 100',
  imageUrl: 'https://shikimori.one/system/animes/original/32182.jpg',
  type: 'Сериал',
  year: '2016',
  season: '1-й сезон',
  genres: ['Экшен', 'Комедия', 'Сверхъестественное', 'Сёнен'],
  description: 'Сигэо Кагэяма по прозвищу Моб — ученик восьмого класса с невероятными экстрасенсорными способностями. Он изо всех сил старается подавлять эмоции, ведь при достижении уровня стресса 100% его сила выходит из-под контроля. Моб подрабатывает у шарлатана Аратаки Рэйгэна, пытаясь жить обычной подростковой жизнью.',
  myScore: null,
  averageScore: null,
  ratingCount: 0,
  linkedAnime: mobRelated,
  related_json: JSON.stringify(mobRelated)
});
delete it7184.aliasIds;

// 7186: Мой подарок с уровнем 9999: Бесконечная гача (clean, no links)
let it7186 = catalog.find(a => a.id === 7186);
if (!it7186) {
  it7186 = { id: 7186 };
  catalog.push(it7186);
}
Object.assign(it7186, {
  id: 7186,
  slug: 'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7186',
  title: 'Мой подарок с уровнем 9999: Бесконечная гача',
  originalTitle: 'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge!',
  imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
  type: 'Сериал',
  year: '2025',
  season: '2025',
  genres: ['Экшен', 'Приключения', 'Фэнтези'],
  description: 'В мире, где люди занимают самое низкое положение, Лайт обладает навыком «Бесконечная гача». После предательства в Бездне он открывает истинную силу своего дара и собирает непобедимую армию союзниц 9999-го уровня.',
  myScore: null,
  averageScore: null,
  ratingCount: 0,
  linkedAnime: [],
  related_json: '[]'
});
delete it7186.aliasIds;

// 7195: Бесконечная гача
let it7195 = catalog.find(a => a.id === 7195);
if (!it7195) {
  it7195 = { id: 7195 };
  catalog.push(it7195);
}
Object.assign(it7195, {
  id: 7195,
  slug: 'beskonechnaya-gacha-7195',
  title: 'Бесконечная гача',
  originalTitle: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!',
  imageUrl: '/mugen_gacha_poster.jpg',
  type: 'Сериал',
  year: '2025',
  season: 'Осень 2025',
  genres: ['Экшен', 'Фэнтези'],
  description: 'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.',
  myScore: null,
  averageScore: null,
  ratingCount: 0,
  linkedAnime: [],
  related_json: '[]'
});
delete it7195.aliasIds;

// 3293: Kobayashi 1-й сезон
let it3293 = catalog.find(a => a.id === 3293);
if (it3293) {
  it3293.season = '1-й сезон';
  it3293.originalTitle = 'Kobayashi-san Chi no Maid Dragon / Кобояши / Кобаяши / Дракон-горничная Кобаяши';
}

fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('Saved initialCatalog.json.');

console.log('=== 5. Updating accounts_backup.json and permanent backup ===');
function updateBackupFile(filePath) {
  const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Custom anime in backup
  d.customAnime = d.customAnime.filter(a => a.id !== 7234);

  // 7184: Mob Psycho 100
  let ca7184 = d.customAnime.find(a => a.id === 7184);
  if (!ca7184) {
    ca7184 = { id: 7184 };
    d.customAnime.push(ca7184);
  }
  Object.assign(ca7184, {
    id: 7184,
    slug: 'mob-psycho-100-32182',
    title: 'Моб Психо 100',
    original_title: 'Mob Psycho 100',
    image_url: 'https://shikimori.one/system/animes/original/32182.jpg',
    type: 'Сериал',
    year: '2016',
    season: '1-й сезон',
    genres: '["Экшен","Комедия","Сверхъестественное","Сёнен"]',
    description: 'Сигэо Кагэяма по прозвищу Моб — ученик восьмого класса с невероятными экстрасенсорными способностями. Он изо всех сил старается подавлять эмоции, ведь при достижении уровня стресса 100% его сила выходит из-под контроля. Моб подрабатывает у шарлатана Аратаки Рэйгэна, пытаясь жить обычной подростковой жизнью.',
    title_lower: 'моб психо 100',
    original_title_lower: 'mob psycho 100',
    related_json: JSON.stringify(mobRelated)
  });

  // 7186: Мой подарок с уровнем 9999
  let ca7186 = d.customAnime.find(a => a.id === 7186);
  if (!ca7186) {
    ca7186 = { id: 7186 };
    d.customAnime.push(ca7186);
  }
  Object.assign(ca7186, {
    id: 7186,
    slug: 'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7186',
    title: 'Мой подарок с уровнем 9999: Бесконечная гача',
    original_title: 'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge!',
    image_url: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
    type: 'Сериал',
    year: '2025',
    season: '2025',
    genres: '["Экшен","Приключения","Фэнтези"]',
    description: 'В мире, где люди занимают самое низкое положение, Лайт обладает навыком «Бесконечная гача». После предательства в Бездне он открывает истинную силу своего дара и собирает непобедимую армию союзниц 9999-го уровня.',
    title_lower: 'мой подарок с уровнем 9999: бесконечная гача',
    original_title_lower: 'my gift lvl 9999 unlimited gacha: backstabbed in a backwater dungeon, i am out for revenge!',
    related_json: '[]'
  });

  // 7195: Бесконечная гача
  let ca7195 = d.customAnime.find(a => a.id === 7195);
  if (!ca7195) {
    ca7195 = { id: 7195 };
    d.customAnime.push(ca7195);
  }
  Object.assign(ca7195, {
    id: 7195,
    slug: 'beskonechnaya-gacha-7195',
    title: 'Бесконечная гача',
    original_title: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!',
    image_url: '/mugen_gacha_poster.jpg',
    type: 'Сериал',
    year: '2025',
    season: 'Осень 2025',
    genres: '["Экшен","Фэнтези"]',
    description: 'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.',
    title_lower: 'бесконечная гача',
    original_title_lower: 'shinjiteita nakama-tachi ni dungeon okuchi de korosarekaketa ga gift "mugen gacha" de level 9999 no nakama-tachi wo te ni irete moto party member to sekai ni fukushuu & "zamaa!" shimasu!',
    related_json: '[]'
  });

  // Ratings
  d.ratings = d.ratings.filter(r => !(r.user_id === 5 && (r.anime_id === 5655 || r.anime_id === 7184 || r.anime_id === 7186 || r.anime_id === 7234)));
  let r7195 = d.ratings.find(r => r.user_id === 5 && r.anime_id === 7195);
  if (!r7195) {
    d.ratings.push({
      id: 9991,
      user_id: 5,
      anime_id: 7195,
      score: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } else {
    r7195.score = 0;
  }

  let r6970 = d.ratings.find(r => r.user_id === 5 && r.anime_id === 6970);
  if (!r6970) {
    d.ratings.push({
      id: 9992,
      user_id: 5,
      anime_id: 6970,
      score: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } else {
    r6970.score = 7;
  }

  fs.writeFileSync(filePath, JSON.stringify(d, null, 2), 'utf8');
  console.log(`Updated backup ${filePath}`);
}

updateBackupFile(path.join(__dirname, '..', 'data', 'accounts_backup.json'));
updateBackupFile(path.join(__dirname, '..', 'data', 'accounts_backup_permanent.json'));

console.log('=== VARIANT 1 LOCAL EXECUTION COMPLETE ===');
