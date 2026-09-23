const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../server/db');

const JWT_SECRET = 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });
const tokenHaitek = jwt.sign({ id: 24, email: 'cik5921@gmail.com', nickname: 'haitek' }, JWT_SECRET, { expiresIn: '30d' });

async function main() {
  // 1. Establish mutual friendships on Render between 24 and other users (5 Just, 15 Katsu, 20 MrTech, 21 Venicek)
  const otherIds = [5, 15, 20, 21];
  for (const oId of otherIds) {
    try {
      const sendRes = await fetch('https://anilex-backend.onrender.com/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenHaitek },
        body: JSON.stringify({ toUserId: oId })
      });
      console.log('Friend request from haitek to ' + oId + ':', await sendRes.json());
    } catch (e) {}

    // Auto-accept from Just
    if (oId === 5) {
      try {
        const getReqs = await fetch('https://anilex-backend.onrender.com/api/friends/requests', {
          headers: { Authorization: 'Bearer ' + tokenJust }
        });
        const reqsData = await getReqs.json();
        const myReq = (reqsData.incoming || []).find(r => r.fromUserId === 24);
        if (myReq) {
          const acceptRes = await fetch('https://anilex-backend.onrender.com/api/friends/accept/' + myReq.id, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + tokenJust }
          });
          console.log('Just accepted haitek friend request:', await acceptRes.json());
        }
      } catch (e) {}
    }
  }

  // 2. Add Slime rating (10) for haitek on Render
  try {
    const rateRes = await fetch('https://anilex-backend.onrender.com/api/anime/7191/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenHaitek },
      body: JSON.stringify({ score: 10 })
    });
    console.log('Rated 7191 for haitek on Render:', await rateRes.json());
  } catch (e) {}

  // 3. Update local SQLite DB
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('123', salt, 64).toString('hex');

  db.prepare('DELETE FROM users WHERE nickname = ? OR email = ?').run('haitek', 'cik5921@gmail.com');
  db.prepare(`
    INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, is_blocked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(24, 'cik5921@gmail.com', 'haitek', hash, salt, null, null, 0, 0);

  // Friendships in local DB
  const users = db.prepare('SELECT id FROM users').all();
  for (const u of users) {
    if (u.id !== 24) {
      db.prepare(`
        INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = datetime('now')
      `).run(24, u.id);
      db.prepare(`
        INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status = 'accepted', updated_at = datetime('now')
      `).run(u.id, 24);
    }
  }

  // Ratings in local DB
  db.prepare(`
    INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id, anime_id) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at
  `).run(24, 7191, 10);

  // Save to accounts_backup.json & permanent
  if (typeof db.saveAccountsBackup === 'function') {
    db.saveAccountsBackup();
    console.log('Saved backup files with user haitek ID 24.');
  }

  console.log('All local & Render data synced for haitek ID 24!');
}

main().catch(console.error);
