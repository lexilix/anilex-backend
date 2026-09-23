const fs = require('fs');
const db = require('../server/db');

const slime = [
  {
    id: 7191,
    title: 'О моём перерождении в слизь',
    originalTitle: 'Tensei shitara Slime Datta Ken',
    imageUrl: 'https://shikimori.one/system/animes/original/37430.jpg?1711977107',
    season: '1-й сезон',
    year: '2018',
    type: 'Сериал'
  },
  {
    id: 7192,
    title: 'О моём перерождении в слизь 2',
    originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season',
    imageUrl: 'https://shikimori.one/system/animes/original/39551.jpg?1711977070',
    season: '2-й сезон',
    year: '2021',
    type: 'Сериал'
  },
  {
    id: 7193,
    title: 'О моём перерождении в слизь 2. Часть 2',
    originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season Part 2',
    imageUrl: 'https://shikimori.one/system/animes/original/41487.jpg?1711977051',
    season: '2-й сезон часть 2',
    year: '2021',
    type: 'Сериал'
  },
  {
    id: 7194,
    title: 'О моём перерождении в слизь: Алые узы',
    originalTitle: 'Tensei shitara Slime Datta Ken Movie: Guren no Kizuna-hen',
    imageUrl: 'https://shikimori.one/system/animes/original/49877.jpg?1709524281',
    season: 'Фильм 1',
    year: '2022',
    type: 'Фильм'
  },
  {
    id: 7195,
    title: 'О моём перерождении в слизь: Мечта Колеуса',
    originalTitle: 'Tensei shitara Slime Datta Ken: Coleus no Yume',
    imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
    season: 'Спешл',
    year: '2023',
    type: 'ONA'
  },
  {
    id: 1446,
    title: 'О моём перерождении в слизь 3',
    originalTitle: 'Tensei shitara Slime Datta Ken 3rd Season',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/66/66732cd781462452350534',
    season: '3-й сезон',
    year: '2024',
    type: 'Сериал'
  },
  {
    id: 650,
    title: 'О моём перерождении в слизь: Слёзы синего моря',
    originalTitle: 'Tensei shitara Slime Datta Ken Movie 2: Soukai no Namida-hen',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a46479ee4c2c213407168',
    season: 'Фильм 2',
    year: '2026',
    type: 'Фильм'
  },
  {
    id: 914,
    title: 'О моём перерождении в слизь 4',
    originalTitle: 'Tensei shitara Slime Datta Ken 4th Season',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a3a42979381c559599569',
    season: '4-й сезон',
    year: '2026',
    type: 'Сериал'
  }
];

// Clean any old 7197, 7198, 7199
db.prepare('DELETE FROM anime WHERE id IN (7197, 7198, 7199)').run();

const catalogPath = './client/src/data/initialCatalog.json';
let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
catalog = catalog.filter(c => ![7197, 7198, 7199].includes(c.id));

for (const s of slime) {
  const links = slime.filter(o => o.id !== s.id).map(o => ({
    id: o.id,
    title: o.title,
    imageUrl: o.imageUrl,
    type: o.type,
    year: o.year,
    relation: o.season
  }));
  const relJson = JSON.stringify(links);

  db.prepare(`
    INSERT INTO anime (id, slug, title, title_lower, original_title, image_url, type, year, season, related_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      title_lower = excluded.title_lower,
      season = excluded.season,
      related_json = excluded.related_json,
      image_url = excluded.image_url
  `).run(
    s.id,
    'shiki-slime-' + s.id,
    s.title,
    s.title.toLowerCase().trim(),
    s.originalTitle,
    s.imageUrl,
    s.type,
    s.year,
    s.season,
    relJson
  );

  const catIdx = catalog.findIndex(c => c.id === s.id);
  if (catIdx >= 0) {
    catalog[catIdx].season = s.season;
    catalog[catIdx].imageUrl = s.imageUrl;
    catalog[catIdx].linkedAnime = links;
    catalog[catIdx].related_json = relJson;
  } else {
    catalog.push({
      id: s.id,
      slug: 'shiki-slime-' + s.id,
      title: s.title,
      originalTitle: s.originalTitle,
      imageUrl: s.imageUrl,
      type: s.type,
      year: s.year,
      genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
      description: s.title,
      season: s.season,
      linkedAnime: links,
      related_json: relJson,
      myScore: null,
      averageScore: null,
      ratingCount: 0
    });
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
if (typeof db.saveAccountsBackup === 'function') db.saveAccountsBackup();
console.log('Local DB & catalog updated to match Render IDs perfectly.');
