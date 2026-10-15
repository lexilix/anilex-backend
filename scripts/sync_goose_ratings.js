const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'anime_ratings.db');
const db = new DatabaseSync(dbPath);

async function syncGooseRatings() {
  console.log('=== SYNCING GOOSE4KA RATINGS FROM RENDER ===');
  const loginRes = await fetch('https://anilex-backend.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'just9jeeet@gmail.com', password: 'any_password' })
  });
  const { token } = await loginRes.json();
  const res = await fetch('https://anilex-backend.onrender.com/api/users/25/profile', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  const ratings = data.ratings || [];
  console.log(`Received ${ratings.length} ratings for Goose4ka from Render:`);

  const insertRatingStmt = db.prepare(`
    INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
    VALUES (25, ?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      score = excluded.score,
      updated_at = excluded.updated_at
  `);

  const insertAnimeStmt = db.prepare(`
    INSERT INTO anime (id, slug, title, image_url, type, year, genres, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title
  `);

  for (const r of ratings) {
    // Ensure anime exists
    const animeExists = db.prepare('SELECT id FROM anime WHERE id = ?').get(r.id);
    if (!animeExists) {
      try {
        insertAnimeStmt.run(
          r.id,
          r.slug || `anime-${r.id}`,
          r.title,
          r.imageUrl || '',
          r.type || 'Сериал',
          r.year || '',
          JSON.stringify(r.genres || [])
        );
      } catch (e) {}
    }
    insertRatingStmt.run(r.id, r.score, r.updatedAt || new Date().toISOString(), r.updatedAt || new Date().toISOString());
    console.log(`Saved rating: [${r.id}] ${r.title} = ${r.score}`);
  }

  // Update backup files
  ['accounts_backup.json', 'accounts_backup_permanent.json'].forEach(f => {
    const fPath = path.join(__dirname, '..', 'data', f);
    if (fs.existsSync(fPath)) {
      const bData = JSON.parse(fs.readFileSync(fPath, 'utf8'));
      if (!Array.isArray(bData.ratings)) bData.ratings = [];
      for (const r of ratings) {
        const idx = bData.ratings.findIndex(x => x.user_id === 25 && x.anime_id === r.id);
        const rEntry = {
          user_id: 25,
          anime_id: r.id,
          score: r.score,
          created_at: r.updatedAt || new Date().toISOString(),
          updated_at: r.updatedAt || new Date().toISOString()
        };
        if (idx >= 0) {
          bData.ratings[idx] = rEntry;
        } else {
          bData.ratings.push(rEntry);
        }
      }
      fs.writeFileSync(fPath, JSON.stringify(bData, null, 2), 'utf8');
      console.log(`Saved to ${f}: total ratings count = ${bData.ratings.length}`);
    }
  });

  // Verify Just ratings
  const justCount = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 5').get().c;
  console.log('Just ratings count verification:', justCount);
  if (justCount !== 211) throw new Error('Just count mismatch!');
}

syncGooseRatings().catch(console.error);
