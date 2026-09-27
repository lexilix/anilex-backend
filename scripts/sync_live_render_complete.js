const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const RENDER_BASE = 'https://anilex-backend.onrender.com';
const JWT_SECRET = 'anime-friends-secret-key-2026-minimalism';
const token = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '7d' });

const backupPath = path.join(__dirname, '..', 'backend_backup_2026-09-25T11-23-46-851Z', 'data', 'accounts_backup.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    ...(options.headers || {})
  };
  const url = RENDER_BASE + path;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  console.log('=== Step 1: Sync Users Profile Data (Avatar, Banner, Nickname, Email) ===');
  for (const u of backup.users) {
    console.log(`Updating user ${u.id} (${u.nickname})...`);
    try {
      const payload = {
        nickname: u.nickname,
        email: u.email
      };
      if (u.avatar_url) payload.avatarUrl = u.avatar_url;
      if (u.banner_url) payload.bannerUrl = u.banner_url;
      if (u.id === 5) {
        payload.top5Ids = [2646, 6080, 2346, 1807, 5779];
      } else if (u.id === 20) {
        payload.top5Ids = [7170];
      }
      const res = await api(`/api/dev/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      console.log(`User ${u.id} updated:`, res.success ? 'OK' : res);
    } catch (e) {
      console.error(`Error updating user ${u.id}:`, e.message);
    }
  }

  console.log('\n=== Step 2: Establish Mutual Friendships between all 6 Core Users ===');
  const userIds = [5, 15, 20, 21, 22, 23];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if (i !== j) {
        const u1 = userIds[i];
        const u2 = userIds[j];
        try {
          await api(`/api/dev/users/${u1}/friends`, {
            method: 'POST',
            body: JSON.stringify({ friendId: u2 })
          });
        } catch (e) {
          console.warn(`Friendship ${u1} <-> ${u2}: ${e.message}`);
        }
      }
    }
  }
  console.log('All mutual friendships synced.');

  console.log('\n=== Step 3: Sync Ratings from Backup ===');
  // First, get currently existing ratings for each user on Render
  for (const uid of userIds) {
    let currentRatings = [];
    try {
      const crRes = await api(`/api/dev/users/${uid}/ratings`);
      currentRatings = crRes.ratings || [];
    } catch (e) {
      console.error(`Error fetching current ratings for user ${uid}:`, e.message);
    }
    const currentAnimeIds = new Map(currentRatings.map(r => [r.anime_id, r.score]));
    console.log(`User ${uid}: currently has ${currentAnimeIds.size} ratings on Render.`);

    const userBackupRatings = backup.ratings.filter(r => r.user_id === uid);
    console.log(`User ${uid}: backup has ${userBackupRatings.length} ratings.`);

    let addedCount = 0;
    for (const r of userBackupRatings) {
      // If user does not have this rating, or if it's MrTech/haitek/lonely4ka/Venicek/Katsu and score differs:
      if (!currentAnimeIds.has(r.anime_id) || (uid !== 5 && currentAnimeIds.get(r.anime_id) !== r.score)) {
        try {
          await api(`/api/dev/users/${uid}/ratings`, {
            method: 'POST',
            body: JSON.stringify({ animeId: r.anime_id, score: r.score })
          });
          addedCount++;
        } catch (e) {
          console.error(`Failed to add rating for user ${uid}, anime ${r.anime_id}:`, e.message);
        }
      }
    }
    console.log(`User ${uid}: added/updated ${addedCount} ratings.`);
  }

  console.log('\n=== Step 4: Set Just Top 5 Explicitly ===');
  try {
    const top5Res = await api('/api/user/top5/set', {
      method: 'POST',
      body: JSON.stringify({ animeIds: [2646, 6080, 2346, 1807, 5779] })
    });
    console.log('Just Top 5 set result:', top5Res);
  } catch (e) {
    console.error('Failed to set Just Top 5:', e.message);
  }

  console.log('\n=== Step 5: Verification ===');
  const friendsRes = await api('/api/friends');
  console.log('Just friends count:', friendsRes.friends ? friendsRes.friends.length : 0);
  if (friendsRes.friends) {
    friendsRes.friends.forEach(f => {
      console.log(` - ${f.nickname} (ID: ${f.id}), rated: ${f.rated_count}, avatar: ${Boolean(f.avatarUrl)}`);
    });
  }

  const justProfile = await api('/api/users/5/profile');
  console.log('Just profile ratings count:', justProfile.ratings ? justProfile.ratings.length : 0);
  console.log('Just profile top5Ids:', justProfile.top5Ids);
  console.log('Just profile top5Anime titles:', justProfile.top5Anime ? justProfile.top5Anime.map(a => `${a.id}: ${a.title}`) : []);

  for (const uid of userIds) {
    const uRatings = await api(`/api/dev/users/${uid}/ratings`);
    console.log(`Verified User ${uid} ratings count on Render:`, uRatings.ratings ? uRatings.ratings.length : 0);
  }
}

main().catch(console.error);
