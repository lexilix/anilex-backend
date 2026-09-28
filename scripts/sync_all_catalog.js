const https = require('https');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

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

async function syncMissing() {
  console.log('--- Syncing remaining catalog anime from local DB to Render ---');
  const db = new DatabaseSync('data/anime_ratings.db');

  const checkTitles = [
    'Клинок, рассекающий демонов: Бесконечный поезд. Фильм',
    'Тетрадь смерти',
    'Бесконечная чистота',
    'О моём перерождении в слизь 2. Часть 2',
    'О моём перерождении в слизь: Алые узы',
    'О моём перерождении в слизь: Мечта Колеуса',
    'ТораДора! Секрет приготовления бэнто',
    'Реинкарнация безработного: История о приключениях в другом мире — Эрис охотится на гоблинов',
    'Синяя тюрьма: Блю Лок — Эпизод с Наги',
    'Время пыток, принцесса!',
    'Труська, Чулко и пресвятой Подвяз',
    'Пуниру — милая слизь',
    'Список нечисти'
  ];

  for (const title of checkTitles) {
    const localAnime = db.prepare('SELECT * FROM anime WHERE title = ? OR title LIKE ? LIMIT 1').get(title, '%' + title + '%');
    if (!localAnime) {
      console.warn('Not found in local DB:', title);
      continue;
    }

    const searchRes = await request('GET', '/api/search?q=' + encodeURIComponent(localAnime.title));
    const exists = searchRes.body && Array.isArray(searchRes.body) && searchRes.body.some(a => a.title.toLowerCase().trim() === localAnime.title.toLowerCase().trim());
    if (exists) {
      console.log('Already exists on Render:', localAnime.title);
      continue;
    }

    console.log('Adding to Render:', localAnime.title);
    let parsedGenres = [];
    try {
      parsedGenres = JSON.parse(localAnime.genres || '[]');
    } catch (e) {
      parsedGenres = (localAnime.genres || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    const createRes = await request('POST', '/api/dev/anime', {
      title: localAnime.title,
      originalTitle: localAnime.original_title || '',
      imageUrl: localAnime.image_url || '',
      type: localAnime.type || 'Сериал',
      year: localAnime.year ? String(localAnime.year) : '',
      genres: parsedGenres,
      description: localAnime.description || ''
    });

    if (createRes.body && createRes.body.anime) {
      console.log('Successfully added:', localAnime.title, 'new ID:', createRes.body.anime.id);
    } else {
      console.error('Failed to add:', localAnime.title, createRes);
    }
  }
  console.log('--- Done syncing remaining catalog! ---');
}

syncMissing();
