const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });

const mobRelated = [
  {
    id: 3117,
    title: 'Моб Психо 100: Рэйгэн — Чудо-экстрасенс, которого никто не знает',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/5a/5aedcc4986582413393678',
    year: '2018',
    type: 'Спешл',
    relation: 'Спешл'
  },
  {
    id: 2570,
    title: 'Моб Психо 100 2: Путешествие, которое склеивает сердце и исцеляет душу',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/67/67643dd7d61c1308421256',
    year: '2019',
    type: 'OVA',
    relation: 'OVA'
  },
  {
    id: 2986,
    title: 'Моб Психо 100 2',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/5c/5c2958626b166570759324',
    year: '2019',
    type: 'Сериал',
    relation: '2-й сезон'
  },
  {
    id: 1804,
    title: 'Моб Психо 100 3',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/63/632869bc6e777452668058',
    year: '2022',
    type: 'Сериал',
    relation: '3-й сезон'
  }
];

async function main() {
  console.log('=== SYNCING VARIANT 1 TO RENDER ===');

  // 1. Restore 7184 to Mob Psycho 100
  console.log('1. Updating 7184 -> Моб Психо 100...');
  const res7184 = await fetch('https://anilex-backend.onrender.com/api/dev/anime/7184', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + tokenJust
    },
    body: JSON.stringify({
      id: 7184,
      title: 'Моб Психо 100',
      originalTitle: 'Mob Psycho 100',
      description: 'Сигэо Кагэяма по прозвищу Моб — ученик восьмого класса с невероятными экстрасенсорными способностями. Он изо всех сил старается подавлять эмоции, ведь при достижении уровня стресса 100% его сила выходит из-под контроля. Моб подрабатывает у шарлатана Аратаки Рэйгэна, пытаясь жить обычной подростковой жизнью.',
      imageUrl: 'https://shikimori.one/system/animes/original/32182.jpg',
      type: 'Сериал',
      year: '2016',
      season: '1-й сезон',
      genres: ['Экшен', 'Комедия', 'Сверхъестественное', 'Сёнен'],
      linkedAnime: mobRelated
    })
  });
  console.log('7184 status:', res7184.status);

  // 2. Set 7186 -> Мой подарок с уровнем 9999 (empty links)
  console.log('2. Updating 7186 -> Мой подарок с уровнем 9999: Бесконечная гача (empty links)...');
  const res7186 = await fetch('https://anilex-backend.onrender.com/api/dev/anime/7186', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + tokenJust
    },
    body: JSON.stringify({
      id: 7186,
      title: 'Мой подарок с уровнем 9999: Бесконечная гача',
      originalTitle: 'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I am Out for Revenge!',
      description: 'В мире, где люди занимают самое низкое положение, Лайт обладает навыком «Бесконечная гача». После предательства в Бездне он открывает истинную силу своего дара и собирает непобедимую армию союзниц 9999-го уровня.',
      imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
      type: 'Сериал',
      year: '2025',
      season: '2025',
      genres: ['Экшен', 'Приключения', 'Фэнтези'],
      linkedAnime: []
    })
  });
  console.log('7186 status:', res7186.status);

  // 3. Set 7195 -> Бесконечная гача
  console.log('3. Updating/creating 7195 -> Бесконечная гача...');
  const chk7195 = await fetch('https://anilex-backend.onrender.com/api/anime/7195');
  if (chk7195.status === 404) {
    const post7195 = await fetch('https://anilex-backend.onrender.com/api/dev/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenJust },
      body: JSON.stringify({
        title: 'Бесконечная гача',
        originalTitle: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!',
        description: 'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.',
        imageUrl: '/mugen_gacha_poster.jpg',
        type: 'Сериал',
        year: '2025',
        season: 'Осень 2025',
        genres: ['Экшен', 'Фэнтези'],
        linkedAnime: []
      })
    });
    console.log('Created 7195 status:', post7195.status);
  } else {
    const res7195 = await fetch('https://anilex-backend.onrender.com/api/dev/anime/7195', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenJust
      },
      body: JSON.stringify({
        id: 7195,
        title: 'Бесконечная гача',
        originalTitle: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift "Mugen Gacha" de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & "Zamaa!" Shimasu!',
        description: 'История о парне по имени Лайт, которого предали товарищи по подземелью и бросили умирать на самом глубоком уровне. Но благодаря своему дару «Бесконечная гача» уровня 9999 он призывает сильнейших спутниц и начинает жестокую месть бывшим союзникам и всему миру.',
        imageUrl: '/mugen_gacha_poster.jpg',
        type: 'Сериал',
        year: '2025',
        season: 'Осень 2025',
        genres: ['Экшен', 'Фэнтези'],
        linkedAnime: []
      })
    });
    console.log('7195 status:', res7195.status);
  }

  // 4. Delete duplicate 7234 if present
  console.log('4. Deleting duplicate 7234 if exists on Render...');
  const del7234 = await fetch('https://anilex-backend.onrender.com/api/dev/anime/7234', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  console.log('Delete 7234 status:', del7234.status);

  // 5. Clean up Just's ratings on Render
  console.log('5. Cleaning ratings for user Just (5)...');
  await fetch('https://anilex-backend.onrender.com/api/dev/users/5/ratings/7184', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  await fetch('https://anilex-backend.onrender.com/api/dev/users/5/ratings/7186', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  await fetch('https://anilex-backend.onrender.com/api/dev/users/5/ratings/7234', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  await fetch('https://anilex-backend.onrender.com/api/dev/users/5/ratings/5655', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenJust }
  });

  // Rate 7195 as 0 for Just
  console.log('Rating 7195 as 0 for Just...');
  const rate7195 = await fetch('https://anilex-backend.onrender.com/api/anime/7195/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenJust },
    body: JSON.stringify({ score: 0 })
  });
  console.log('Rate 7195 status:', rate7195.status);

  // Rate 6970 as 7 for Just
  console.log('Rating 6970 as 7 for Just...');
  const rate6970 = await fetch('https://anilex-backend.onrender.com/api/anime/6970/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenJust },
    body: JSON.stringify({ score: 7 })
  });
  console.log('Rate 6970 status:', rate6970.status);

  // 6. Verify Mob Psycho related
  console.log('\n--- Verifying Mob Psycho related on Render ---');
  const mobRelRes = await fetch('https://anilex-backend.onrender.com/api/anime/7184/related');
  const mobRelData = await mobRelRes.json();
  console.log('Mob 7184 related count:', mobRelData.items ? mobRelData.items.length : 0);
  for (const it of (mobRelData.items || [])) {
    console.log(` - ID ${it.id}: ${it.title} [${it.relation || ''}]`);
  }

  // 7. Verify Gacha 7186 related
  console.log('\n--- Verifying Gacha 7186 related on Render ---');
  const gachaRelRes = await fetch('https://anilex-backend.onrender.com/api/anime/7186/related');
  const gachaRelData = await gachaRelRes.json();
  console.log('Gacha 7186 related count:', gachaRelData.items ? gachaRelData.items.length : 0);
  for (const it of (gachaRelData.items || [])) {
    console.log(` - ID ${it.id}: ${it.title} [${it.relation || ''}]`);
  }

  // 8. Verify Just ratings on Render
  console.log('\n--- Verifying Just (5) ratings on Render ---');
  const justRatingsRes = await fetch('https://anilex-backend.onrender.com/api/dev/users/5/ratings', {
    headers: { Authorization: 'Bearer ' + tokenJust }
  });
  const justRatings = await justRatingsRes.json();
  console.log('Just rated count:', justRatings.length || 0);
  const find7195 = (justRatings || []).find(r => r.id === 7195);
  const find7184 = (justRatings || []).find(r => r.id === 7184);
  const find7186 = (justRatings || []).find(r => r.id === 7186);
  const find6970 = (justRatings || []).find(r => r.id === 6970);
  console.log('Just score on 7195 (Бесконечная гача):', find7195 ? find7195.score : 'none');
  console.log('Just score on 7184 (Mob Psycho):', find7184 ? find7184.score : 'none');
  console.log('Just score on 7186 (Мой подарок 9999):', find7186 ? find7186.score : 'none');
  console.log('Just score on 6970 (Kobayashi 2):', find6970 ? find6970.score : 'none');

  console.log('=== SYNC TO RENDER COMPLETE ===');
}

main().catch(err => {
  console.error('Error during sync:', err);
  process.exit(1);
});
