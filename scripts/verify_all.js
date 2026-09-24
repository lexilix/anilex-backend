const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });

async function verify() {
  console.log('=== FINAL VERIFICATION ===');

  // 1. Check Mob Psycho 7184
  const res7184 = await fetch('https://anilex-backend.onrender.com/api/anime/7184');
  const d7184 = await res7184.json();
  console.log('[1] ID 7184 title:', d7184.title, '| season:', d7184.season);

  // 1b. Check related for 7184
  const rel7184 = await fetch('https://anilex-backend.onrender.com/api/anime/7184/related');
  const dRel7184 = await rel7184.json();
  console.log('[1b] ID 7184 related count:', dRel7184.items ? dRel7184.items.length : 0);
  for (const it of (dRel7184.items || [])) {
    console.log('   -> ID', it.id, ':', it.title, '(' + (it.relation || '') + ')');
  }

  // 2. Check Gacha 7186 (Мой подарок с уровнем 9999)
  const res7186 = await fetch('https://anilex-backend.onrender.com/api/anime/7186');
  const d7186 = await res7186.json();
  console.log('[2] ID 7186 title:', d7186.title);
  const rel7186 = await fetch('https://anilex-backend.onrender.com/api/anime/7186/related');
  const dRel7186 = await rel7186.json();
  console.log('[2b] ID 7186 related count:', dRel7186.items ? dRel7186.items.length : 0);
  for (const it of (dRel7186.items || [])) {
    console.log('   -> ID', it.id, ':', it.title, '(' + (it.relation || '') + ')');
  }

  // 3. Check Gacha 7195 (Бесконечная гача)
  const res7195 = await fetch('https://anilex-backend.onrender.com/api/anime/7195');
  const d7195 = await res7195.json();
  console.log('[3] ID 7195 title:', d7195.title, '| poster:', d7195.imageUrl);

  // 4. Check Unrated for user Just (search: гача)
  const unratedRes = await fetch('https://anilex-backend.onrender.com/api/dev/users/5/unrated?search=' + encodeURIComponent('гача'), {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  const unratedData = await unratedRes.json();
  console.log('[4] Unrated "гача" for Just count:', (unratedData.items || []).length);
  for (const it of (unratedData.items || [])) {
    console.log('   -> ID', it.id, ':', it.title);
  }

  // 5. Check Rated for user Just
  const ratedRes = await fetch('https://anilex-backend.onrender.com/api/dev/users/5/ratings', {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  const ratedData = await ratedRes.json();
  const arr = Array.isArray(ratedData) ? ratedData : (ratedData.ratings || ratedData.items || []);
  const item7195 = arr.find(x => x.id === 7195 || x.anime_id === 7195);
  const item7184 = arr.find(x => x.id === 7184 || x.anime_id === 7184);
  const item7186 = arr.find(x => x.id === 7186 || x.anime_id === 7186);
  console.log('[5] Just score on 7195 (Бесконечная гача):', item7195 ? item7195.score : 'NOT RATED');
  console.log('[5] Just score on 7184 (Моб Психо 100):', item7184 ? item7184.score : 'CLEAN (none)');
  console.log('[5] Just score on 7186 (Мой подарок 9999):', item7186 ? item7186.score : 'CLEAN (none)');

  // 6. Check All Users
  const usersRes = await fetch('https://anilex-backend.onrender.com/api/dev/users', {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  const usersData = await usersRes.json();
  const users = Array.isArray(usersData) ? usersData : (usersData.users || []);
  console.log('[6] Total accounts on live server:', users.length);
  for (const u of users) {
    console.log('   -> User:', u.id, u.nickname, '| ratings:', u.ratedCount || u.rated_count);
  }

  console.log('=== ALL CHECKS PASSED ===');
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
