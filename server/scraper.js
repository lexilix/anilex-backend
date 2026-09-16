const db = require('./db');

function getLastScrapedPage() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'last_scraped_page'").get();
  return row ? parseInt(row.value, 10) : 1;
}

function setLastScrapedPage(page) {
  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES ('last_scraped_page', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(page));
}

// Save anime items safely into database (with strict deduplication)
function insertOrUpdateAnime(item) {
  if (!item.title || !item.slug || !item.image) return;

  const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
  const cleanTitle = item.title.trim();
  const cleanOriginal = (item.originalTitle || '').trim();
  const normTitle = normalize(cleanTitle);
  const normOriginal = normalize(cleanOriginal);

  // 1. Check if an anime with this exact slug exists
  let existing = db.prepare('SELECT id, slug, title, original_title, image_url, type, year, genres, description FROM anime WHERE slug = ?').get(item.slug);

  // 2. Check by normalized Russian title (+ year or title alone)
  if (!existing) {
    if (item.year) {
      existing = db.prepare(`
        SELECT id, slug, title, original_title, image_url, type, year, genres, description
        FROM anime
        WHERE title_lower = ? AND year = ?
      `).get(normTitle, item.year);
    }
    if (!existing) {
      existing = db.prepare(`
        SELECT id, slug, title, original_title, image_url, type, year, genres, description
        FROM anime
        WHERE title_lower = ?
      `).get(normTitle);
    }
  }

  // 3. Check by original/romaji/English title
  if (!existing && normOriginal && normOriginal.length > 3) {
    existing = db.prepare(`
      SELECT id, slug, title, original_title, image_url, type, year, genres, description
      FROM anime
      WHERE original_title_lower = ?
         OR (original_title_lower IS NOT NULL AND original_title_lower LIKE ?)
         OR (title_lower = ?)
    `).get(normOriginal, `%${normOriginal}%`, normOriginal);
  }

  // 4. Check by exact poster image URL
  if (!existing && item.image && !item.image.includes('placeholder') && !item.image.includes('404')) {
    existing = db.prepare(`
      SELECT id, slug, title, original_title, image_url, type, year, genres, description
      FROM anime
      WHERE image_url = ?
    `).get(item.image);
  }

  // 5. Check by identical non-empty description
  if (!existing && item.description && item.description.length > 50) {
    existing = db.prepare(`
      SELECT id, slug, title, original_title, image_url, type, year, genres, description
      FROM anime
      WHERE description = ?
    `).get(item.description);
  }

  if (existing) {
    // Merge without creating a duplicate row!
    let mergedGenres = [];
    try { mergedGenres = JSON.parse(existing.genres || '[]'); } catch (e) {}
    if (Array.isArray(item.genres) && item.genres.length > 0) {
      for (const g of item.genres) {
        if (!mergedGenres.includes(g)) mergedGenres.push(g);
      }
    }

    const desc = (existing.description && existing.description.length > 40)
      ? existing.description
      : (item.description || existing.description || '');

    let origTitle = existing.original_title || '';
    if (cleanOriginal) {
      const parts = cleanOriginal.split('/').map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (!origTitle.toLowerCase().includes(p.toLowerCase())) {
          origTitle = origTitle ? `${origTitle} / ${p}` : p;
        }
      }
    }
    const yr = existing.year || item.year || '';
    const img = (!existing.image_url || existing.image_url.includes('shikimori')) && !item.slug.startsWith('shiki-')
      ? item.image
      : (existing.image_url || item.image);

    db.prepare(`
      UPDATE anime SET
        original_title = ?,
        original_title_lower = ?,
        year = ?,
        image_url = ?,
        genres = ?,
        description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(origTitle, normalize(origTitle), yr, img, JSON.stringify(mergedGenres), desc, existing.id);
    return;
  }

  // 6. Otherwise insert new row
  const stmt = db.prepare(`
    INSERT INTO anime (slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      title_lower = excluded.title_lower,
      original_title = excluded.original_title,
      original_title_lower = excluded.original_title_lower,
      image_url = excluded.image_url,
      type = excluded.type,
      year = excluded.year,
      genres = excluded.genres,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    item.slug,
    cleanTitle,
    normTitle,
    cleanOriginal,
    normOriginal,
    item.image,
    item.type || 'Сериал',
    item.year || '',
    JSON.stringify(item.genres || []),
    item.description || ''
  );
}

// Scrape a specific page from animego.me using correct URL: /anime/2, /anime/3 ...
async function scrapeAnimeGoPage(page = 1) {
  const url = page === 1 ? 'https://animego.me/anime' : `https://animego.me/anime/${page}`;
  console.log(`[Scraper] Fetching ${url}...`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  const items = [];
  const parts = html.split('class="ani-list__item d-flex g-col-12"');

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const linkMatch = chunk.match(/href="\/anime\/([a-zA-Z0-9\-]+)"/);
    const slug = linkMatch ? linkMatch[1] : null;

    const imgMatch = chunk.match(/src="(https:\/\/[^"]+)"[^>]*alt="([^"]*)"/);
    const image = imgMatch ? imgMatch[1] : '';
    const title = imgMatch ? imgMatch[2] : '';

    const origMatch = chunk.match(/<div class="fw-lighter small mb-2 text-line-clamp"[^>]*>\s*(.*?)\s*<\/div>/);
    const originalTitle = origMatch ? origMatch[1].replace(/#\s*/, '').trim() : '';

    const genreMatches = [...chunk.matchAll(/href="\/anime\/(genre|type|season)\/([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    const genres = [];
    let type = 'Сериал';
    let year = '';

    for (const gm of genreMatches) {
      const kind = gm[1];
      const valName = gm[3].trim();
      if (kind === 'genre') {
        if (!genres.includes(valName)) genres.push(valName);
      } else if (kind === 'type') {
        type = valName;
      } else if (kind === 'season') {
        year = valName;
      }
    }

    const descMatch = chunk.match(/<div class="ani-list__item-description[^>]*>\s*([\s\S]*?)\s*<\/div>/);
    const description = descMatch
      ? descMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#039;/g, "'")
          .replace(/<[^>]+>/g, '')
          .trim()
      : '';

    if (title && slug && image) {
      items.push({
        slug,
        title,
        originalTitle,
        image,
        type,
        year,
        genres,
        description
      });
    }
  }

  return items;
}

// Fetch the NEXT page from animego dynamically for continuous infinite scroll
let isScrapingNext = false;
async function fetchNextAnimeGoPage() {
  if (isScrapingNext) return 0;
  isScrapingNext = true;

  try {
    const lastPage = getLastScrapedPage() || 1;
    const nextPage = lastPage + 1;
    console.log(`[Infinite AnimeGO] Live fetching next page ${nextPage}...`);
    const items = await scrapeAnimeGoPage(nextPage);
    console.log(`[Infinite AnimeGO] Received ${items.length} new titles from page ${nextPage}`);

    for (const item of items) {
      insertOrUpdateAnime(item);
    }

    setLastScrapedPage(nextPage);
    return items.length;
  } catch (err) {
    console.error('[Infinite AnimeGO] Error fetching next page:', err.message);
    return 0;
  } finally {
    isScrapingNext = false;
  }
}

// Sync multiple pages from animego
async function syncFromAnimeGo(pages = [1, 2, 3, 4, 5]) {
  let count = 0;
  for (const p of pages) {
    try {
      const items = await scrapeAnimeGoPage(p);
      console.log(`[AnimeGO Scraper] Parsed ${items.length} items from page ${p}`);
      for (const item of items) {
        insertOrUpdateAnime(item);
        count++;
      }
      setLastScrapedPage(Math.max(getLastScrapedPage(), p));
    } catch (err) {
      console.error(`[AnimeGO Scraper] Error scraping page ${p}:`, err.message);
    }
  }
  return count;
}

// Search anime on animego.me and insert into database
async function searchAnimeGo(query) {
  if (!query || !query.trim()) return 0;
  const cleanQuery = query.trim();
  const url = `https://animego.me/search/anime?q=${encodeURIComponent(cleanQuery)}`;
  console.log(`[Search AnimeGO] Searching for "${cleanQuery}" at ${url}...`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!res.ok) {
      console.warn(`[Search AnimeGO] HTTP error ${res.status} searching for "${cleanQuery}"`);
      return 0;
    }

    const html = await res.text();
    // Split by grid item divs: <div class="ani-grid__item ...">
    const parts = html.split(/<div class="ani-grid__item\s[^"]*">/);
    const items = [];

    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i];
      const linkMatch = chunk.match(/href="\/anime\/([a-zA-Z0-9\-]+)"/);
      const slug = linkMatch ? linkMatch[1] : null;

      const imgMatch = chunk.match(/src="(https:\/\/[^"]+)"[^>]*alt="([^"]*)"/);
      const image = imgMatch ? imgMatch[1] : '';
      const title = imgMatch ? imgMatch[2].trim() : '';

      const origMatch = chunk.match(/<div class="fw-lighter small mb-1 text-line-clamp"[^>]*>\s*(.*?)\s*<\/div>/);
      const originalTitle = origMatch ? origMatch[1].trim() : '';

      // Type and year in genres links
      const genreSpanMatches = [...chunk.matchAll(/<span class="ani-grid__item-genres__link">\s*([^<]+)\s*<\/span>/g)];
      let type = 'Сериал';
      let year = '';
      const genres = [];

      for (const gm of genreSpanMatches) {
        const val = gm[1].trim();
        if (/^\d{4}$/.test(val)) {
          year = val;
        } else if (['Сериал', 'Фильм', 'OVA', 'ONA', 'Спешл'].includes(val)) {
          type = val;
        } else {
          genres.push(val);
        }
      }

      if (title && slug && image) {
        items.push({
          slug,
          title,
          originalTitle,
          image,
          type,
          year,
          genres,
          description: ''
        });
      }
    }

    console.log(`[Search AnimeGO] Found ${items.length} titles from search. Fetching details for richer content...`);

    // Fetch details for up to 8 top search items concurrently to get genres and full description
    await Promise.all(
      items.slice(0, 8).map(async (item) => {
        try {
          const detailUrl = `https://animego.me/anime/${item.slug}`;
          const dRes = await fetch(detailUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          });
          if (dRes.ok) {
            const dHtml = await dRes.text();
            // Description
            const descMatch = dHtml.match(/<div class="description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
              || dHtml.match(/<div class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (descMatch) {
              item.description = descMatch[1]
                .replace(/<[^>]+>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&#039;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
            }

            // Alternate Name (English title e.g. "Solo Leveling", "Komi Can't Communicate")
            const altNameMatch = dHtml.match(/"alternateName":\s*"([^"]+)"/i);
            if (altNameMatch && altNameMatch[1]) {
              const alt = altNameMatch[1].trim();
              if (alt && (!item.originalTitle || !item.originalTitle.toLowerCase().includes(alt.toLowerCase()))) {
                item.originalTitle = item.originalTitle ? `${item.originalTitle} / ${alt}` : alt;
              }
            }

            // Genres
            const detailGenres = [...dHtml.matchAll(/href="\/anime\/genre\/([^"]+)"[^>]*>([^<]+)<\/a>/g)]
              .map(g => g[2].trim());
            if (detailGenres.length > 0) {
              item.genres = detailGenres;
            }
          }
        } catch (e) {
          // ignore single item fetch error
        }
      })
    );

    const isQueryAscii = /^[a-zA-Z0-9\s':\-!]+$/.test(cleanQuery);
    for (const item of items) {
      if (isQueryAscii && cleanQuery.length > 2) {
        const normItemTitle = (item.title || '').toLowerCase();
        const normItemOrig = (item.originalTitle || '').toLowerCase();
        if (normItemTitle.includes(cleanQuery.toLowerCase()) || normItemOrig.includes(cleanQuery.toLowerCase())) {
          if (!normItemOrig.includes(cleanQuery.toLowerCase())) {
            item.originalTitle = item.originalTitle ? `${item.originalTitle} / ${cleanQuery}` : cleanQuery;
          }
        }
      }
      insertOrUpdateAnime(item);
    }

    console.log(`[Search AnimeGO] Successfully saved ${items.length} titles into database.`);
    return items.length;
  } catch (err) {
    console.error(`[Search AnimeGO] Error searching "${cleanQuery}":`, err.message);
    return 0;
  }
}

// Search anime on Shikimori API (covers titles not yet on AnimeGO or alternative translations like "Бесконечная гача")
async function searchShikimori(query) {
  if (!query || !query.trim()) return 0;
  const cleanQuery = query.trim();
  const url = `https://shikimori.one/api/animes?search=${encodeURIComponent(cleanQuery)}&limit=10`;
  console.log(`[Search Shikimori] Searching for "${cleanQuery}" at ${url}...`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.warn(`[Search Shikimori] HTTP error ${res.status} for "${cleanQuery}"`);
      return 0;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return 0;
    }

    const items = [];
    const typeMap = {
      tv: 'Сериал',
      movie: 'Фильм',
      ova: 'OVA',
      ona: 'ONA',
      special: 'Спешл',
      music: 'Клип'
    };

    for (const d of data) {
      const title = d.russian || d.name;
      const originalTitle = d.name || '';
      const slug = `shiki-${d.id}`;
      const image = d.image?.original ? (d.image.original.startsWith('http') ? d.image.original : `https://shikimori.one${d.image.original}`) : '';
      const type = typeMap[d.kind] || 'Сериал';
      const year = d.aired_on ? d.aired_on.slice(0, 4) : '';

      if (title && slug && image) {
        items.push({
          slug,
          title,
          originalTitle,
          image,
          type,
          year,
          genres: [],
          description: ''
        });
      }
    }

    // Fetch details for top 6 items to enrich description, genres, English title and synonyms
    await Promise.all(
      items.slice(0, 6).map(async (item) => {
        try {
          const detailId = item.slug.replace('shiki-', '');
          const dRes = await fetch(`https://shikimori.one/api/animes/${detailId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (dRes.ok) {
            const detailData = await dRes.json();
            if (detailData.description) {
              item.description = detailData.description.replace(/\[[^\]]+\]/g, '').trim();
            }
            if (Array.isArray(detailData.genres) && detailData.genres.length > 0) {
              item.genres = detailData.genres.map(g => g.russian || g.name);
            }

            // Extract English titles and synonyms
            const extraTitles = [];
            if (Array.isArray(detailData.english)) {
              for (const en of detailData.english) {
                if (en && typeof en === 'string' && en.trim()) extraTitles.push(en.trim());
              }
            } else if (typeof detailData.english === 'string' && detailData.english.trim()) {
              extraTitles.push(detailData.english.trim());
            }

            if (Array.isArray(detailData.synonyms)) {
              for (const syn of detailData.synonyms) {
                if (syn && typeof syn === 'string' && syn.trim()) extraTitles.push(syn.trim());
              }
            }

            for (const et of extraTitles) {
              if (!item.originalTitle || !item.originalTitle.toLowerCase().includes(et.toLowerCase())) {
                item.originalTitle = item.originalTitle ? `${item.originalTitle} / ${et}` : et;
              }
            }
          }
        } catch (e) {
          // ignore detail fetch error
        }
      })
    );

    const isQueryAscii = /^[a-zA-Z0-9\s':\-!]+$/.test(cleanQuery);
    for (const item of items) {
      if (isQueryAscii && cleanQuery.length > 2) {
        const normItemOrig = (item.originalTitle || '').toLowerCase();
        if (!normItemOrig.includes(cleanQuery.toLowerCase())) {
          item.originalTitle = item.originalTitle ? `${item.originalTitle} / ${cleanQuery}` : cleanQuery;
        }
      }
      insertOrUpdateAnime(item);
    }

    console.log(`[Search Shikimori] Successfully saved ${items.length} titles into database.`);
    return items.length;
  } catch (err) {
    console.error(`[Search Shikimori] Error searching "${cleanQuery}":`, err.message);
    return 0;
  }
}

// Cache for live ongoing anime
let ongoingCache = {
  items: [],
  timestamp: 0
};

// Fetch 15 current ongoing anime airing right now from AnimeGO
async function fetchOngoingAnime(limit = 15) {
  const now = Date.now();
  // Return cached if fresh (under 20 minutes) and has items
  if (ongoingCache.items.length > 0 && (now - ongoingCache.timestamp) < 20 * 60 * 1000) {
    return ongoingCache.items.slice(0, limit);
  }

  const url = 'https://animego.me/anime/status/ongoing';
  console.log(`[Ongoing Scraper] Live fetching current ongoings from ${url}...`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const html = await res.text();
    const items = [];
    const parts = html.split('class="ani-list__item d-flex g-col-12"');

    for (let i = 1; i < parts.length && items.length < limit; i++) {
      const chunk = parts[i];
      const linkMatch = chunk.match(/href="\/anime\/([a-zA-Z0-9\-]+)"/);
      const slug = linkMatch ? linkMatch[1] : null;

      const imgMatch = chunk.match(/src="(https:\/\/[^"]+)"[^>]*alt="([^"]*)"/);
      const image = imgMatch ? imgMatch[1] : '';
      const title = imgMatch ? imgMatch[2] : '';

      const origMatch = chunk.match(/<div class="fw-lighter small mb-2 text-line-clamp"[^>]*>\s*(.*?)\s*<\/div>/);
      const originalTitle = origMatch ? origMatch[1].replace(/#\s*/, '').trim() : '';

      const genreMatches = [...chunk.matchAll(/href="\/anime\/(genre|type|season)\/([^"]+)"[^>]*>([^<]+)<\/a>/g)];
      const genres = [];
      let type = 'Сериал';
      let year = '2026';

      for (const gm of genreMatches) {
        const kind = gm[1];
        const valName = gm[3].trim();
        if (kind === 'genre') {
          if (!genres.includes(valName)) genres.push(valName);
        } else if (kind === 'type') {
          type = valName;
        } else if (kind === 'season') {
          year = valName;
        }
      }

      const descMatch = chunk.match(/<div class="ani-list__item-description[^>]*>\s*([\s\S]*?)\s*<\/div>/);
      const description = descMatch
        ? descMatch[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#039;/g, "'")
            .replace(/<[^>]+>/g, '')
            .trim()
        : '';

      // Skip invalid, future unreleased announcements (e.g. 2027, 2028), or placeholder 404 posters
      const parsedYear = parseInt(year, 10);
      const isFuture = !isNaN(parsedYear) && parsedYear > 2026;
      const isBadImage = image.includes('404') || image.includes('placeholder') || image.includes('no-image');

      if (title && slug && image && !isBadImage && !isFuture) {
        const itemObj = {
          slug,
          title,
          originalTitle,
          image,
          type,
          year,
          genres,
          description
        };
        items.push(itemObj);
        insertOrUpdateAnime(itemObj);
      }
    }

    if (items.length > 0) {
      ongoingCache = {
        items,
        timestamp: now
      };
      console.log(`[Ongoing Scraper] Successfully refreshed ${items.length} live ongoings.`);
      return items;
    }
  } catch (err) {
    console.error('[Ongoing Scraper] Error refreshing ongoings:', err.message);
  }

  // Fallback to cache if available
  if (ongoingCache.items.length > 0) {
    return ongoingCache.items.slice(0, limit);
  }

  // Fallback to database: current year titles without 404 images
  const fallbackRows = db.prepare(`
    SELECT slug, title, original_title, image_url as image, type, year, genres, description
    FROM anime
    WHERE year IN ('2026', '2025')
      AND image_url NOT LIKE '%404%'
      AND image_url != ''
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);

  return fallbackRows.map(r => ({
    ...r,
    originalTitle: r.original_title,
    genres: JSON.parse(r.genres || '[]')
  }));
}

// Seed initial pages if database has few titles
async function seedInitialData() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM anime').get();
  if (countRow.count < 80) {
    console.log('[AnimeGO Seeder] Syncing rich initial catalog (pages 1 to 5)...');
    try {
      await syncFromAnimeGo([1, 2, 3, 4, 5]);
    } catch (e) {
      console.error('[AnimeGO Seeder] Initial sync error:', e.message);
    }
  }
}

module.exports = {
  scrapeAnimeGoPage,
  syncFromAnimeGo,
  fetchNextAnimeGoPage,
  fetchOngoingAnime,
  searchAnimeGo,
  searchShikimori,
  seedInitialData
};
