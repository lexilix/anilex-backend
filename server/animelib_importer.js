const db = require('./db');

/**
 * Extracts userId or slug from AnimeLib URL
 */
function extractAnimeLibUser(input) {
  if (!input || typeof input !== 'string') return '';
  const clean = input.trim();
  const match = clean.match(/user\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  return clean.replace(/^@/, '').split('/')[0].split('?')[0].trim();
}

/**
 * Recursively extracts anime and rating info from any JSON structure
 */
function extractAnimeFromAnyObject(obj, items = [], visited = new Set()) {
  if (!obj || typeof obj !== 'object') return items;
  if (visited.has(obj)) return items;
  visited.add(obj);

  if (Array.isArray(obj)) {
    for (const el of obj) extractAnimeFromAnyObject(el, items, visited);
    return items;
  }

  const animeObj = obj.anime || obj.media || obj.item || obj.title_info || obj;
  const rusName = animeObj.rus_name || animeObj.russian || animeObj.title || animeObj.name || obj.rus_name || obj.title || obj.name;
  const engName = animeObj.eng_name || animeObj.original_title || animeObj.romanji || obj.eng_name;

  const rawScore = obj.user_rate ?? obj.rate ?? obj.score ?? obj.user_rating ?? obj.rating ?? obj.my_score ?? animeObj.user_rate ?? animeObj.score;
  const hasScore = rawScore !== undefined && rawScore !== null && !isNaN(Number(rawScore));
  const scoreNum = hasScore ? Math.min(10, Math.max(0, Math.round(Number(rawScore)))) : 0;

  const titleStr = typeof rusName === 'string' ? rusName.trim() : '';
  const isExcluded = ['пользователь', 'профиль', 'закладки', 'главная', 'каталог', 'anime', 'manga'].includes(titleStr.toLowerCase());

  if (titleStr.length >= 2 && !isExcluded && (hasScore || obj.anime || obj.media || animeObj.slug || obj.slug)) {
    items.push({
      slug: (animeObj.slug || obj.slug || titleStr).toString().trim(),
      title: titleStr,
      originalTitle: typeof engName === 'string' ? engName.trim() : '',
      score: scoreNum,
      image: animeObj.cover?.default || animeObj.cover?.thumbnail || animeObj.image || null,
      type: 'Сериал'
    });
  }

  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      extractAnimeFromAnyObject(obj[k], items, visited);
    }
  }
  return items;
}

/**
 * Parses AnimeLib raw HTML or JSON text or plain text
 */
function parseAnimeLibContent(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  const rawItems = [];

  // 1. Direct JSON
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      extractAnimeFromAnyObject(parsed, rawItems);
    } catch (e) {}
  }

  // 2. Embedded Next.js or JSON scripts in HTML
  const scriptMatches = text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const sm of scriptMatches) {
    const scriptContent = (sm[1] || '').trim();
    if (scriptContent.startsWith('{') || scriptContent.startsWith('[')) {
      try {
        const parsed = JSON.parse(scriptContent);
        extractAnimeFromAnyObject(parsed, rawItems);
      } catch (e) {}
    }
  }

  // 3. Regular expression HTML scraping for media links and cards
  const linkRegex = /<a[^>]+href=["']([^"']*(?:\/anime\/|\/media\/|\/title\/)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lm;
  while ((lm = linkRegex.exec(text)) !== null) {
    const href = lm[1];
    const innerHtml = lm[2].replace(/<[^>]+>/g, '').trim();
    if (innerHtml.length >= 2) {
      // Find nearby rating within surrounding text
      const startPos = Math.max(0, lm.index - 100);
      const endPos = Math.min(text.length, lm.index + lm[0].length + 150);
      const window = text.slice(startPos, endPos);
      let score = 0;
      const scoreMatch = window.match(/(?:data-score|data-rating|data-rate|score|rate|рейтинг|оценка)[^0-9]{0,15}(\d{1,2})/i) ||
                         window.match(/(\d{1,2})\s*\/\s*10/i) ||
                         window.match(/★\s*(\d{1,2})/i);
      if (scoreMatch) {
        const val = parseInt(scoreMatch[1], 10);
        if (val >= 1 && val <= 10) score = val;
      }

      rawItems.push({
        slug: href.split('/').pop(),
        title: innerHtml,
        originalTitle: '',
        score,
        image: null,
        type: 'Сериал'
      });
    }
  }

  // 4. Catalog database matching (cross-referencing with local database titles)
  try {
    const catalog = db.prepare('SELECT id, title, original_title FROM anime').all();
    if (Array.isArray(catalog) && catalog.length > 0) {
      for (const c of catalog) {
        if (!c.title || c.title.length < 2) continue;
        const titleEscaped = c.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(?:^|[^а-яА-Яa-zA-Z0-9])' + titleEscaped + '(?:$|[^а-яА-Яa-zA-Z0-9])', 'i');
        const idx = text.search(re);
        if (idx !== -1) {
          const after = text.slice(idx + c.title.length, Math.min(text.length, idx + c.title.length + 100));
          const before = text.slice(Math.max(0, idx - 100), idx);
          let score = 0;
          const patterns = [
            /(?:оценка|рейтинг|rate|score|user-score|data-rate|data-rating|data-score)[^0-9]{0,15}(\d{1,2})/i,
            /(\d{1,2})\s*\/\s*10/i,
            /★\s*(\d{1,2})/i,
            /(?:\r?\n|^)\s*(\d{1,2})\s*(?:\r?\n|$)/,
            /[-—–:\s]+(\d{1,2})\b/
          ];

          for (const p of patterns) {
            const m = after.match(p);
            if (m) {
              const val = parseInt(m[1], 10);
              if (val >= 1 && val <= 10) { score = val; break; }
            }
          }
          if (!score) {
            for (const p of patterns) {
              const m = before.match(p);
              if (m) {
                const val = parseInt(m[1], 10);
                if (val >= 1 && val <= 10) { score = val; break; }
              }
            }
          }

          rawItems.push({
            slug: `anime-${c.id}`,
            title: c.title,
            originalTitle: c.original_title || '',
            score,
            image: null,
            type: 'Сериал'
          });
        }
      }
    }
  } catch (err) {
    // If DB query fails, continue with items found so far
  }

  // 5. Line-based text fallback (e.g. "Магическая битва - 10" or "Шаман Кинг 9/10")
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    const lineMatch = trimmed.match(/^([a-zA-Zа-яА-Я0-9\s:!—–,.'«»]+?)(?:\s*[-—–:]\s*|\s*\(?\s*)(\d{1,2})(?:\s*\/\s*10)?\s*\)?$/);
    if (lineMatch) {
      const title = lineMatch[1].trim();
      const score = parseInt(lineMatch[2], 10);
      if (title.length > 1 && score >= 0 && score <= 10) {
        rawItems.push({
          slug: title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
          title,
          originalTitle: '',
          score,
          image: null,
          type: 'Сериал'
        });
      }
    }
  }

  // 6. Deduplicate by title, preserving highest non-zero score
  const itemMap = new Map();
  for (const it of rawItems) {
    if (!it.title || it.title.length < 2) continue;
    const key = it.title.trim().toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
    if (!itemMap.has(key)) {
      itemMap.set(key, it);
    } else {
      const existing = itemMap.get(key);
      if (it.score > existing.score) {
        itemMap.set(key, it);
      }
    }
  }

  return Array.from(itemMap.values());
}

/**
 * Attempts to scrape from AnimeLib public profile if accessible
 */
async function scrapeAnimeLibUserList(inputUrlOrUser) {
  const user = extractAnimeLibUser(inputUrlOrUser);
  if (!user) {
    throw new Error('Укажите никнейм, ID или ссылку на профиль AnimeLib (например, https://v5.animelib.org/ru/user/12345)');
  }

  const urlsToTry = [
    `https://v5.animelib.org/ru/user/${encodeURIComponent(user)}`,
    `https://animelib.me/ru/user/${encodeURIComponent(user)}`
  ];

  for (const url of urlsToTry) {
    try {
      console.log('[AnimeLib Importer] Attempting to fetch:', url);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://v5.animelib.org/'
        }
      });

      if (res.ok) {
        const html = await res.text();
        const items = parseAnimeLibContent(html);
        if (items.length > 0) {
          console.log(`[AnimeLib Importer] Successfully parsed ${items.length} items from URL`);
          return items;
        }
      }
    } catch (err) {
      console.warn('[AnimeLib Importer] Request failed for', url, err.message);
    }
  }

  throw new Error(
    'AnimeLib защищён Cloudflare и не отдаёт профиль напрямую серверу. Пожалуйста, откройте страницу вашего списка на AnimeLib, скопируйте HTML или текст страницы (Ctrl+A, Ctrl+C) и вставьте в поле ниже!'
  );
}

module.exports = {
  extractAnimeLibUser,
  parseAnimeLibContent,
  scrapeAnimeLibUserList
};
