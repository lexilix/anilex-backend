const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const db = require('../server/db');

console.log('--- Applying permanent restore ---');

// 1. Load source data from previous git revisions
const rawMr = cp.execSync('git show f79fbe8:data/accounts_backup.json', { maxBuffer: 50 * 1024 * 1024 }).toString();
const dMr = JSON.parse(rawMr);
const mrTechRatings = dMr.ratings.filter(r => r.user_id === 20);

const rawHai = cp.execSync('git show 6f7a026:data/accounts_backup.json', { maxBuffer: 50 * 1024 * 1024 }).toString();
const dHai = JSON.parse(rawHai);
const haitekUser = dHai.users.find(u => u.id === 24);
const haitekRatings = dHai.ratings.filter(r => r.user_id === 24);

// 2. Fix anime 7195 to be "Мой подарок с уровнем 9999: Бесконечная гача"
db.prepare(`
  UPDATE anime
  SET title = 'Мой подарок с уровнем 9999: Бесконечная гача',
      title_lower = 'мой подарок с уровнем 9999: бесконечная гача'
  WHERE id = 7195
`).run();
console.log('Updated anime 7195 to Бесконечная гача.');

// 3. Remove unwanted score 0 ratings for User 5 (Just) from Photo 1
const unwantedJustZeroIds = [1306, 650, 3395, 2069, 2149, 2591, 3492, 1577, 914, 865, 7227];
for (const aid of unwantedJustZeroIds) {
  db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = ? AND score = 0').run(aid);
}
// Ensure only anime 7195 has score 0 for user 5
const justZeroCount = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 5 AND score = 0').get().c;
console.log('User 5 now has score 0 count:', justZeroCount);

// 4. Restore user haitek (ID 24)
if (haitekUser) {
  db.prepare(`
    INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, is_blocked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      nickname = excluded.nickname,
      password_hash = excluded.password_hash,
      salt = excluded.salt,
      avatar_url = excluded.avatar_url,
      banner_url = excluded.banner_url,
      allow_password_set = 0
  `).run(
    haitekUser.id,
    haitekUser.email,
    haitekUser.nickname,
    haitekUser.password_hash || 'RESTORED_ACCOUNT',
    haitekUser.salt || 'RESTORED_SALT',
    haitekUser.avatar_url || null,
    haitekUser.banner_url || null,
    0,
    0,
    haitekUser.created_at || new Date().toISOString()
  );
  console.log('Restored user haitek (ID 24).');
}

// 5. Restore MrTech (ID 20) ratings (46 titles)
for (const r of mrTechRatings) {
  // Ensure anime exists
  let an = db.prepare('SELECT id FROM anime WHERE id = ?').get(r.anime_id);
  if (!an) {
    db.prepare('INSERT OR IGNORE INTO anime (id, slug, title, image_url) VALUES (?, ?, ?, ?)').run(
      r.anime_id,
      `anime-${r.anime_id}`,
      `Аниме #${r.anime_id}`,
      'https://placehold.co/300x450/1e293b/ffffff?text=Anime'
    );
  }
  db.prepare(`
    INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      score = excluded.score,
      updated_at = excluded.updated_at
  `).run(20, r.anime_id, r.score, r.created_at || '2026-09-23 20:00:00', r.updated_at || '2026-09-23 20:00:00');
}
const mrCount = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 20').get().c;
console.log('User 20 (MrTech) ratings in DB now:', mrCount);

// 6. Restore haitek (ID 24) ratings (34 titles)
for (const r of haitekRatings) {
  let an = db.prepare('SELECT id FROM anime WHERE id = ?').get(r.anime_id);
  if (!an) {
    db.prepare('INSERT OR IGNORE INTO anime (id, slug, title, image_url) VALUES (?, ?, ?, ?)').run(
      r.anime_id,
      `anime-${r.anime_id}`,
      `Аниме #${r.anime_id}`,
      'https://placehold.co/300x450/1e293b/ffffff?text=Anime'
    );
  }
  db.prepare(`
    INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      score = excluded.score,
      updated_at = excluded.updated_at
  `).run(24, r.anime_id, r.score, r.created_at || '2026-09-23 23:13:00', r.updated_at || '2026-09-23 23:13:00');
}
const haiCount = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 24').get().c;
console.log('User 24 (haitek) ratings in DB now:', haiCount);

// 7. Ensure mutual friendships between ALL 5 users
const allUsers = [5, 15, 20, 21, 24];
for (let i = 0; i < allUsers.length; i++) {
  for (let j = 0; j < allUsers.length; j++) {
    if (i !== j) {
      db.prepare(`
        INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET
          status = 'accepted',
          updated_at = datetime('now')
      `).run(allUsers[i], allUsers[j]);
    }
  }
}
console.log('Mutual accepted friendships created between all 5 users.');

// 8. Save accounts backup
if (typeof db.saveAccountsBackup === 'function') {
  db.saveAccountsBackup();
  console.log('Saved accounts_backup.json and accounts_backup_permanent.json successfully.');
}

console.log('--- Done! ---');
