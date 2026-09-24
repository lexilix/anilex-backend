const fs = require('fs');
const path = require('path');
const db = require('../server/db');

console.log('=== STEP 1: Updating Gacha titles and Kobayashi in local DB ===');

// 1. Title 7195: Бесконечная гача
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
    related_json = excluded.related_json,
    updated_at = CURRENT_TIMESTAMP
`).run();

// 2. Title 7234: Мой подарок с уровнем 9999: Бесконечная гача
db.prepare(`
  INSERT INTO anime (id, slug, title, original_title, image_url, type, year, season, genres, description, created_at, updated_at, title_lower, original_title_lower, related_json)
  VALUES (
    7234,
    'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7234',
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
    related_json = excluded.related_json,
    updated_at = CURRENT_TIMESTAMP
`).run();

// 3. Update Kobayashi (ID 3293): season = '1-й сезон', add synonyms to original_title
db.prepare(`
  UPDATE anime
  SET season = '1-й сезон',
      original_title = 'Kobayashi-san Chi no Maid Dragon / Кобояши / Кобаяши / Дракон-горничная Кобаяши',
      original_title_lower = 'kobayashi-san chi no maid dragon / кобояши / кобаяши / дракон-горничная кобаяши',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = 3293
`).run();

console.log('=== STEP 2: Updating Just ratings (user 5) in local DB ===');

// Remove rating for 5655 (Восхождение в тени! Реверберация)
db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = 5655').run();

// Set rating for 6970 (Восхождение в тени! 1-й сезон) to 7
db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (5, 6970, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, anime_id) DO UPDATE SET score = 7, updated_at = CURRENT_TIMESTAMP
`).run();

// Ensure rating for 7195 (Бесконечная гача) is 0
db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (5, 7195, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, anime_id) DO UPDATE SET score = 0, updated_at = CURRENT_TIMESTAMP
`).run();

// Ensure NO rating on 7234 (Мой подарок с уровнем 9999: Бесконечная гача)
db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = 7234').run();

console.log('=== STEP 3: Ensuring mutual friendships for all users ===');
const allUserIds = db.prepare("SELECT id FROM users WHERE LOWER(nickname) != 'inspector'").all().map(u => u.id);
for (const u1 of allUserIds) {
  for (const u2 of allUserIds) {
    if (u1 === u2) continue;
    db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
      VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
    `).run(u1, u2);
  }
}

console.log('=== STEP 4: Updating initialCatalog.json ===');
const catPath = path.join(__dirname, '..', 'client', 'src', 'data', 'initialCatalog.json');
let catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));

// 1. Update 7195 in catalog
let it7195 = catalog.find(a => a.id === 7195);
if (it7195) {
  it7195.title = 'Бесконечная гача';
  it7195.originalTitle = 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!';
  it7195.imageUrl = '/mugen_gacha_poster.jpg';
  it7195.type = 'Сериал';
  it7195.year = '2025';
  it7195.season = 'Осень 2025';
  it7195.genres = ['Экшен', 'Фэнтези'];
  it7195.description = 'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.';
  it7195.myScore = null;
  it7195.linkedAnime = [];
  it7195.related_json = '[]';
  delete it7195.aliasIds;
}

// 2. Add or update 7234 in catalog
let it7234 = catalog.find(a => a.id === 7234);
if (!it7234) {
  it7234 = {
    id: 7234,
    slug: 'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7234',
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
  };
  catalog.push(it7234);
} else {
  it7234.title = 'Мой подарок с уровнем 9999: Бесконечная гача';
  it7234.originalTitle = 'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge!';
  it7234.imageUrl = 'https://shikimori.one/system/animes/original/54565.jpg?1716771883';
  it7234.type = 'Сериал';
  it7234.year = '2025';
  it7234.season = '2025';
  it7234.genres = ['Экшен', 'Приключения', 'Фэнтези'];
  it7234.myScore = null;
  delete it7234.aliasIds;
}

// 3. Update 3293 in catalog
let it3293 = catalog.find(a => a.id === 3293);
if (it3293) {
  it3293.season = '1-й сезон';
  it3293.originalTitle = 'Kobayashi-san Chi no Maid Dragon / Кобояши / Кобаяши / Дракон-горничная Кобаяши';
}

// 4. Update 5655 in catalog (ensure myScore is null)
let it5655 = catalog.find(a => a.id === 5655);
if (it5655) {
  it5655.myScore = null;
  delete it5655.aliasIds;
}

// 5. Update 6970 in catalog (ensure myScore is null or 7)
let it6970 = catalog.find(a => a.id === 6970);
if (it6970) {
  it6970.season = '1-й сезон';
  delete it6970.aliasIds;
}

fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('Saved updated initialCatalog.json.');

console.log('=== STEP 5: Updating accounts_backup.json and permanent backup ===');
function updateBackup(filePath) {
  const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Update/add 7195 in customAnime
  let ca7195 = d.customAnime.find(a => a.id === 7195);
  if (!ca7195) {
    ca7195 = { id: 7195 };
    d.customAnime.push(ca7195);
  }
  Object.assign(ca7195, {
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

  // Update/add 7234 in customAnime
  let ca7234 = d.customAnime.find(a => a.id === 7234);
  if (!ca7234) {
    ca7234 = { id: 7234 };
    d.customAnime.push(ca7234);
  }
  Object.assign(ca7234, {
    slug: 'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7234',
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

  // Update 3293 in customAnime
  let ca3293 = d.customAnime.find(a => a.id === 3293);
  if (ca3293) {
    ca3293.season = '1-й сезон';
    ca3293.original_title = 'Kobayashi-san Chi no Maid Dragon / Кобояши / Кобаяши / Дракон-горничная Кобаяши';
    ca3293.original_title_lower = 'kobayashi-san chi no maid dragon / кобояши / кобаяши / дракон-горничная кобаяши';
  }

  // Ensure ratings in backup
  d.ratings = d.ratings.filter(r => !(r.user_id === 5 && r.anime_id === 5655) && !(r.user_id === 5 && r.anime_id === 7234));
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
  console.log(`Saved updated backup to ${filePath}`);
}

updateBackup(path.join(__dirname, '..', 'data', 'accounts_backup.json'));
updateBackup(path.join(__dirname, '..', 'data', 'accounts_backup_permanent.json'));

console.log('All local database, catalog, and backup updates completed successfully!');
