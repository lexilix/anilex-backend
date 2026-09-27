const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const RENDER_BASE = 'https://anilex-backend.onrender.com';
const JWT_SECRET = 'anime-friends-secret-key-2026-minimalism';
const token = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '7d' });

const backupPath = path.join(__dirname, '..', 'backend_backup_2026-09-25T11-23-46-851Z', 'data', 'accounts_backup.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

async function setRating(userId, animeId, score) {
  const res = await fetch(`${RENDER_BASE}/api/dev/users/${userId}/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ animeId, score })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to set rating user=${userId} anime=${animeId}: ${txt.slice(0, 150)}`);
  }
  return res.json();
}

async function main() {
  const targetUserIds = [20, 22, 23]; // MrTech, haitek, lonely4ka

  for (const uid of targetUserIds) {
    const userRatings = backup.ratings.filter(r => r.user_id === uid);
    console.log(`\nSyncing ${userRatings.length} ratings for User ${uid}...`);
    let count = 0;
    for (const r of userRatings) {
      try {
        await setRating(uid, r.anime_id, r.score);
        count++;
        process.stdout.write(`.`);
      } catch (e) {
        console.error(`\nError user ${uid} anime ${r.anime_id}:`, e.message);
      }
    }
    console.log(`\nUser ${uid} finished: ${count}/${userRatings.length} synced.`);
  }

  console.log('\n=== Verifying All Profiles on Render ===');
  for (const uid of [5, 15, 20, 21, 22, 23]) {
    const res = await fetch(`${RENDER_BASE}/api/users/${uid}/profile`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    console.log(`User ${uid} (${data.user?.nickname}): ratedCount=${data.user?.ratedCount}, ratingsArray=${data.ratings?.length}`);
  }
}

main().catch(console.error);
