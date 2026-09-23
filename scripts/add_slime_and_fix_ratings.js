const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../server/db');

const JWT_SECRET = process.env.JWT_SECRET || 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });

async function run() {
  console.log('--- Step 1: Clean rating 79 (Восхождение в тени! Реверберация) for user 5 ---');
  // 1. Delete from local SQLite
  db.prepare('DELETE FROM ratings WHERE user_id = 5 AND anime_id = 5655').run();
  console.log('Deleted rating from local ratings table.');

  // 2. Delete from backups
  const bPath = path.join(__dirname, '../data/accounts_backup.json');
  const pbPath = path.join(__dirname, '../data/accounts_backup_permanent.json');

  for (const file of [bPath, pbPath]) {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data.ratings)) {
        const before = data.ratings.length;
        data.ratings = data.ratings.filter(r => !(r.user_id === 5 && r.anime_id === 5655));
        console.log(`Cleaned ${file}: before ${before}, after ${data.ratings.length}`);
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  // 3. Delete from Render
  try {
    const rateRes = await fetch('https://anilex-backend.onrender.com/api/anime/5655/rate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJust}`
      },
      body: JSON.stringify({ score: null })
    });
    console.log('Render rate delete response:', await rateRes.json());
  } catch (err) {
    console.error('Failed to delete rating on Render:', err.message);
  }

  console.log('\n--- Step 2: Define and Insert All Slime Franchise Titles ---');

  const slimeTitles = [
    {
      id: 7191,
      slug: 'shiki-37430',
      title: 'О моём перерождении в слизь',
      originalTitle: 'Tensei shitara Slime Datta Ken / That Time I Got Reincarnated as a Slime',
      imageUrl: 'https://shikimori.one/system/animes/original/37430.jpg?1711977107',
      type: 'Сериал',
      year: '2018',
      genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'Знакомьтесь! Сатору Миками, 37-летний рядовой служащий крупной финансовой компании. Погибнув от ножевого ранения грабителя, он перерождается в фэнтезийном мире в виде разумной слизи с уникальным навыком «Великий Мудрец» и «Хищник».',
      season: '1-й сезон'
    },
    {
      id: 7192,
      slug: 'shiki-39551',
      title: 'О моём перерождении в слизь 2',
      originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season / That Time I Got Reincarnated as a Slime Season 2',
      imageUrl: 'https://shikimori.one/system/animes/original/39551.jpg?1711977070',
      type: 'Сериал',
      year: '2021',
      genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'После перерождения Сатору в новом мире в качестве слизи по имени Римуру Темпест, основанное им государство монстров процветает. Однако мирная жизнь рушится, когда на Темпест нападают враждебные королевства.',
      season: '2-й сезон'
    },
    {
      id: 7197,
      slug: 'shiki-41487',
      title: 'О моём перерождении в слизь 2. Часть 2',
      originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season Part 2 / That Time I Got Reincarnated as a Slime Season 2 Part 2',
      imageUrl: 'https://shikimori.one/system/animes/original/41487.jpg?1711977051',
      type: 'Сериал',
      year: '2021',
      genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'Справившись с обрушившейся на страну трагедией, Римуру Темпест, пробудившийся как истинный Князь Тьмы, готовится заявить миру о правах монстров и столкнуться с коварным Клейманом на Вальпургиевом совете.',
      season: '2-й сезон часть 2'
    },
    {
      id: 7198,
      slug: 'shiki-49877',
      title: 'О моём перерождении в слизь: Алые узы',
      originalTitle: 'Tensei shitara Slime Datta Ken Movie: Guren no Kizuna-hen / That Time I Got Reincarnated as a Slime: Scarlet Bond',
      imageUrl: 'https://shikimori.one/system/animes/original/49877.jpg?1709524281',
      type: 'Фильм',
      year: '2022',
      genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'История разворачивается вокруг небольшого королевства Раджа к западу от Темпеста. Римуру и его союзники встречают Хииро — выжившего огра и названого брата Бенимару, чья верность королеве Тове ведет к масштабному конфликту.',
      season: 'Фильм 1'
    },
    {
      id: 7199,
      slug: 'shiki-54565',
      title: 'О моём перерождении в слизь: Мечта Колеуса',
      originalTitle: 'Tensei shitara Slime Datta Ken: Coleus no Yume / That Time I Got Reincarnated as a Slime: Visions of Coleus',
      imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
      type: 'ONA',
      year: '2023',
      genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'По просьбе Юки Кагурадзаки, Римуру отправляется в королевство Колеус, где назревает ожесточенная борьба за трон между принцами Сауроном и Асланом.',
      season: 'Спешл'
    },
    {
      id: 1446,
      slug: 'shiki-53580',
      title: 'О моём перерождении в слизь 3',
      originalTitle: 'Tensei shitara Slime Datta Ken 3rd Season',
      imageUrl: 'https://img.cdngos.com/v/250x350/anime/66/66732cd781462452350534',
      type: 'Сериал',
      year: '2024',
      genres: ['Экшен', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'Римуру Темпест одерживает победу в решающем поединке с Повелителем демонов Клейманом и официально занимает свое место в «Октаграмме». Впереди — переговоры со Священной империей Любелиос и Хината Сакагучи.',
      season: '3-й сезон'
    },
    {
      id: 650,
      slug: 'shiki-59971',
      title: 'О моём перерождении в слизь: Слёзы синего моря',
      originalTitle: 'Tensei shitara Slime Datta Ken Movie 2: Soukai no Namida-hen',
      imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a46479ee4c2c213407168',
      type: 'Фильм',
      year: '2026',
      genres: ['Экшен', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'В глубинах океана скрывается процветающее королевство Кайэн под покровительством Водяного дракона. Новые вызовы зовут Римуру и жителей Темпеста в морские просторы.',
      season: 'Фильм 2'
    },
    {
      id: 914,
      slug: 'shiki-59970',
      title: 'О моём перерождении в слизь 4',
      originalTitle: 'Tensei shitara Slime Datta Ken 4th Season',
      imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a3a42979381c559599569',
      type: 'Сериал',
      year: '2026',
      genres: ['Экшен', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: 'Мечта повелителя демонов Римуру — создать союз между людьми и монстрами — становится всё ближе к осуществлению. Но на его пути встают Гранвилл Роззо и его внучка Марибел.',
      season: '4-й сезон'
    }
  ];

  // Interlink all Slime titles
  for (const t of slimeTitles) {
    t.linkedAnime = slimeTitles
      .filter(other => other.id !== t.id)
      .map(other => ({
        id: other.id,
        title: other.title,
        imageUrl: other.imageUrl,
        year: other.year,
        type: other.type,
        relation: other.season
      }));
    t.related_json = JSON.stringify(t.linkedAnime);
  }

  // 1. Insert/Update in local SQLite
  const upsertStmt = db.prepare(`
    INSERT INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      title_lower = excluded.title_lower,
      original_title = excluded.original_title,
      original_title_lower = excluded.original_title_lower,
      image_url = excluded.image_url,
      type = excluded.type,
      year = excluded.year,
      genres = excluded.genres,
      description = excluded.description,
      season = excluded.season,
      related_json = excluded.related_json
  `);

  for (const t of slimeTitles) {
    const tLower = (t.title || '').toLowerCase().trim();
    const oLower = (t.originalTitle || '').toLowerCase().trim();
    upsertStmt.run(
      t.id,
      t.slug,
      t.title,
      tLower,
      t.originalTitle,
      oLower,
      t.imageUrl,
      t.type,
      t.year,
      JSON.stringify(t.genres),
      t.description,
      t.season,
      t.related_json
    );
    console.log(`Local DB updated: ${t.id} - ${t.title} (${t.season})`);
  }

  // 2. Update initialCatalog.json
  const catalogPath = path.join(__dirname, '../client/src/data/initialCatalog.json');
  let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalogMap = new Map();
  for (const item of catalog) {
    if (item && item.id) catalogMap.set(Number(item.id), item);
  }

  for (const t of slimeTitles) {
    const existing = catalogMap.get(t.id) || {};
    catalogMap.set(t.id, {
      ...existing,
      id: t.id,
      slug: t.slug,
      title: t.title,
      originalTitle: t.originalTitle,
      imageUrl: t.imageUrl,
      type: t.type,
      year: t.year,
      genres: t.genres,
      description: t.description,
      season: t.season,
      linkedAnime: t.linkedAnime,
      related_json: t.related_json,
      myScore: existing.myScore ?? null,
      averageScore: existing.averageScore ?? null,
      ratingCount: existing.ratingCount ?? 0,
      isFavorite: existing.isFavorite ?? false,
      isHidden: existing.isHidden ?? false
    });
  }

  catalog = Array.from(catalogMap.values());
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Updated initialCatalog.json with ${slimeTitles.length} linked Slime titles.`);

  // 3. Save into accounts_backup.json and accounts_backup_permanent.json
  if (typeof db.saveAccountsBackup === 'function') {
    db.saveAccountsBackup();
    console.log('Saved accounts_backup.json via db.saveAccountsBackup().');
  }

  // 4. Sync each title to Render backend
  console.log('\n--- Step 3: Register/Sync Slime Titles to Render Backend ---');
  for (const t of slimeTitles) {
    try {
      const regRes = await fetch('https://anilex-backend.onrender.com/api/anime/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime: t })
      });
      console.log(`Render register ${t.id} (${t.title}): status ${regRes.status}`);

      // Also update via dev API to ensure season & related_json are saved
      const putRes = await fetch(`https://anilex-backend.onrender.com/api/dev/anime/${t.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenJust}`
        },
        body: JSON.stringify(t)
      });
      console.log(`Render dev update ${t.id}: status ${putRes.status}`);
    } catch (err) {
      console.error(`Failed to sync ${t.id} to Render:`, err.message);
    }
  }

  console.log('\n--- Step 4: Verify search on Render ---');
  const searchRes = await fetch('https://anilex-backend.onrender.com/api/anime?search=' + encodeURIComponent('О моём перерождении в слизь'));
  const sData = await searchRes.json();
  console.log('Search results on Render now:', sData.items.map(it => ({ id: it.id, title: it.title, season: it.season })));

  console.log('\nAll done!');
}

run().catch(console.error);
