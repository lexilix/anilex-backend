const db = require('./db');
const { insertOrUpdateAnime } = require('./scraper');

/**
 * Parses anime cards from HTML string of AnimeGO user profile list.
 */
function parseAnimeGoHtml(html) {
  const allItems = [];
  const rawItems = html.split(/<div\s+id="profile-my-list-entry-\d+"/i).slice(1);

  for (const block of rawItems) {
    const slugMatch = block.match(/href="(\/anime\/[^"#]+)"/i);
    const slug = slugMatch ? slugMatch[1].replace('/anime/', '').trim() : null;

    const titleMatch = block.match(/class="user-mylist__title[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    const origMatch = block.match(/class="fw-lighter small mb-2[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const originalTitle = origMatch ? origMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]*)"/i);
    const image = imgMatch ? imgMatch[1] : null;

    const ratingMatch = block.match(/data-rating-value>(\d+)<\/span>/i);
    const score = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

    if (title && slug) {
      allItems.push({ slug, title, originalTitle, score, image });
    }
  }
  return allItems;
}

/**
 * Scrapes all anime cards and user scores from a public AnimeGO user profile across pages.
 */
async function scrapeAnimeGoUserList(userIdOrUrl) {
  let userId = String(userIdOrUrl).trim();
  const match = userId.match(/\/user\/([0-9]+)/);
  if (match) {
    userId = match[1];
  } else {
    userId = userId.replace(/[^0-9]/g, '');
  }

  if (!userId) {
    throw new Error('Не удалось определить цифровой ID пользователя AnimeGO. Ссылка должна быть вида https://animego.me/user/123456');
  }

  console.log('[AnimeGO Importer] Starting scrape for user ID:', userId);
  const allItems = [];
  let page = 1;
  const maxPages = 150; // up to 1500 titles

  while (page <= maxPages) {
    const url = `https://animego.me/user/${userId}?type=2&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.log('[AnimeGO Importer] Page', page, 'status:', res.status);
      break;
    }

    const html = await res.text();
    const items = parseAnimeGoHtml(html);
    if (items.length === 0) {
      console.log('[AnimeGO Importer] No more items found on page', page);
      break;
    }

    allItems.push(...items);
    console.log('[AnimeGO Importer] Page', page, 'parsed', items.length, 'items. Total:', allItems.length);
    page++;
    await new Promise(r => setTimeout(r, 150));
  }

  return allItems;
}

/**
 * Finds matching anime in local DB, or creates record if missing.
 */
function findOrInsertAnime(item) {
  if (!item || !item.title) return null;
  const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
  const normTitle = normalize(item.title);
  const normOriginal = normalize(item.originalTitle);

  // 1. Direct slug match
  let anime = item.slug ? db.prepare('SELECT id, title, original_title, slug, image_url, type, year, genres, description FROM anime WHERE slug = ?').get(item.slug) : null;

  // 2. Normalized title match
  if (!anime) {
    anime = db.prepare('SELECT id, title, original_title, slug, image_url, type, year, genres, description FROM anime WHERE title_lower = ?').get(normTitle);
  }

  // 3. Original title match
  if (!anime && normOriginal && normOriginal.length > 3) {
    anime = db.prepare(`
      SELECT id, title, original_title, slug, image_url, type, year, genres, description FROM anime
      WHERE original_title_lower = ?
         OR (original_title_lower IS NOT NULL AND original_title_lower LIKE ?)
    `).get(normOriginal, `%${normOriginal}%`);
  }

  // 4. Insert into anime table if missing
  if (!anime) {
    const slug = (item.slug && item.slug.trim())
      ? item.slug.trim()
      : 'imported-' + normTitle.replace(/[^a-zа-я0-9]+/gi, '-') + '-' + Math.floor(Math.random() * 100000);
    const image = (item.image && item.image.trim())
      ? item.image.trim()
      : 'https://placehold.co/300x450/1e293b/ffffff?text=' + encodeURIComponent(item.title.slice(0, 30));

    insertOrUpdateAnime({
      slug,
      title: item.title,
      originalTitle: item.originalTitle || '',
      image,
      genres: item.genres || [],
      year: item.year || null,
      description: item.title,
      type: item.type || 'Сериал'
    });
    anime = db.prepare('SELECT id, title, original_title, slug, image_url, type, year, genres, description FROM anime WHERE slug = ? OR title_lower = ?').get(slug, normTitle);
  }

  return anime;
}

/**
 * Imports list of items with ratings into the target user profile.
 */
function importUserRatings(targetUserId, items) {
  console.log('[Importer] Importing ratings for user_id:', targetUserId, 'total items:', items.length);
  let alreadyRatedCount = 0;
  let newlyRatedCount = 0;
  let zeroRatedCount = 0;
  const importedAnime = [];

  const checkStmt = db.prepare('SELECT score FROM ratings WHERE user_id = ? AND anime_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const item of items) {
      if (!item || !item.title) continue;
      const anime = findOrInsertAnime(item);
      if (!anime) continue;

      const existing = checkStmt.get(targetUserId, anime.id);
      if (existing) {
        alreadyRatedCount++;
        importedAnime.push({
          id: anime.id,
          title: anime.title,
          originalTitle: anime.original_title || '',
          slug: anime.slug,
          image: anime.image_url,
          imageUrl: anime.image_url,
          type: anime.type || 'Сериал',
          year: anime.year || '',
          score: existing.score,
          isNew: false
        });
      } else {
        const scoreToSet = (typeof item.score === 'number' && item.score >= 0 && item.score <= 10) ? item.score : 0;
        if (scoreToSet === 0) zeroRatedCount++;
        insertStmt.run(targetUserId, anime.id, scoreToSet);
        newlyRatedCount++;
        importedAnime.push({
          id: anime.id,
          title: anime.title,
          originalTitle: anime.original_title || '',
          slug: anime.slug,
          image: anime.image_url,
          imageUrl: anime.image_url,
          type: anime.type || 'Сериал',
          year: anime.year || '',
          score: scoreToSet,
          isNew: true
        });
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  if (typeof db.saveAccountsBackup === 'function') {
    db.saveAccountsBackup();
  }

  return {
    total: items.length,
    newlyRatedCount,
    alreadyRatedCount,
    zeroRatedCount,
    importedAnime
  };
}

module.exports = {
  parseAnimeGoHtml,
  scrapeAnimeGoUserList,
  findOrInsertAnime,
  importUserRatings
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node server/animego_importer.js <animegoUserIdOrUrl> <targetUserId>');
    process.exit(1);
  }

  const [animegoUser, targetUserId] = args;
  (async () => {
    try {
      const items = await scrapeAnimeGoUserList(animegoUser);
      const result = importUserRatings(Number(targetUserId), items);
      console.log('Import result:', result);
      process.exit(0);
    } catch (e) {
      console.error('Import failed:', e);
      process.exit(1);
    }
  })();
}
