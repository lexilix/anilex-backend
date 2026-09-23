const fs = require('fs');
const db = require('../server/db');

// Upsert user 23 in local DB
db.prepare('DELETE FROM users WHERE nickname = ? OR email = ?').run('haitek', 'cik5921@gmail.com');
db.prepare(`
  INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, is_blocked, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`).run(23, 'cik5921@gmail.com', 'haitek', 'PASSWORD_HASH', 'SALT', null, null, 0, 0);

// Add mutual friendships between 23 and all users
const users = db.prepare('SELECT id FROM users').all();
for (const u of users) {
  if (u.id !== 23) {
    db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
      VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
      ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = datetime('now')
    `).run(23, u.id);
    db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
      VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
      ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = datetime('now')
    `).run(u.id, 23);
  }
}

// Add rating for haitek on Slime (7191) score 10
db.prepare(`
  INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(user_id, anime_id) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at
`).run(23, 7191, 10);

if (typeof db.saveAccountsBackup === 'function') {
  db.saveAccountsBackup();
}
console.log('User haitek (ID 23) registered locally with ratings, mutual friends, and saved to backup files.');
