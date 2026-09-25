const fs = require('fs');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);
const API = 'https://anilex-backend.onrender.com';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, ok: res.ok, data: text };
  }
}

async function main() {
  console.log('=== SYNCING LIVE RENDER TO FULL RECOVERED STATE ===');

  const backup = JSON.parse(fs.readFileSync('data/accounts_backup.json', 'utf8'));

  // 1. Fetch live users list via Dev API
  let usersRes = await fetchJson(`${API}/api/dev/users`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('Initial live users on Render:', usersRes.data.users?.map(u => ({ id: u.id, nickname: u.nickname, email: u.email })));

  let liveUsers = usersRes.data.users || [];

  // Helper to find live user
  const findUser = (nick, email) => {
    return liveUsers.find(u => 
      (u.nickname && u.nickname.toLowerCase() === nick.toLowerCase()) || 
      (u.email && u.email.toLowerCase() === email.toLowerCase())
    );
  };

  // 2. Ensure haitek exists on Render
  let liveHaitek = findUser('haitek', 'cik5921@gmail.com');
  const backupHaitek = backup.users.find(u => u.nickname.toLowerCase() === 'haitek');
  if (!liveHaitek) {
    console.log('Registering haitek on Render...');
    const regRes = await fetchJson(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cik5921@gmail.com',
        nickname: 'haitek',
        password: 'haitek_secure_pass_2026'
      })
    });
    console.log('Register haitek response:', regRes.status, regRes.data);
    
    // Refresh users
    usersRes = await fetchJson(`${API}/api/dev/users`, {
      headers: { Authorization: `Bearer ${tokenJust}` }
    });
    liveUsers = usersRes.data.users || [];
    liveHaitek = findUser('haitek', 'cik5921@gmail.com');
  }

  // 3. Ensure lonely4ka exists on Render
  let liveLonely = findUser('lonely4ka', 'xyesosinaaaaa@gmail.com');
  const backupLonely = backup.users.find(u => u.nickname.toLowerCase() === 'lonely4ka');
  if (!liveLonely) {
    console.log('Registering lonely4ka on Render...');
    const regRes = await fetchJson(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'xyesosinaaaaa@gmail.com',
        nickname: 'lonely4ka',
        password: 'lonely_secure_pass_2026'
      })
    });
    console.log('Register lonely4ka response:', regRes.status, regRes.data);

    // Refresh users
    usersRes = await fetchJson(`${API}/api/dev/users`, {
      headers: { Authorization: `Bearer ${tokenJust}` }
    });
    liveUsers = usersRes.data.users || [];
    liveLonely = findUser('lonely4ka', 'xyesosinaaaaa@gmail.com');
  }

  console.log('Updated live users on Render:', liveUsers.map(u => ({ id: u.id, nickname: u.nickname })));

  // 4. Update avatars and banners for haitek and lonely4ka
  if (liveHaitek && backupHaitek) {
    console.log('Updating haitek avatar and banner on Render...');
    const upRes = await fetchJson(`${API}/api/dev/users/${liveHaitek.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({
        nickname: 'haitek',
        email: 'cik5921@gmail.com',
        avatarUrl: backupHaitek.avatar_url,
        bannerUrl: backupHaitek.banner_url
      })
    });
    console.log('Haitek avatar update:', upRes.status, upRes.ok ? 'OK' : upRes.data);
  }

  if (liveLonely && backupLonely) {
    console.log('Updating lonely4ka avatar and banner on Render...');
    const upRes = await fetchJson(`${API}/api/dev/users/${liveLonely.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({
        nickname: 'lonely4ka',
        email: 'xyesosinaaaaa@gmail.com',
        avatarUrl: backupLonely.avatar_url,
        bannerUrl: backupLonely.banner_url
      })
    });
    console.log('Lonely4ka avatar update:', upRes.status, upRes.ok ? 'OK' : upRes.data);
  }

  // 5. Restore ratings for haitek
  if (liveHaitek) {
    const hRatings = backup.ratings.filter(r => r.user_id === 24 || r.user_id === 22);
    console.log(`Syncing ${hRatings.length} ratings for haitek (live ID: ${liveHaitek.id})...`);
    let hCount = 0;
    for (const r of hRatings) {
      const res = await fetchJson(`${API}/api/dev/users/${liveHaitek.id}/ratings`, {
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
  }

  // 6. Restore ratings for lonely4ka
  if (liveLonely) {
    const lRatings = backup.ratings.filter(r => r.user_id === 23);
    console.log(`Syncing ${lRatings.length} ratings for lonely4ka (live ID: ${liveLonely.id})...`);
    let lCount = 0;
    for (const r of lRatings) {
      const res = await fetchJson(`${API}/api/dev/users/${liveLonely.id}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenJust}`
        },
        body: JSON.stringify({ animeId: r.anime_id, score: r.score })
      });
      if (res.ok) lCount++;
    }
    console.log(`Lonely4ka ratings synced: ${lCount}/${lRatings.length}`);
  }

  // 7. Restore 46 ratings for MrTech (ID: 20)
  const mrRatings = backup.ratings.filter(r => r.user_id === 20);
  console.log(`Syncing ${mrRatings.length} ratings for MrTech (ID: 20)...`);
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

  // 8. Fix Just ratings on Render
  console.log('Fixing Just ratings on Render (ensuring 7186 is 0, deleting 5655 and ghost zeros)...');
  await fetchJson(`${API}/api/dev/users/5/ratings/5655`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenJust}` }
  });

  const unwantedZeros = [1306, 650, 3395, 2069, 2149, 2591, 3492, 1577, 914, 865, 7227, 7234];
  for (const id of unwantedZeros) {
    await fetchJson(`${API}/api/dev/users/5/ratings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenJust}` }
    });
  }

  // Set 7186 score 0 for Just
  await fetchJson(`${API}/api/dev/users/5/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenJust}`
    },
    body: JSON.stringify({ animeId: 7186, score: 0 })
  });

  // 9. Make all users mutual friends on Render
  console.log('Ensuring all users mutual friends on Render...');
  for (const u of liveUsers) {
    if (u.id === 5) continue;
    const uToken = jwt.sign({ id: u.id, email: u.email, nickname: u.nickname }, SECRET);

    // u sends to Just
    await fetchJson(`${API}/api/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uToken}`
      },
      body: JSON.stringify({ targetUserId: 5 })
    });

    // Just sends to u (which auto-accepts in index.js!)
    await fetchJson(`${API}/api/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({ targetUserId: u.id })
    });
  }

  // Also pair up other users mutually
  for (let i = 0; i < liveUsers.length; i++) {
    for (let j = i + 1; j < liveUsers.length; j++) {
      const u1 = liveUsers[i];
      const u2 = liveUsers[j];
      const t1 = jwt.sign({ id: u1.id, email: u1.email, nickname: u1.nickname }, SECRET);
      const t2 = jwt.sign({ id: u2.id, email: u2.email, nickname: u2.nickname }, SECRET);

      await fetchJson(`${API}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t1}` },
        body: JSON.stringify({ targetUserId: u2.id })
      });
      await fetchJson(`${API}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
        body: JSON.stringify({ targetUserId: u1.id })
      });
    }
  }
  console.log('Mutual friendship sync complete.');

  // 10. Verification
  console.log('=== VERIFYING FINAL LIVE STATE ===');
  const searchRes = await fetchJson(`${API}/api/users/search`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('Search users count:', searchRes.data.users?.length);
  console.log('Search users list:', searchRes.data.users?.map(u => ({ id: u.id, nickname: u.nickname, ratedCount: u.ratedCount, friendshipStatus: u.friendshipStatus })));

  const mrProfile = await fetchJson(`${API}/api/users/20/profile`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('MrTech profile ratedCount:', mrProfile.data.user?.ratedCount, 'ratings array length:', mrProfile.data.ratings?.length);

  const justRated = await fetchJson(`${API}/api/user/rated-anime`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  console.log('Just rated-anime count on Render:', justRated.data.items ? justRated.data.items.length : (Array.isArray(justRated.data) ? justRated.data.length : 'unknown'));

  console.log('=== SYNC FINISHED ===');
}

main().catch(console.error);
