const fs = require('fs');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);

const API = 'https://anilex-backend.onrender.com';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, ok: res.ok, data: text };
  }
}

async function run() {
  console.log('--- 1. Reading local accounts backup ---');
  const backup = JSON.parse(fs.readFileSync('data/accounts_backup.json', 'utf8'));

  // Haitek data
  const hUser = backup.users.find(u => u.nickname.toLowerCase() === 'haitek');
  const hRatings = backup.ratings.filter(r => r.user_id === 24 || r.user_id === 22);
  const mrRatings = backup.ratings.filter(r => r.user_id === 20);

  // Check dev users
  const devUsersRes = await fetchJson(`${API}/api/dev/users`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('Live users count on Render:', devUsersRes.data.users?.length);
  const liveUsers = devUsersRes.data.users || [];
  const haitekOnLive = liveUsers.find(u => u.nickname.toLowerCase() === 'haitek');
  const haitekId = haitekOnLive ? haitekOnLive.id : 22;
  console.log(`Haitek live ID is ${haitekId}`);

  // 1. Update haitek avatar and banner
  if (hUser) {
    console.log('Updating haitek avatar and banner...');
    const upRes = await fetchJson(`${API}/api/dev/users/${haitekId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({
        nickname: 'haitek',
        email: 'cik5921@gmail.com',
        avatarUrl: hUser.avatar_url,
        bannerUrl: hUser.banner_url
      })
    });
    console.log('Haitek profile update:', upRes.status, upRes.ok ? 'OK' : upRes.data);
  }

  // 2. Add 35 ratings for haitek
  console.log(`Syncing ${hRatings.length} ratings for haitek (id: ${haitekId})...`);
  let hCount = 0;
  for (const r of hRatings) {
    const res = await fetchJson(`${API}/api/dev/users/${haitekId}/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({ animeId: r.anime_id, score: r.score })
    });
    if (res.ok) hCount++;
  }
  console.log(`Haitek ratings synced: ${hCount}/${hRatings.length}`);

  // 3. Add 46 ratings for MrTech
  console.log(`Syncing ${mrRatings.length} ratings for MrTech (id: 20)...`);
  let mrCount = 0;
  for (const r of mrRatings) {
    const res = await fetchJson(`${API}/api/dev/users/20/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({ animeId: r.anime_id, score: r.score })
    });
    if (res.ok) mrCount++;
  }
  console.log(`MrTech ratings synced: ${mrCount}/${mrRatings.length}`);

  // 4. Delete the 10 fake 0-ratings from Just (user 5)
  const fakeZeroAnimeIds = [1306, 650, 3395, 2069, 2149, 2591, 3492, 1577, 914, 865];
  console.log('Purging 10 fake zero ratings from Just...');
  for (const aid of fakeZeroAnimeIds) {
    const delRes = await fetchJson(`${API}/api/dev/users/5/ratings/${aid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenJust}` }
    });
    console.log(`Deleted fake zero rating for anime ${aid}: ${delRes.status}`);
  }

  // Also remove rating 5655 if exists
  await fetchJson(`${API}/api/dev/users/5/ratings/5655`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenJust}` }
  });

  // Ensure rating 6970 is 7
  await fetchJson(`${API}/api/dev/users/5/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenJust}`
    },
    body: JSON.stringify({ animeId: 6970, score: 7 })
  });
  console.log('Anime 6970 rated 7 for Just.');

  // 5. Pin Just's Top-5
  console.log('Pinning Just Top-5: [2646, 6080, 2346, 1807, 5779]...');
  const top5Res = await fetchJson(`${API}/api/user/top5/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenJust}`
    },
    body: JSON.stringify({ top5Ids: [2646, 6080, 2346, 1807, 5779] })
  });
  console.log('Top5 set result:', top5Res.status, top5Res.data);

  // 6. Ensure mutual friends between all 5 users
  const userIds = [5, 15, 20, 21, haitekId];
  console.log(`Establishing mutual friendships between ${userIds.join(', ')}...`);

  for (let i = 0; i < userIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if (i === j) continue;
      const uFrom = userIds[i];
      const uTo = userIds[j];
      const tFrom = jwt.sign({ id: uFrom, email: `user${uFrom}@example.com`, nickname: `User${uFrom}` }, SECRET);

      // Send friend request
      await fetchJson(`${API}/api/friends/request/${uTo}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tFrom}` }
      });
    }
  }

  // Approve any pending requests
  for (const uid of userIds) {
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

  console.log('\n================ VERIFICATION ================');
  const finalUsers = await fetchJson(`${API}/api/dev/users`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('USERS ON RENDER:');
  finalUsers.data.users?.forEach(u => {
    console.log(`- ID: ${u.id}, Nickname: ${u.nickname}, Ratings: ${u.ratedCount}, Avg: ${u.avgScore}`);
  });

  const finalFriends = await fetchJson(`${API}/api/friends/my`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('\nJUST FRIENDS ON RENDER:');
  finalFriends.data.friends?.forEach(f => {
    console.log(`- ID: ${f.id}, Nickname: ${f.nickname}`);
  });

  const finalTop5 = await fetchJson(`${API}/api/user/top5`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('\nJUST TOP-5 ON RENDER:', finalTop5.data);
}

run().catch(console.error);
