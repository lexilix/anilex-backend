const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 5, nickname: 'Just', email: 'just9jeeet@gmail.com', role: 'admin' },
  'anime-friends-secret-key-2026-minimalism',
  { expiresIn: '7d' }
);

function getJson(url, withAuth = false) {
  return new Promise((resolve) => {
    const headers = withAuth ? { 'Authorization': 'Bearer ' + token } : {};
    https.get(url, { headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    });
  });
}

async function verify() {
  console.log('=== VERIFYING RESULTS ===');

  // 1. Unrated search for user 5 (Just)
  const unratedJust = await getJson('https://anilex-backend.onrender.com/api/dev/users/5/unrated?search=' + encodeURIComponent('жозе'), true);
  console.log('1. Search "жозе" in unrated for Just:', unratedJust.items?.map(i => ({ id: i.id, title: i.title })));

  // 2. Rated search for lonely4ka
  const ratedLonely = await getJson('https://anilex-backend.onrender.com/api/dev/users/22/ratings?search=' + encodeURIComponent('жозе'), true);
  console.log('2. Search "жозе" in rated for lonely4ka:', ratedLonely.ratings?.map(i => ({ id: i.id, title: i.title, score: i.score })));

  // 3. Global search
  const globalSearch = await getJson('https://anilex-backend.onrender.com/api/search?q=' + encodeURIComponent('жозе'));
  const gItems = Array.isArray(globalSearch) ? globalSearch : (globalSearch.anime || globalSearch.items || []);
  console.log('3. Global search "жозе":', gItems.map(i => ({ id: i.id, title: i.title })));

  // 4. Lonely4ka full profile ratings
  const lonelyProfile = await getJson('https://anilex-backend.onrender.com/api/users/22/profile', true);
  console.log('4. lonely4ka rated count:', lonelyProfile.user?.ratedCount);
  console.log('All lonely4ka ratings (17 total):');
  lonelyProfile.ratings.forEach((r, idx) => {
    console.log(`   ${idx + 1}. [${r.score}/10] ${r.title}`);
  });

  // 5. Check all users ratings counts
  const devUsers = await getJson('https://anilex-backend.onrender.com/api/dev/users', true);
  console.log('5. All users on Render:');
  devUsers.users.forEach(u => {
    console.log(`   - ${u.nickname} (ID ${u.id}): ${u.ratedCount} rated`);
  });
}

verify();
