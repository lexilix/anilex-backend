const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 5, nickname: 'Just', email: 'just9jeeet@gmail.com', role: 'admin' },
  'anime-friends-secret-key-2026-minimalism',
  { expiresIn: '7d' }
);

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = https.request('https://anilex-backend.onrender.com' + path, {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch (e) {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const photoTitles = [
  {
    title: 'Её заветное желание',
    originalTitle: 'Josee to Tora to Sakana-tachi / Жозе, тигр и рыба / Жозе',
    score: 10,
    imageUrl: 'https://shikimori.io/system/animes/original/40787.jpg?1711956345',
    type: 'Фильм',
    year: '2020',
    genres: ['Драма', 'Романтика', 'Повседневность']
  },
  {
    title: 'Я был предан товарищами в глубине подземелья, но с помощью навыка «Бесконечная гача» 9999 уровня обрёл союзников и отомщу бывшим соратникам и всему миру!',
    originalTitle: 'Shinjiteita Nakama-tachi ni Dungeon Okuchi de Korosarekaketa ga Gift Mugen Gacha de Level 9999 no Nakama-tachi wo Te ni Irete Moto Party Member to Sekai ni Fukushuu & Zamaa! Shimasu! / Бесконечная гача',
    score: 10,
    imageUrl: '/mugen_gacha_poster.jpg',
    type: 'Сериал',
    year: '2025',
    genres: ['Экшен', 'Фэнтези', 'Приключения']
  },
  {
    id: 576,
    title: 'Мой отец — герой, моя мать — дух, а я перерождённая их дочерью',
    score: 10
  },
  {
    id: 843,
    title: 'Божественный сад у поместья Кусуноки',
    score: 10
  },
  {
    title: 'Мэдака Куроива не понимает моей привлекательности',
    originalTitle: 'Kuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai / Медака Куроива',
    score: 8,
    imageUrl: 'https://shikimori.io/system/animes/original/58853.jpg?1715613861',
    type: 'Сериал',
    year: '2025',
    genres: ['Комедия', 'Романтика', 'Школа', 'Сёнен']
  },
  {
    title: 'ТораДора!',
    originalTitle: 'Toradora!',
    score: 10,
    imageUrl: 'https://shikimori.io/system/animes/original/4224.jpg?1711978202',
    type: 'Сериал',
    year: '2008',
    genres: ['Комедия', 'Драма', 'Романтика', 'Школа']
  },
  {
    title: 'Ты умеешь хранить секреты?',
    originalTitle: 'Kono Kaisha ni Suki na Hito ga Imasu',
    score: 10,
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1123/146384.jpg',
    type: 'Сериал',
    year: '2025',
    genres: ['Комедия', 'Романтика', 'Повседневность', 'Работа']
  },
  {
    title: 'Лепестки реинкарнации',
    originalTitle: 'Reincarnation no Kaben',
    score: 10,
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1064/155042.jpg',
    type: 'Сериал',
    year: '2026',
    genres: ['Экшен', 'Сверхъестественное', 'Сёнен']
  },
  {
    title: 'Ателье колдовских колпаков',
    originalTitle: 'Tongari Boushi no Atelier',
    score: 10,
    imageUrl: 'https://shikimori.io/system/animes/original/51553.jpg?1714590953',
    type: 'Сериал',
    year: '2026',
    genres: ['Фэнтези', 'Приключения', 'Сэйнэн']
  },
  {
    id: 6584,
    title: 'Реинкарнация безработного: История о приключениях в другом мире 2. Часть 2',
    score: 10
  },
  {
    title: 'Синяя тюрьма: Блю Лок против юношеской сборной Японии',
    originalTitle: 'Blue Lock vs. U-20 Japan',
    score: 10,
    imageUrl: 'https://shikimori.io/system/animes/original/54865.jpg?1711514722',
    type: 'Сериал',
    year: '2024',
    genres: ['Спорт', 'Сёнен']
  }
];

async function applyPhotoRatings() {
  console.log('--- Applying Photo 2 ratings for lonely4ka (ID: 22) ---');
  for (const item of photoTitles) {
    let targetAnimeId = item.id;
    if (!targetAnimeId) {
      // Find or create anime
      const searchRes = await request('GET', '/api/search?q=' + encodeURIComponent(item.title));
      const match = searchRes.body && Array.isArray(searchRes.body)
        ? searchRes.body.find(a => a.title.toLowerCase().trim() === item.title.toLowerCase().trim())
        : null;
      if (match) {
        targetAnimeId = match.id;
        console.log('Found existing anime on Render:', item.title, 'ID:', targetAnimeId);
      } else {
        console.log('Creating anime on Render:', item.title);
        const createRes = await request('POST', '/api/dev/anime', {
          title: item.title,
          originalTitle: item.originalTitle,
          imageUrl: item.imageUrl,
          type: item.type,
          year: item.year,
          genres: item.genres,
          description: ''
        });
        if (createRes.body && createRes.body.anime) {
          targetAnimeId = createRes.body.anime.id;
          console.log('Created anime:', item.title, 'new ID:', targetAnimeId);
        } else {
          console.error('Failed to create anime:', item.title, createRes);
          continue;
        }
      }
    }

    // Set rating
    const ratingRes = await request('POST', '/api/dev/users/22/ratings', {
      animeId: targetAnimeId,
      score: item.score
    });
    console.log(`Rated anime ID ${targetAnimeId} (${item.title}) with score ${item.score}:`, ratingRes.body?.success ? 'OK' : ratingRes.body);
  }
}

applyPhotoRatings();
