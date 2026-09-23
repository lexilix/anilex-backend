const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../server/db');

const JWT_SECRET = process.env.JWT_SECRET || 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });

async function main() {
  console.log('--- Registering and protecting haitek profile locally & in backups ---');

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync('password123', salt, 64).toString('hex');

  // 1. Insert into local SQLite
  db.prepare(`
    INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, is_blocked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      nickname = excluded.nickname
  `).run(
    22,
    'cik5921@gmail.com',
    'haitek',
    passwordHash,
    salt,
    null,
    null,
    0,
    0,
    '2026-09-23 22:32:33'
  );
  console.log('User haitek (ID 22) inserted/updated in local users table.');

  // 2. Ensure mutual friendships in local DB
  const users = db.prepare("SELECT id, nickname FROM users WHERE LOWER(nickname) != 'inspector'").all();
  for (const u of users) {
    if (u.id !== 22) {
      db.prepare(`
        INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = datetime('now')
      `).run(22, u.id);
      db.prepare(`
        INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = datetime('now')
      `).run(u.id, 22);
    }
  }
  console.log('Mutual friendships ensured in local DB.');

  // 3. Save to backup files
  if (typeof db.saveAccountsBackup === 'function') {
    db.saveAccountsBackup();
    console.log('accounts_backup.json and accounts_backup_permanent.json updated.');
  }

  // 4. Verify on Render
  console.log('\n--- Verifying haitek on Render ---');
  const profRes = await fetch('https://anilex-backend.onrender.com/api/users/22/profile', {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  console.log('Render profile status:', profRes.status);
  const profData = await profRes.json();
  console.log('haitek profile on Render:', profData);

  console.log('\nDone!');
}

main().catch(console.error);
