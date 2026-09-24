const fs = require('fs');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);

async function syncAll() {
  const d = JSON.parse(fs.readFileSync('data/accounts_backup.json', 'utf8'));

  // 1. Find haitek user data
  const hUser = d.users.find(u => u.nickname.toLowerCase() === 'haitek');
  if (hUser) {
    console.log('Updating haitek profile on Render...');
    try {
      const upRes = await fetch('https://anilex-backend.onrender.com/api/dev/users/22', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + tokenJust
        },
        body: JSON.stringify({
          nickname: 'haitek',
          email: 'cik5921@gmail.com',
          avatarUrl: hUser.avatar_url,
          bannerUrl: hUser.banner_url
        })
      });
      console.log('Haitek profile update status:', upRes.status);
    } catch (e) {
      console.error('Error updating haitek profile:', e.message);
    }
  }

  // 2. Sync haitek 35 ratings
  const hRatings = d.ratings.filter(r => r.user_id === 24 || r.user_id === 22);
  console.log(`Syncing ${hRatings.length} ratings for haitek (user 22)...`);
  let hSuccess = 0;
  for (const r of hRatings) {
    try {
      const res = await fetch('https://anilex-backend.onrender.com/api/dev/users/22/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + tokenJust
        },
        body: JSON.stringify({ animeId: r.anime_id, score: r.score })
      });
      if (res.ok) hSuccess++;
    } catch (e) {}
  }
  console.log(`Successfully synced ${hSuccess} ratings for haitek.`);

  // 3. Sync MrTech 46 ratings
  const mrRatings = d.ratings.filter(r => r.user_id === 20);
  console.log(`Syncing ${mrRatings.length} ratings for MrTech (user 20)...`);
  let mrSuccess = 0;
  for (const r of mrRatings) {
    try {
      const res = await fetch('https://anilex-backend.onrender.com/api/dev/users/20/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + tokenJust
        },
        body: JSON.stringify({ animeId: r.anime_id, score: r.score })
      });
      if (res.ok) mrSuccess++;
    } catch (e) {}
  }
  console.log(`Successfully synced ${mrSuccess} ratings for MrTech.`);

  // 4. Create mutual accepted friend requests on Render
  const userIds = [5, 15, 20, 21, 22];
  console.log('Sending friend requests between all users...');
  for (const uId of userIds) {
    if (uId === 5) continue;
    const uToken = jwt.sign({ id: uId, email: `user${uId}@example.com`, nickname: `User${uId}` }, SECRET);
    try {
      // Just -> user
      await fetch(`https://anilex-backend.onrender.com/api/friends/request/${uId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tokenJust }
      });
      // user -> Just (auto accepts if reverse exists)
      await fetch(`https://anilex-backend.onrender.com/api/friends/request/5`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + uToken }
      });
    } catch (e) {}
  }

  console.log('\n--- Final Verification on Render ---');
  const devRes = await fetch('https://anilex-backend.onrender.com/api/dev/users', {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  const devData = await devRes.json();
  devData.users?.forEach(u => console.log('User:', u.id, u.nickname, 'rated:', u.ratedCount, 'avg:', u.avgScore));

  const fRes = await fetch('https://anilex-backend.onrender.com/api/friends/my', {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  const fData = await fRes.json();
  console.log('Just friends list:', fData.friends?.map(f => ({ id: f.id, nickname: f.nickname })));
}

syncAll();
