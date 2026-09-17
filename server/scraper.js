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

// Helper to detect season, part, movie, or special indicators
function getSeasonFeatures(title, origTitle, type) {
  const combined = `${title || ''} ${origTitle || ''}`.toLowerCase();
  const isSeason2 = /2-й сезон|\b2\b|\bii\b|сезон 2|season 2|part 2|часть 2/i.test(combined);
  const isSeason3 = /3-й сезон|\b3\b|\biii\b|сезон 3|season 3|part 3|часть 3/i.test(combined);
  const isSeason4 = /4-й сезон|\b4\b|\biv\b|сезон 4|season 4|part 4|часть 4|финал|final/i.test(combined);
  const isMovie = /фильм|movie/i.test(combined) || type === 'Фильм';
  const isOVA = /ova|ona|спешл|special|клип|music/i.test(combined) || ['OVA', 'ONA', 'Спешл', 'Клип'].includes(type);
  return { isSeason2, isSeason3, isSeason4, isMovie, isOVA };
}

// Strict check whether two anime items represent the EXACT SAME release (and not a prequel/sequel)
function isSameAnime(existing, item) {
  const normTitle = (item.title || '').toLowerCase().trim();
  const normOrig = (item.originalTitle || '').toLowerCase().trim();
  const exTitle = (existing.title || '').toLowerCase().trim();
  const exOrig = (existing.original_title || '').toLowerCase().trim();

  // If season or media type indicators differ, they are distinct titles (e.g. Season 1 vs Season 2)
  const featItem = getSeasonFeatures(item.title, item.originalTitle, item.type);
  const featEx = getSeasonFeatures(existing.title, existing.original_title, existing.type);

  if (featItem.isSeason2 !== featEx.isSeason2) return false;
  if (featItem.isSeason3 !== featEx.isSeason3) return false;
  if (featItem.isSeason4 !== featEx.isSeason4) return false;
  if (featItem.isMovie !== featEx.isMovie) return false;
  if (featItem.isOVA !== featEx.isOVA) return false;

  // If both have 4-digit release years, ensure years are close (within 1 year)
  if (item.year && existing.year && /^\d{4}$/.test(item.year) && /^\d{4}$/.test(existing.year)) {
    const diff = Math.abs(parseInt(item.year, 10) - parseInt(existing.year, 10));
    if (diff > 1) return false;
  }

  // 1. Exact Russian title match
  if (normTitle && normTitle === exTitle) return true;

  // 2. Exact original title match
  if (normOrig && normOrig === exOrig) return true;

  // 3. Match against slash-separated alternate titles (e.g. "Spy x Family / SPY×FAMILY")
  if (normOrig && exOrig.includes('/')) {
    const parts = exOrig.split('/').map(p => p.trim().toLowerCase());
    if (parts.includes(normOrig)) return true;
  }
  if (exOrig && normOrig.includes('/')) {
    const parts = normOrig.split('/').map(p => p.trim().toLowerCase());
    if (parts.includes(exOrig)) return true;
  }

  // 4. Poster image URL match (non-placeholder)
  if (item.image && existing.image_url && item.image === existing.image_url && !item.image.includes('placeholder')) {
    return true;
  }

  // 5. Number-word normalized wordset match (e.g. "999 уровня" vs "девятьсот девяносто девятого уровня")
  if (typeof db.getWordKey === 'function') {
    const wKeyItem = db.getWordKey(normTitle);
    const wKeyEx = db.getWordKey(exTitle);
    if (wKeyItem && wKeyItem.length >= 8 && wKeyItem === wKeyEx) {
      return true;
    }
  }

  return false;
}

// Save anime items safely into database (with strict deduplication)
function insertOrUpdateAnime(item) {
  if (!item || !item.title) return;

  const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
  const cleanTitle = item.title.trim();
  const cleanOriginal = (item.originalTitle || '').trim();
  const normTitle = normalize(cleanTitle);
  const normOriginal = normalize(cleanOriginal);

  if (!item.slug) {
    item.slug = 'anime-' + normTitle.replace(/[^a-zа-я0-9]+/gi, '-') + '-' + Math.floor(Math.random() * 100000);
  }
  if (!item.image) {
    item.image = 'https://placehold.co/300x450/1e293b/ffffff?text=' + encodeURIComponent(cleanTitle.slice(0, 30));
  }

  // 1. Check if an anime with this exact slug exists
  let existing = db.prepare('SELECT id, slug, title, original_title, image_url, type, year, genres, description FROM anime WHERE slug = ?').get(item.slug);

  // 2. Find potential candidate rows in DB
  if (!existing) {
    const candidates = db.prepare(`
      SELECT id, slug, title, original_title, image_url, type, year, genres, description
      FROM anime
      WHERE title_lower = ?
         OR (original_title_lower IS NOT NULL AND (
             original_title_lower = ?
             OR original_title_lower LIKE ?
             OR original_title_lower LIKE ?
             OR original_title_lower LIKE ?
         ))
         OR (image_url IS NOT NULL AND image_url = ?)
    `).all(
      normTitle,
      normOriginal,
      `${normOriginal} / %`,
      `% / ${normOriginal} / %`,
      `% / ${normOriginal}`,
      item.image
    );

    for (const cand of candidates) {
      if (isSameAnime(cand, item)) {
        existing = cand;
        break;
      }
    }
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
      image_url = (CASE WHEN excluded.image_url NOT LIKE '%missing%' AND excluded.image_url NOT LIKE '%placehold%' THEN excluded.image_url ELSE anime.image_url END),
      type = excluded.type,
      year = (CASE WHEN excluded.year IS NOT NULL AND excluded.year != '' THEN excluded.year ELSE anime.year END),
      genres = (CASE WHEN excluded.genres IS NOT NULL AND excluded.genres != '[]' AND excluded.genres != '' THEN excluded.genres ELSE anime.genres END),
      description = (CASE WHEN excluded.description IS NOT NULL AND LENGTH(excluded.description) > 20 THEN excluded.description ELSE anime.description END),
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

            // Also check related anime for prequels / first parts
            try {
              const relRes = await fetch(`https://shikimori.one/api/animes/${detailId}/related`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              if (relRes.ok) {
                const relData = await relRes.json();
                if (Array.isArray(relData)) {
                    if (r.anime && r.anime.kind !== 'cm' && (r.relation_russian === 'Предыстория' || r.relation === 'prequel' || r.relation_russian === 'Основная история' || r.relation_russian === 'Продолжение' || r.relation === 'sequel')) {
                      const relA = r.anime;
                      const relSlug = `shiki-${relA.id}`;
                      const relTitle = relA.russian || relA.name;
                      const relImg = relA.image?.original ? (relA.image.original.startsWith('http') ? relA.image.original : `https://shikimori.one${relA.image.original}`) : '';
                      const isSnickers = (relTitle && /сникерс/i.test(relTitle)) || (relA.name && /snickers/i.test(relA.name));
                      if (relTitle && relSlug && relImg && !isSnickers && !items.some(it => it.slug === relSlug)) {
                        items.push({
                          slug: relSlug,
                          title: relTitle,
                          originalTitle: relA.name || '',
                          image: relImg,
                          type: typeMap[relA.kind] || 'Сериал',
                          year: relA.aired_on ? relA.aired_on.slice(0, 4) : '',
                          genres: [],
                          description: ''
                        });
                      }
                    }
                  }
                }
              }
            } catch (re) {
              // ignore related fetch error
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
  insertOrUpdateAnime,
  scrapeAnimeGoPage,
  syncFromAnimeGo,
  fetchNextAnimeGoPage,
  fetchOngoingAnime,
  searchAnimeGo,
  searchShikimori,
  seedInitialData
};
