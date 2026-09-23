const jwt = require('jsonwebtoken');
const secret = 'anime-friends-secret-key-2026-minimalism';

const mrTech = { id: 20, nickname: 'MrTech', email: 'mrtech@example.com' };
const token = jwt.sign({ id: mrTech.id, email: mrTech.email, nickname: mrTech.nickname }, secret);

async function syncFateRatingsOnRender() {
  console.log('--- Fetching anime list from live Render backend ---');
  let animeList = [];
  try {
    const res = await fetch('https://anilex-backend.onrender.com/api/anime?limit=1000');
    if (res.ok) {
      const data = await res.json();
      animeList = data.items || [];
    }
  } catch (e) {
    console.error('Failed to fetch anime from Render:', e.message);
  }

  console.log(`Fetched ${animeList.length} anime from Render.`);
  const fateAnime = animeList.filter((a) => {
    const t = (a.title || '').toLowerCase();
    const ot = (a.originalTitle || a.original_title || '').toLowerCase();
    return (
      t.startsWith('судьба/') ||
      t.includes('судьба/ночь') ||
      t.includes('судьба/начало') ||
      t.includes('судьба/апокриф') ||
      t.includes('судьба/великий') ||
      t.includes('судьба/странная') ||
      t.includes('судьба/дополнение') ||
      t.includes('судьба/прототип') ||
      t.includes('судьба/девочка-волшебница') ||
      t.includes('фейт') ||
      ot.includes('fate/') ||
      ot.includes('fate/stay') ||
      ot.includes('fate/zero') ||
      ot.includes('fate/extra') ||
      ot.includes('fate/grand') ||
      ot.includes('fate/strange') ||
      ot.includes('fate/apocrypha') ||
      ot.includes('fate/kaleid') ||
      ot.includes('fate/prototype')
    );
  });

  console.log(`Found ${fateAnime.length} Fate anime on Render. Submitting score 10 for MrTech...`);

  for (const a of fateAnime) {
    try {
      const rateRes = await fetch(`https://anilex-backend.onrender.com/api/anime/${a.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ score: 10 })
      });
      const data = await rateRes.json().catch(() => ({}));
      console.log(`- Rated 10 for [${a.id}] ${a.title}: ${rateRes.status}`);
    } catch (e) {
      console.error(`- Error rating [${a.id}] ${a.title}:`, e.message);
    }
  }

  console.log('Finished syncing Fate ratings on Render.');
}

syncFateRatingsOnRender();
