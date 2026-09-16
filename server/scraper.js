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

// Save anime items safely into database
function insertOrUpdateAnime(item) {
  if (!item.title || !item.slug || !item.image) return;

  const stmt = db.prepare(`
    INSERT INTO anime (slug, title, original_title, image_url, type, year, genres, description, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      image_url = excluded.image_url,
      type = excluded.type,
      year = excluded.year,
      genres = excluded.genres,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    item.slug,
    item.title,
    item.originalTitle || '',
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

    for (const item of items) {
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

    // Fetch details for top 4 items to enrich description and genres
    await Promise.all(
      items.slice(0, 4).map(async (item) => {
        try {
          const detailId = item.slug.replace('shiki-', '');
          const dRes = await fetch(`https://shikimori.one/api/animes/${detailId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (dRes.ok) {
            const detailData = await dRes.json();
            if (detailData.description) {
              item.description = detailData.description.replace(/\[[^\]]+\]/g, '').trim();
            }
            if (Array.isArray(detailData.genres) && detailData.genres.length > 0) {
              item.genres = detailData.genres.map(g => g.russian || g.name);
            }
          }
        } catch (e) {
          // ignore detail fetch error
        }
      })
    );

    for (const item of items) {
      insertOrUpdateAnime(item);
    }

    console.log(`[Search Shikimori] Successfully saved ${items.length} titles into database.`);
    return items.length;
  } catch (err) {
    console.error(`[Search Shikimori] Error searching "${cleanQuery}":`, err.message);
    return 0;
  }
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
  searchAnimeGo,
  searchShikimori,
  seedInitialData
};
