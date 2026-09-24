const fs = require('fs');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);

const API = 'https://anilex-backend.onrender.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, options = {}) {
  await sleep(120); // 120ms rate-limiting between requests
  const opts = {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      ...(options.headers || {})
    }
  };
  const res = await fetch(url, opts);
  let text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, ok: res.ok, data: text };
  }
}

async function run() {
  console.log('=== Step 1: Check existing users on Render ===');
  const devUsersRes = await fetchJson(`${API}/api/dev/users`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('Live dev users status:', devUsersRes.status);
  let liveUsers = devUsersRes.data.users || [];
  let haitekUser = liveUsers.find(u => u.nickname.toLowerCase() === 'haitek');

  if (!haitekUser) {
    console.log('Registering haitek on Render...');
    const regRes = await fetchJson(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cik5921@gmail.com',
        nickname: 'haitek',
        password: '123'
      })
    });
    console.log('Haitek register status:', regRes.status, regRes.data);
    haitekUser = regRes.data?.user;
  }

  const haitekId = haitekUser ? haitekUser.id : 22;
  console.log(`Haitek user ID is: ${haitekId}`);

  // Backup data
  const backup = JSON.parse(fs.readFileSync('data/accounts_backup.json', 'utf8'));
  const hBackup = backup.users.find(u => u.nickname.toLowerCase() === 'haitek');
  const hRatings = backup.ratings.filter(r => r.user_id === 24 || r.user_id === 22);
  const mrRatings = backup.ratings.filter(r => r.user_id === 20);

  // 1. Update haitek profile
  if (hBackup) {
    console.log('Updating haitek avatar and banner on Render...');
    const upRes = await fetchJson(`${API}/api/dev/users/${haitekId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({
        nickname: 'haitek',
        email: 'cik5921@gmail.com',
        avatarUrl: hBackup.avatar_url,
        bannerUrl: hBackup.banner_url
      })
    });
    console.log('Haitek profile update:', upRes.status);
  }

  // 2. Sync all 35 ratings for haitek
  console.log(`Syncing ${hRatings.length} ratings for haitek (id: ${haitekId})...`);
  let hSuccess = 0;
  for (const r of hRatings) {
    const res = await fetchJson(`${API}/api/dev/users/${haitekId}/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({ animeId: r.anime_id, score: r.score })
    });
    if (res.ok) hSuccess++;
  }
  console.log(`Haitek ratings synced: ${hSuccess}/${hRatings.length}`);

  // 3. Sync all 46 ratings for MrTech (id: 20)
  console.log(`Syncing ${mrRatings.length} ratings for MrTech (id: 20)...`);
  let mrSuccess = 0;
  for (const r of mrRatings) {
    const res = await fetchJson(`${API}/api/dev/users/20/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({ animeId: r.anime_id, score: r.score })
    });
    if (res.ok) mrSuccess++;
  }
  console.log(`MrTech ratings synced: ${mrSuccess}/${mrRatings.length}`);

  // 4. Purge unwanted 0-ratings from Just (id: 5)
  const unwantedJustIds = [1306, 650, 3395, 2069, 2149, 2591, 3492, 1577, 914, 865, 7227, 5655];
  console.log('Purging unwanted zero ratings from Just...');
  for (const aid of unwantedJustIds) {
    const delRes = await fetchJson(`${API}/api/dev/users/5/ratings/${aid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenJust}` }
    });
    if (delRes.ok) console.log(`Deleted unwanted rating for anime ${aid}`);
  }

  // Rate 6970 as 7 for Just
  await fetchJson(`${API}/api/dev/users/5/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenJust}`
    },
    body: JSON.stringify({ animeId: 6970, score: 7 })
  });
  console.log('Ensured anime 6970 is rated 7 for Just.');

  // 5. Pin Just Top-5: [2646, 6080, 2346, 1807, 5779]
  console.log('Setting Just Top-5...');
  const top5Res = await fetchJson(`${API}/api/user/top5/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenJust}`
    },
    body: JSON.stringify({ animeIds: [2646, 6080, 2346, 1807, 5779] })
  });
  console.log('Top5 set response:', top5Res.status, top5Res.data);

  // 6. Mutual friendships between all 5 users: 5, 15, 20, 21, haitekId
  const allUserIds = [5, 15, 20, 21, haitekId];
  console.log(`Establishing mutual friendships between [${allUserIds.join(', ')}]...`);

  for (let i = 0; i < allUserIds.length; i++) {
    for (let j = 0; j < allUserIds.length; j++) {
      if (i === j) continue;
      const uFrom = allUserIds[i];
      const uTo = allUserIds[j];
      const tFrom = jwt.sign({ id: uFrom, email: `user${uFrom}@example.com`, nickname: `User${uFrom}` }, SECRET);

      await fetchJson(`${API}/api/friends/request/${uTo}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tFrom}` }
      });
    }
  }

  // Accept any pending requests for each user
  for (const uid of allUserIds) {
    const uToken = jwt.sign({ id: uid, email: `user${uid}@example.com`, nickname: `User${uid}` }, SECRET);
    const reqsRes = await fetchJson(`${API}/api/friends/requests`, {
      headers: { Authorization: `Bearer ${uToken}` }
    });
    if (Array.isArray(reqsRes.data)) {
      for (const req of reqsRes.data) {
        if (req.id) {
          await fetchJson(`${API}/api/friends/respond/${req.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${uToken}`
            },
            body: JSON.stringify({ action: 'accept' })
          });
        }
      }
    }
  }

  console.log('\n=== FINAL VERIFICATION ON LIVE RENDER ===');
  const verifyUsers = await fetchJson(`${API}/api/dev/users`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('USERS ON RENDER:');
  verifyUsers.data.users?.forEach(u => {
    console.log(`- ID: ${u.id}, Nickname: ${u.nickname}, Ratings: ${u.ratedCount}, AvgScore: ${u.avgScore}`);
  });

  const verifyFriends = await fetchJson(`${API}/api/friends/my`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('\nJUST FRIENDS:');
  verifyFriends.data.friends?.forEach(f => {
    console.log(`- ID: ${f.id}, Nickname: ${f.nickname}`);
  });

  const verifyTop5 = await fetchJson(`${API}/api/user/top5`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('\nJUST TOP-5:', verifyTop5.data);
}

run().catch(console.error);
