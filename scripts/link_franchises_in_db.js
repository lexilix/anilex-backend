const db = require('../server/db');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const token = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);

// 1. Definition of Bakugan cluster
const bakuganCluster = [
  { id: 5296, title: 'Отчаянные бойцы Бакуган', season: '1-й сезон', year: '2007', type: 'Сериал' },
  { id: 5295, title: 'Отчаянные бойцы Бакуган: Новая Вестроя', season: '2-й сезон', year: '2009', type: 'Сериал' },
  { id: 5294, title: 'Отчаянные бойцы Бакуган: Вторжение гандэлианцев', season: '3-й сезон', year: '2010', type: 'Сериал' },
  { id: 5297, title: 'Отчаянные бойцы Бакуган: Импульс Мектаниума', season: '4-й сезон', year: '2011', type: 'Сериал' },
  { id: 5303, title: 'Бакуган: Планета сражений', season: '5-й сезон', year: '2018', type: 'Сериал' },
  { id: 5302, title: 'Бакуган: Планета сражений — Мини-аниме', season: 'Спешл', year: '2019', type: 'ONA' },
  { id: 5301, title: 'Бакуган: Бронированный альянс', season: '6-й сезон', year: '2020', type: 'Сериал' },
  { id: 5300, title: 'Бакуган: Восход геоганов', season: '7-й сезон', year: '2021', type: 'ONA' },
  { id: 5298, title: 'Бакуган: Эволюции', season: '8-й сезон', year: '2022', type: 'Сериал' },
  { id: 5299, title: 'Бакуган: Легенды', season: '9-й сезон', year: '2023', type: 'Сериал' }
];

// Helper to link a cluster
function applyClusterToDb(cluster) {
  for (const item of cluster) {
    const dbRow = db.prepare('SELECT id, title, image_url, type, year, season FROM anime WHERE id = ?').get(item.id);
    if (!dbRow) continue;

    const relatedList = cluster
      .filter((other) => other.id !== item.id)
      .map((other) => {
        const otherRow = db.prepare('SELECT id, title, image_url, type, year FROM anime WHERE id = ?').get(other.id);
        return {
          id: other.id,
          title: other.title || (otherRow ? otherRow.title : ''),
          imageUrl: otherRow ? otherRow.image_url : '',
          year: other.year || (otherRow ? otherRow.year : ''),
          type: other.type || (otherRow ? otherRow.type : 'Сериал'),
          relation: other.season || 'Связанная часть'
        };
      });

    db.prepare('UPDATE anime SET season = ?, related_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(item.season, JSON.stringify(relatedList), item.id);
  }
}

async function syncClusterToRender(cluster) {
  console.log(`Syncing cluster of ${cluster.length} anime to Render...`);
  for (const item of cluster) {
    try {
      const dbRow = db.prepare('SELECT * FROM anime WHERE id = ?').get(item.id);
      if (!dbRow) continue;

      let linked = [];
      try {
        linked = JSON.parse(dbRow.related_json || '[]');
      } catch (e) {}

      const res = await fetch(`https://anilex-backend.onrender.com/api/dev/anime/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: dbRow.title,
          originalTitle: dbRow.original_title,
          season: item.season,
          linkedAnime: linked,
          related_json: dbRow.related_json
        })
      });

      console.log(`Render sync ${item.id} (${item.title}): status ${res.status}`);
    } catch (err) {
      console.error(`Failed to sync ${item.id} to Render:`, err.message);
    }
  }
}

async function main() {
  console.log('1. Applying Bakugan cluster...');
  applyClusterToDb(bakuganCluster);

  // 2. Also link My Hero Academia Movie 4 (1281)
  const mhaCluster = [
    { id: 1205, title: 'Моя геройская академия', season: '1-й сезон', year: '2016', type: 'Сериал' },
    { id: 1206, title: 'Моя геройская академия 2', season: '2-й сезон', year: '2017', type: 'Сериал' },
    { id: 1207, title: 'Моя геройская академия 3', season: '3-й сезон', year: '2018', type: 'Сериал' },
    { id: 1208, title: 'Моя геройская академия 4', season: '4-й сезон', year: '2019', type: 'Сериал' },
    { id: 1209, title: 'Моя геройская академия 5', season: '5-й сезон', year: '2021', type: 'Сериал' },
    { id: 1210, title: 'Моя геройская академия 6', season: '6-й сезон', year: '2022', type: 'Сериал' },
    { id: 1211, title: 'Моя геройская академия 7', season: '7-й сезон', year: '2024', type: 'Сериал' },
    { id: 1281, title: 'Моя геройская академия: Ты следующий', season: 'Фильм 4', year: '2024', type: 'Фильм' },
    { id: 3395, title: 'Моя геройская академия: Тренировка спасателей', season: 'OVA', year: '2017', type: 'OVA' }
  ];
  console.log('2. Applying MHA cluster...');
  applyClusterToDb(mhaCluster);

  // 3. Save clean backup
  if (typeof db.saveAccountsBackup === 'function') {
    db.saveAccountsBackup();
    console.log('3. Backup updated.');
  }

  // 4. Push to Render
  await syncClusterToRender(bakuganCluster);
  await syncClusterToRender(mhaCluster);

  console.log('Done!');
}

main();
