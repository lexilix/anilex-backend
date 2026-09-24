const jwt = require('jsonwebtoken');

const JWT_SECRET = 'anime-friends-secret-key-2026-minimalism';
const API = 'https://anilex-backend.onrender.com';

const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });
const tokenLonely = jwt.sign({ id: 23, email: 'xyesosinaaaaa@gmail.com', nickname: 'lonely4ka' }, JWT_SECRET, { expiresIn: '30d' });

async function run() {
  console.log('--- 1. Syncing anime to Render ---');

  // Sync 7195
  const res7195 = await fetch(`${API}/api/dev/anime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
    body: JSON.stringify({
      id: 7195,
      slug: 'beskonechnaya-gacha-7195',
      title: 'Бесконечная гача',
      originalTitle: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!',
      imageUrl: '/mugen_gacha_poster.jpg',
      type: 'Сериал',
      year: '2025',
      season: 'Осень 2025',
      genres: ['Экшен', 'Фэнтези'],
      description: 'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.'
    })
  });
  console.log('Render 7195 sync:', res7195.status, await res7195.text());

  // Sync 7234
  const res7234 = await fetch(`${API}/api/dev/anime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
    body: JSON.stringify({
      id: 7234,
      slug: 'moi-podarok-s-urovnem-9999-beskonechnaya-gacha-7234',
      title: 'Мой подарок с уровнем 9999: Бесконечная гача',
      originalTitle: 'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge!',
      imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
      type: 'Сериал',
      year: '2025',
      season: '2025',
      genres: ['Экшен', 'Приключения', 'Фэнтези'],
      description: 'В мире, где люди занимают самое низкое положение, Лайт обладает навыком «Бесконечная гача». После предательства в Бездне он открывает истинную силу своего дара и собирает непобедимую армию союзниц 9999-го уровня.'
    })
  });
  console.log('Render 7234 sync:', res7234.status, await res7234.text());

  // Sync 3293 (Kobayashi)
  const res3293 = await fetch(`${API}/api/dev/anime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
    body: JSON.stringify({
      id: 3293,
      slug: 'drakon-gornichnaya-kobayashi-406',
      title: 'Дракон-горничная госпожи Кобаяси',
      originalTitle: 'Kobayashi-san Chi no Maid Dragon / Кобояши / Кобаяши / Дракон-горничная Кобаяши',
      imageUrl: 'https://img.cdngos.com/v/250x350/anime/5a/5a9b68cbba10c200065662',
      type: 'Сериал',
      year: '2017',
      season: '1-й сезон',
      genres: ['Фэнтези', 'Повседневность']
    })
  });
  console.log('Render 3293 sync:', res3293.status, await res3293.text());

  console.log('--- 2. Syncing Just ratings to Render ---');
  // Just rates 7195 with 0
  const rate7195 = await fetch(`${API}/api/anime/7195/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
    body: JSON.stringify({ score: 0 })
  });
  console.log('Just rated 7195 (0):', rate7195.status, await rate7195.text());

  // Just rates 6970 with 7
  const rate6970 = await fetch(`${API}/api/anime/6970/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
    body: JSON.stringify({ score: 7 })
  });
  console.log('Just rated 6970 (7):', rate6970.status, await rate6970.text());

  // Just removes rating on 5655 (score: null)
  const unrate5655 = await fetch(`${API}/api/anime/5655/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
    body: JSON.stringify({ score: null })
  });
  console.log('Just removed rating on 5655:', unrate5655.status, await unrate5655.text());

  console.log('--- 3. Syncing friendships for lonely4ka on Render ---');
  // Send friend request from lonely4ka to Just
  const reqRes = await fetch(`${API}/api/friends/request/5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLonely}` }
  });
  console.log('lonely4ka friend request to Just:', reqRes.status, await reqRes.text());

  // Just accepts lonely4ka friend request
  // Check incoming requests for Just
  const inRes = await fetch(`${API}/api/friends/requests`, {
    headers: { Authorization: `Bearer ${tokenJust}` }
  });
  const inData = await inRes.json();
  console.log('Just incoming requests:', inData.incoming?.map(r => ({ id: r.requestId, from: r.nickname, fromId: r.id })));
  const lonelyReq = (inData.incoming || []).find(r => r.id === 23 || r.nickname === 'lonely4ka');
  if (lonelyReq && lonelyReq.requestId) {
    const accRes = await fetch(`${API}/api/friends/respond/${lonelyReq.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` },
      body: JSON.stringify({ action: 'accept' })
    });
    console.log('Just accepted lonely4ka:', accRes.status, await accRes.text());
  }

  // Also send from Just to lonely4ka just in case
  const reqRes2 = await fetch(`${API}/api/friends/request/23`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenJust}` }
  });
  console.log('Just friend request to lonely4ka:', reqRes2.status, await reqRes2.text());

  const inRes2 = await fetch(`${API}/api/friends/requests`, {
    headers: { Authorization: `Bearer ${tokenLonely}` }
  });
  const inData2 = await inRes2.json();
  const justReq = (inData2.incoming || []).find(r => r.id === 5 || r.nickname === 'Just');
  if (justReq && justReq.requestId) {
    const accRes2 = await fetch(`${API}/api/friends/respond/${justReq.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLonely}` },
      body: JSON.stringify({ action: 'accept' })
    });
    console.log('lonely4ka accepted Just:', accRes2.status, await accRes2.text());
  }

  console.log('Render sync completed successfully!');
}

run().catch(console.error);
