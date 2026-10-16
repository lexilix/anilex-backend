const db = require('../server/db');

console.log('--- Testing query performance and results in server ---');

// 1. Romance filter
console.time('Romance query');
const romance = db.prepare(`
  SELECT a.id, a.title, a.genres, a.year, a.type
  FROM anime a
  WHERE a.genres LIKE ? AND (a.is_published = 1 OR a.is_published IS NULL)
  GROUP BY LOWER(TRIM(a.title)), a.year
  LIMIT 15
`).all('%"Романтика"%');
console.timeEnd('Romance query');
console.log('Romance items count:', romance.length);
const hasLinkClickInRomance = romance.some(r => r.title.includes('Агенты времени'));
console.log('Has Link Click in romance (should be FALSE):', hasLinkClickInRomance);

// 2. Sort by my_score_desc for user 5 (Just)
console.time('My score desc query');
const myScoreSort = db.prepare(`
  SELECT
    a.id,
    a.title,
    (
      SELECT r.score FROM ratings r
      WHERE r.anime_id = a.id AND r.user_id = 5
      LIMIT 1
    ) as my_score
  FROM anime a
  WHERE (a.is_published = 1 OR a.is_published IS NULL)
  GROUP BY LOWER(TRIM(a.title)), a.year
  ORDER BY
    (CASE WHEN my_score IS NOT NULL THEN my_score ELSE -1 END) DESC,
    (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC,
    a.id DESC
  LIMIT 15
`).all();
console.timeEnd('My score desc query');
console.log('My score desc top 5 scores:', myScoreSort.slice(0, 5).map(r => ({ title: r.title, score: r.my_score })));

// 3. Year 2026 filter
console.time('Year 2026 query');
const year2026 = db.prepare(`
  SELECT a.id, a.title, a.year
  FROM anime a
  WHERE a.year = '2026' AND (a.is_published = 1 OR a.is_published IS NULL)
  GROUP BY LOWER(TRIM(a.title)), a.year
  LIMIT 15
`).all();
console.timeEnd('Year 2026 query');
console.log('Year 2026 count:', year2026.length, 'All 2026?:', year2026.every(r => r.year === '2026'));

// 4. Type Сериал filter
console.time('Type query');
const series = db.prepare(`
  SELECT a.id, a.title, a.type
  FROM anime a
  WHERE a.type = 'Сериал' AND (a.is_published = 1 OR a.is_published IS NULL)
  GROUP BY LOWER(TRIM(a.title)), a.year
  LIMIT 15
`).all();
console.timeEnd('Type query');
console.log('Type Сериал count:', series.length, 'All Сериал?:', series.every(r => r.type === 'Сериал'));

// 5. filterStatus = my_rated for user 5
console.time('My rated query');
const myRated = db.prepare(`
  SELECT a.id, a.title,
    (SELECT r.score FROM ratings r WHERE r.anime_id = a.id AND r.user_id = 5 LIMIT 1) as my_score
  FROM anime a
  WHERE (SELECT COUNT(*) FROM ratings WHERE anime_id = a.id AND user_id = 5) > 0
    AND (a.is_published = 1 OR a.is_published IS NULL)
  GROUP BY LOWER(TRIM(a.title)), a.year
  LIMIT 15
`).all();
console.timeEnd('My rated query');
console.log('My rated count:', myRated.length, 'All have score?:', myRated.every(r => r.my_score !== null));

// Verify Just and Goose counts
console.log('Just count:', db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 5').get().c);
console.log('Goose count:', db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 25').get().c);
