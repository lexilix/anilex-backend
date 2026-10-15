const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'anime_ratings.db');
const db = new DatabaseSync(dbPath);

console.log('=== 1. ADDING LINK CLICK / АГЕНТЫ ВРЕМЕНИ (SEASONS 1, 2, 3) ===');

const linkClickAnime = [
  {
    id: 44074,
    slug: 'agenty-vremeni-season-1',
    title: 'Агенты времени',
    original_title: 'Link Click / Shiguang Dailiren',
    image_url: 'https://shikimori.io/system/animes/original/44074.jpg',
    type: 'ONA',
    year: '2021',
    genres: JSON.stringify(['Детектив', 'Драма', 'Сверхъестественное', 'Триллер', 'Путешествия во времени']),
    description: 'В одном из уголков шумного мегаполиса есть неприметное фотоателье «Время». Им управляют двое молодых парней с необычными способностями: Чэн Сяоши может проникать внутрь фотоснимка и проживать события глазами того, кто сделал фото, а Лу Гуан видит хронологию событий за следующие 12 часов после момента съёмки. Вместе со своей подругой Цяо Лин они берутся за самые запутанные заказы клиентов, погружаясь в тайны прошлого через фотографии. Однако главное правило — никогда не менять ход событий прошлого, иначе последствия для настоящего могут оказаться необратимыми.',
    season: '1 сезон',
    is_published: 1,
    related_json: JSON.stringify([
      { id: 49413, title: 'Агенты времени 2', relation: 'Продолжение (2 сезон)' },
      { id: 56752, title: 'Агенты времени 3: Глава Инду', relation: 'Продолжение (3 сезон)' }
    ])
  },
  {
    id: 49413,
    slug: 'agenty-vremeni-season-2',
    title: 'Агенты времени 2',
    original_title: 'Link Click Season 2 / Shiguang Dailiren II',
    image_url: 'https://shikimori.io/system/animes/original/49413.jpg',
    type: 'ONA',
    year: '2023',
    genres: JSON.stringify(['Детектив', 'Драма', 'Сверхъестественное', 'Триллер', 'Путешествия во времени', 'Экшен']),
    description: 'Продолжение захватывающей истории о фотоателье «Время». После трагических событий финала первого сезона Чэн Сяоши и Лу Гуан сталкиваются с опасным и неуловимым противником, который также способен манипулировать сознанием людей. Друзьям предстоит раскрыть масштабный заговор и разгадать личность маньяка, скрывающегося в тени, рискуя собственными жизнями.',
    season: '2 сезон',
    is_published: 1,
    related_json: JSON.stringify([
      { id: 44074, title: 'Агенты времени', relation: 'Предыстория (1 сезон)' },
      { id: 56752, title: 'Агенты времени 3: Глава Инду', relation: 'Продолжение (3 сезон)' }
    ])
  },
  {
    id: 56752,
    slug: 'agenty-vremeni-season-3',
    title: 'Агенты времени 3: Глава Инду',
    original_title: 'Link Click: Bridon Arc / Shiguang Dailiren: Yingdu Pian',
    image_url: 'https://shikimori.io/system/animes/original/56752.jpg',
    type: 'ONA',
    year: '2024',
    genres: JSON.stringify(['Детектив', 'Драма', 'Сверхъестественное', 'Путешествия во времени', 'Экшен']),
    description: 'Третий сезон и специальная арка приключений Лу Гуана и Чэн Сяоши в Лондоне (Инду). История раскрывает события до и после переломных моментов, проливая свет на прошлое Лу Гуана, происхождение его способностей и тайну первого знакомства героев.',
    season: '3 сезон',
    is_published: 1,
    related_json: JSON.stringify([
      { id: 44074, title: 'Агенты времени', relation: 'Предыстория (1 сезон)' },
      { id: 49413, title: 'Агенты времени 2', relation: 'Предыстория (2 сезон)' }
    ])
  }
];

const normalize = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»""''`]/g, '').trim();

const upsertAnimeStmt = db.prepare(`
  INSERT INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, is_published, related_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    is_published = excluded.is_published,
    related_json = excluded.related_json
`);

for (const a of linkClickAnime) {
  upsertAnimeStmt.run(
    a.id,
    a.slug,
    a.title,
    normalize(a.title),
    a.original_title,
    normalize(a.original_title),
    a.image_url,
    a.type,
    a.year,
    a.genres,
    a.description,
    a.season,
    a.is_published,
    a.related_json
  );
  console.log(`Inserted/updated: [${a.id}] ${a.title}`);
}

console.log('=== 2. UPDATING initialCatalog.json ===');
const catPath = path.join(__dirname, '..', 'client', 'src', 'data', 'initialCatalog.json');
if (fs.existsSync(catPath)) {
  const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  for (const a of linkClickAnime) {
    const existingIdx = catalog.findIndex(x => x.id === a.id);
    const catEntry = {
      id: a.id,
      slug: a.slug,
      title: a.title,
      originalTitle: a.original_title,
      imageUrl: a.image_url,
      type: a.type,
      year: a.year,
      genres: JSON.parse(a.genres),
      description: a.description,
      season: a.season,
      isPublished: true,
      is_published: 1,
      linkedAnime: JSON.parse(a.related_json)
    };
    if (existingIdx >= 0) {
      catalog[existingIdx] = { ...catalog[existingIdx], ...catEntry };
    } else {
      catalog.unshift(catEntry);
    }
  }
  fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('Successfully updated initialCatalog.json with 3 seasons of Link Click.');
}

console.log('=== 3. ENSURING GOOSE4KA MUTUAL FRIENDSHIP IN DB ===');
const users = db.prepare("SELECT id, nickname FROM users WHERE LOWER(nickname) != 'inspector'").all();
console.log('All users in DB:', users.map(u => `${u.id}:${u.nickname}`));

const insertFriendStmt = db.prepare(`
  INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
  VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
  ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET
    status = 'accepted',
    updated_at = datetime('now')
`);

for (let i = 0; i < users.length; i++) {
  for (let j = 0; j < users.length; j++) {
    if (i !== j) {
      insertFriendStmt.run(users[i].id, users[j].id);
    }
  }
}
console.log('All mutual friendships verified.');

console.log('=== 4. UPDATING BACKUP FILES ===');
['accounts_backup.json', 'accounts_backup_permanent.json'].forEach(fileName => {
  const fPath = path.join(__dirname, '..', 'data', fileName);
  if (fs.existsSync(fPath)) {
    const backupData = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    
    // Ensure customAnime contains Link Click seasons
    if (!Array.isArray(backupData.customAnime)) backupData.customAnime = [];
    for (const a of linkClickAnime) {
      const idx = backupData.customAnime.findIndex(x => x.id === a.id);
      const entry = {
        id: a.id,
        slug: a.slug,
        title: a.title,
        original_title: a.original_title,
        image_url: a.image_url,
        type: a.type,
        year: a.year,
        genres: a.genres,
        description: a.description,
        season: a.season,
        is_published: 1,
        related_json: a.related_json
      };
      if (idx >= 0) {
        backupData.customAnime[idx] = entry;
      } else {
        backupData.customAnime.push(entry);
      }
    }

    // Ensure Goose4ka in backupData.users
    if (!Array.isArray(backupData.users)) backupData.users = [];
    const gooseIdx = backupData.users.findIndex(u => u.id === 25 || u.nickname === 'Goose4ka');
    const gooseData = {
      id: 25,
      email: 'divatiar123@gmail.com',
      nickname: 'Goose4ka',
      password_hash: 'RESTORED_ACCOUNT',
      salt: 'RESTORED_SALT',
      created_at: '2026-10-15 20:48:55',
      avatar_url: '/api/uploads/user_25_avatar_1792097671383.gif',
      banner_url: '/api/uploads/user_25_banner_1792097671385.jpg',
      allow_password_set: 1,
      is_blocked: 0
    };
    if (gooseIdx >= 0) {
      backupData.users[gooseIdx] = { ...backupData.users[gooseIdx], ...gooseData };
    } else {
      backupData.users.push(gooseData);
    }

    // Ensure friendRequests in backupData contains all pairs
    if (!Array.isArray(backupData.friendRequests)) backupData.friendRequests = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = 0; j < users.length; j++) {
        if (i !== j) {
          const u1 = users[i].id;
          const u2 = users[j].id;
          const existingReq = backupData.friendRequests.find(r => r.from_user_id === u1 && r.to_user_id === u2);
          if (!existingReq) {
            backupData.friendRequests.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              from_user_id: u1,
              to_user_id: u2,
              status: 'accepted',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    }

    fs.writeFileSync(fPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`Updated ${fileName}: users=${backupData.users.length}, customAnime=${backupData.customAnime.length}, friendRequests=${backupData.friendRequests.length}`);
  }
});

// Check Just ratings
const justRatings = db.prepare('SELECT count(*) as count FROM ratings WHERE user_id = 5').get();
console.log('=== JUST RATINGS VERIFICATION ===');
console.log('User Just ratings in DB:', justRatings.count);
if (justRatings.count !== 211) {
  console.error('CRITICAL: Just ratings count mismatch! Expected 211, got:', justRatings.count);
  process.exit(1);
}
console.log('Verification passed: Just has exactly 211 ratings.');
