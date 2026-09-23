const db = require('../server/db');
const jwt = require('jsonwebtoken');

const secret = 'anime-friends-secret-key-2026-minimalism';
const mrTech = { id: 20, nickname: 'MrTech', email: 'mrtech@example.com' };
const token = jwt.sign({ id: mrTech.id, email: mrTech.email, nickname: mrTech.nickname }, secret);

// 1. Defined list of ratings from Photos 2, 3, 4, 5
const photoRatings = [
  { id: 1123, title: 'Провожающая в последний путь Фрирен 2', score: 10 },
  { id: 1132, title: 'Судьба/Странная подделка', score: 10 },
  { id: 1604, title: 'Судьба/Странная подделка: Шёпот рассвета', score: 10 },
  { id: 1119, title: 'Ты и я — полные противоположности', score: 8 },
  { id: 1130, title: 'Магическая битва: Смертельная миграция', score: 8 },
  { id: 1129, title: 'Раб спецотряда демонического города 2', score: 2 },
  { id: 1133, title: 'Адский рай 2', score: 0 },
  { id: 1576, title: 'Восхождение героя щита 3', score: 8 },
  { id: 1178, title: 'Восхождение героя щита 4', score: 8 },
  { id: 1930, title: 'Восхождение героя щита 2', score: 9 },
  { id: 2963, title: 'Восхождение героя щита', score: 10 },
  { id: 1398, title: 'Башня Бога 2', score: 7 },
  { id: 2346, title: 'Башня Бога', score: 9 },
  { id: 2536, title: 'Жизнь без оружия', score: 8 },
  { id: 2283, title: 'Жизнь без оружия 2', score: 8 },
  { id: 1807, title: 'Киберпанк: Бегущие по краю', score: 10 },
  { id: 7170, title: 'Лимонные девочки', score: 10 }
];

// 2. All Fate franchise anime from local database
const allAnime = db.prepare('SELECT id, title, original_title FROM anime').all();
const fateAnime = allAnime.filter(a => {
  const t = (a.title || '').toLowerCase();
  const ot = (a.original_title || '').toLowerCase();
  return (
    t.startsWith('судьба/') ||
    t.includes('судьба/ночь') ||
    t.includes('судьба/начало') ||
    t.includes('судьба/апокриф') ||
    t.includes('судьба/великий') ||
    t.includes('судьба/странная') ||
    t.includes('судьба/дополнение') ||
    t.includes('судьба/прототип') ||
    t.includes('судьба/девочка-волшебница') ||
    t.includes('фейт') ||
    ot.includes('fate/') ||
    ot.includes('fate/stay') ||
    ot.includes('fate/zero') ||
    ot.includes('fate/extra') ||
    ot.includes('fate/grand') ||
    ot.includes('fate/strange') ||
    ot.includes('fate/apocrypha') ||
    ot.includes('fate/kaleid') ||
    ot.includes('fate/prototype')
  );
});

// Combine all ratings without duplicates
const ratingsMap = new Map();
for (const pr of photoRatings) {
  ratingsMap.set(pr.id, { id: pr.id, title: pr.title, score: pr.score });
}
for (const fa of fateAnime) {
  if (!ratingsMap.has(fa.id)) {
    ratingsMap.set(fa.id, { id: fa.id, title: fa.title, score: 10 });
  }
}

const allRatings = Array.from(ratingsMap.values());
console.log(`Total ratings to apply for MrTech: ${allRatings.length}`);

// 3. Update SQLite locally
const insertStmt = db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, anime_id) DO UPDATE SET
    score = excluded.score,
    updated_at = CURRENT_TIMESTAMP
`);

for (const r of allRatings) {
  insertStmt.run(mrTech.id, r.id, r.score);
}
console.log('✓ Successfully saved all ratings to local SQLite.');

if (typeof db.saveAccountsBackup === 'function') {
  db.saveAccountsBackup();
  console.log('✓ Updated accounts_backup.json and permanent backup.');
}

// 4. Send all ratings directly to live Render backend
async function syncToRender() {
  console.log('--- Submitting all ratings to live Render backend ---');
  let successCount = 0;
  for (const r of allRatings) {
    try {
      const res = await fetch(`https://anilex-backend.onrender.com/api/anime/${r.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ score: r.score })
      });
      if (res.ok) {
        successCount++;
        console.log(`[${successCount}/${allRatings.length}] OK: [${r.id}] ${r.title} = ${r.score}`);
      } else {
        const text = await res.text();
        console.warn(`[FAIL] ${r.id} ${r.title}: status ${res.status}`, text);
      }
    } catch (e) {
      console.error(`[ERROR] ${r.id} ${r.title}:`, e.message);
    }
  }

  console.log(`Finished: ${successCount} of ${allRatings.length} synced to Render.`);

  // Verify on Render by fetching profile
  const justToken = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, secret);
  try {
    const checkRes = await fetch('https://anilex-backend.onrender.com/api/users/20/profile', {
      headers: { Authorization: `Bearer ${justToken}` }
    });
    const checkData = await checkRes.json();
    console.log('--- Render Verification for MrTech profile ---');
    console.log('ratedCount:', checkData.user ? checkData.user.ratedCount : null);
    console.log('ratings in profile response:', checkData.ratings ? checkData.ratings.length : 0);
  } catch (e) {
    console.error('Verify error:', e.message);
  }
}

syncToRender();
