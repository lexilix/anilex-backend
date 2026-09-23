const db = require('../server/db');

// 1. Identify MrTech user
const user = db.prepare('SELECT id, nickname, email FROM users WHERE LOWER(nickname) = ?').get('mrtech');
if (!user) {
  console.error('MrTech user not found!');
  process.exit(1);
}
console.log('Found user:', user);

// 2. Find all Fate anime
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

console.log(`Found ${fateAnime.length} Fate franchise anime in database.`);

const insertOrUpdateRating = db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (?, ?, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, anime_id) DO UPDATE SET
    score = 10,
    updated_at = CURRENT_TIMESTAMP
`);

let updatedCount = 0;
for (const a of fateAnime) {
  insertOrUpdateRating.run(user.id, a.id);
  updatedCount++;
  console.log(`- Rated 10 for [${a.id}] ${a.title}`);
}

console.log(`Successfully rated 10 on ${updatedCount} Fate anime for MrTech (${user.nickname}).`);

if (typeof db.saveAccountsBackup === 'function') {
  db.saveAccountsBackup();
  console.log('Saved accounts backup.');
}
