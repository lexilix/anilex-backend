import { apiUrl } from '../api';
import { getCachedUserRatings, updateCachedUserRating } from './profileCache';
import { appendCachedAnimeItem } from './catalogCache';

function getStoredCatalog() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('anilex_catalog_cache_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            return data.items;
          }
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Clean username/ID from various URL formats
 */
export function extractPlatformIdentifier(platform, input) {
  if (!input || typeof input !== 'string') return '';
  let clean = input.trim();

  if (platform === 'shikimori') {
    const m = clean.match(/shikimori\.(?:one|io|me)\/(?:users\/)?([a-zA-Z0-9_-]+)/i);
    if (m) return m[1];
    return clean.replace(/^@/, '').split('/')[0].split('?')[0].trim();
  }

  if (platform === 'animelib') {
    const m = clean.match(/user\/([0-9a-zA-Z_-]+)/i);
    if (m) return m[1];
    return clean.replace(/^@/, '').split('/')[0].split('?')[0].trim();
  }

  if (platform === 'animego') {
    const m = clean.match(/\/user\/([0-9]+)/);
    if (m) return m[1];
    return clean.replace(/[^0-9]/g, '');
  }

  return clean;
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
export function parseAnimeLibContent(rawText, catalog = []) {
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

  // 4. Catalog cross-referencing (scans for all catalog titles appearing in text)
  const catList = (Array.isArray(catalog) && catalog.length > 0) ? catalog : getStoredCatalog();
  if (Array.isArray(catList) && catList.length > 0) {
    for (const c of catList) {
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
          originalTitle: c.originalTitle || '',
          score,
          image: null,
          type: 'Сериал'
        });
      }
    }
  }

  // 5. Line-based text fallback (e.g. "Магическая битва - 10" or "Шаман Кинг 9/10")
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.length < 3) continue;
    const m = line.match(/^([a-zA-Zа-яА-Я0-9\s:!—–,.'«»]+?)(?:\s*[-—–:]\s*|\s*\(?\s*)(\d{1,2})(?:\s*\/\s*10)?\s*\)?$/);
    if (m) {
      const title = m[1].trim();
      const score = parseInt(m[2], 10);
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

  // 6. Multi-line block parser for copied profile text (e.g. Title \n Title \n Продлить \n 8/10)
  const blockItems = parseCopiedProfileBlocks(text);
  for (const bi of blockItems) {
    rawItems.push({
      slug: 'imported-' + bi.title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-') + '-' + Math.floor(Math.random() * 10000),
      title: bi.title,
      originalTitle: '',
      score: bi.score,
      image: null,
      type: 'Сериал'
    });
  }

  // 7. Deduplicate by normalized title, preserving highest non-zero score
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
 * Parses multi-line blocks of text copied from anime website profiles
 */
export function parseCopiedProfileBlocks(text) {
  const UI_WORDS = new Set([
    'продлить', 'просмотрено', 'смотрю', 'в планах', 'брошено', 'пересматриваю', 'отложено',
    'любимое', 'закладки', 'профиль', 'пользователь', 'оценки', 'список', 'комментарии',
    'друзья', 'статистика', 'главная', 'каталог', 'все', 'фильм', 'сериал', 'ova', 'ona'
  ]);

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    if (UI_WORDS.has(lineLower) || /^\d{1,2}(?:\s*\/\s*10)?$/.test(line)) continue;
    if (line.length < 2) continue;

    const singleMatch = line.match(/^([^—–\-:]{2,100})\s*[-—–:]\s*(\d{1,2})(?:\s*\/\s*10)?$/i);
    if (singleMatch) {
      const title = singleMatch[1].trim();
      const score = parseInt(singleMatch[2], 10);
      if (title.length >= 2 && !UI_WORDS.has(title.toLowerCase())) {
        items.push({ title, score: Math.min(10, Math.max(0, score)) });
        continue;
      }
    }

    const candidateTitle = line;
    if (UI_WORDS.has(candidateTitle.toLowerCase())) continue;

    let score = 0;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 5); j++) {
      const nextLine = lines[j];
      const scoreMatch = nextLine.match(/(?:^|\s)(\d{1,2})\s*\/\s*10(?:\s|$)/) ||
                         nextLine.match(/(?:оценка|рейтинг|score|rate)[:\s]*(\d{1,2})/i) ||
                         nextLine.match(/^★?\s*(\d{1,2})$/);
      if (scoreMatch) {
        const val = parseInt(scoreMatch[1], 10);
        if (val >= 1 && val <= 10) {
          score = val;
          break;
        }
      }
      if (nextLine.length > 3 && !UI_WORDS.has(nextLine.toLowerCase()) && !/^\d/.test(nextLine)) {
        if (nextLine.toLowerCase() === candidateTitle.toLowerCase()) continue;
        break;
      }
    }

    items.push({ title: candidateTitle, score });
  }

  const map = new Map();
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
    if (!key || key.length < 2) continue;
    if (!map.has(key)) {
      map.set(key, it);
    } else {
      const prev = map.get(key);
      if (it.score > prev.score) {
        map.set(key, it);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Parses AnimeGO HTML string
 */
export function parseAnimeGoHtml(html) {
  if (!html || typeof html !== 'string') return [];
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
 * Fetches user rates directly from Shikimori public API (supports CORS)
 */
export async function fetchShikimoriDirect(username) {
  const cleanUsername = encodeURIComponent(username.trim());
  const res = await fetch(`https://shikimori.io/api/users/${cleanUsername}/anime_rates?limit=5000`, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Пользователь «${username}» не найден на Shikimori. Проверьте правильность никнейма.`);
    }
    throw new Error(`Ошибка подключения к Shikimori (код ${res.status}). Попробуйте позже.`);
  }

  const rates = await res.json();
  if (!Array.isArray(rates) || rates.length === 0) {
    throw new Error(`В профиле «${username}» на Shikimori нет оценённых аниме.`);
  }

  return rates.map((r) => {
    const anime = r.anime || {};
    return {
      slug: `shiki-${anime.id}`,
      title: anime.russian || anime.name,
      originalTitle: anime.name || '',
      score: typeof r.score === 'number' ? r.score : 0,
      image: anime.image?.original ? `https://shikimori.io${anime.image.original}` : null,
      type: anime.kind === 'movie' ? 'Фильм' : 'Сериал',
      year: anime.aired_on ? anime.aired_on.split('-')[0] : null
    };
  });
}

/**
 * Universal safe import runner:
 * Analyzes the profile and safely transfers ratings to the user's profile.
 */
export async function executeImportWorkflow({ platform, input, rawContent, token, userId }) {
  if (!token) throw new Error('Требуется авторизация в профиле');

  const isLikelyUrl = /^(https?:\/\/|[a-z0-9.-]+\/(?:user|users|profile)\/)/i.test((input || '').trim());
  const hasMultipleLinesOrMarkup = (input || '').length > 80 || (input || '').includes('\n') || (input || '').includes('<') || (input || '').includes('{"') || ((input || '').includes('/') && (input || '').includes(':'));

  const combinedContent = (rawContent || '').trim() || ((input && (!isLikelyUrl || hasMultipleLinesOrMarkup)) ? input.trim() : '');
  let resolvedPlatform = platform;

  // Auto-detect platform from URL or content
  const targetStr = (input || '') + ' ' + (rawContent || '');
  if (targetStr.includes('animelib.org') || targetStr.includes('anilib')) {
    resolvedPlatform = 'animelib';
  } else if (targetStr.includes('shikimori.one') || targetStr.includes('shikimori.io') || targetStr.includes('shikimori.me')) {
    resolvedPlatform = 'shikimori';
  } else if (targetStr.includes('animego.me')) {
    resolvedPlatform = 'animego';
  }

  const cleanId = extractPlatformIdentifier(resolvedPlatform, input);

  // 1. If user provided raw code / HTML / text
  if (combinedContent) {
    let items = [];
    if (resolvedPlatform === 'animego') {
      items = parseAnimeGoHtml(combinedContent);
    }
    if (!items || items.length === 0) {
      items = parseAnimeLibContent(combinedContent);
    }
    if (!items || items.length === 0) {
      items = parseAnimeGoHtml(combinedContent);
    }

    if (items && items.length > 0) {
      return await saveItemsDirectlyToCatalog(items, token, userId);
    }
  }

  // 2. Shikimori Direct API (CORS enabled)
  if (resolvedPlatform === 'shikimori') {
    const username = cleanId || input.trim();
    if (!username) throw new Error('Укажите никнейм или ссылку на профиль Shikimori');
    const items = await fetchShikimoriDirect(username);
    return await saveItemsDirectlyToCatalog(items, token, userId);
  }

  // 3. AnimeGO via link
  if (resolvedPlatform === 'animego') {
    try {
      const res = await fetch(apiUrl('/api/user/import-animego'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          animegoUrlOrId: cleanId || input.trim(),
          rawHtml: combinedContent
        })
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}

      if (res.ok && data?.result) {
        if (Array.isArray(data.result.importedAnime)) {
          for (const it of data.result.importedAnime) {
            updateCachedUserRating(userId, it.id, it.score, it);
            appendCachedAnimeItem(it);
          }
        }
        return data.result;
      }
      if (data?.error) throw new Error(data.error);
    } catch (err) {
      if (err.message && !err.message.includes('<!DOCTYPE') && !err.message.includes('JSON')) {
        throw err;
      }
    }
  }

  // 4. Try backend /api/user/import
  try {
    const res = await fetch(apiUrl('/api/user/import'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        platform: resolvedPlatform,
        input: cleanId || input.trim(),
        rawContent: combinedContent
      })
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    if (res.ok && data?.result) {
      if (Array.isArray(data.result.importedAnime)) {
        for (const it of data.result.importedAnime) {
          updateCachedUserRating(userId, it.id, it.score, it);
          appendCachedAnimeItem(it);
        }
      }
      return data.result;
    }
    if (res.status === 400 && data?.error) throw new Error(data.error);
  } catch (err) {
    if (err.message && !err.message.includes('<!DOCTYPE') && !err.message.includes('JSON')) {
      if (err.message.includes('не найден') || err.message.includes('Укажите')) {
        throw err;
      }
    }
  }

  // 5. AnimeLib specific link guidance if direct fetch was blocked by DDoS-Guard
  if (resolvedPlatform === 'animelib') {
    throw new Error(
      'Сайт AnimeLib защищён проверкой браузера от автоматических запросов. ' +
      'Пожалуйста, перейдите на открытую страницу профиля AnimeLib, нажмите Ctrl+U (Исходный код) или Ctrl+A (Выделить всё), скопируйте и вставьте в поле — все ваши оценки моментально определятся и перенесутся!'
    );
  }

  throw new Error('Не удалось найти оценки в указанном источнике. Попробуйте скопировать текст страницы профиля и вставить в поле.');
}

/**
 * Saves an array of parsed anime rating items to user's profile and catalog
 */
export async function saveItemsDirectlyToCatalog(items, token, userId) {
  if (!items || items.length === 0) {
    throw new Error('Не найдено ни одного тайтла для импорта');
  }

  // 1. Send items to the server import-items endpoint (creates missing anime in DB and rates them)
  try {
    const res = await fetch(apiUrl('/api/user/import-items'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ items })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.result) {
        if (Array.isArray(data.result.importedAnime)) {
          for (const it of data.result.importedAnime) {
            updateCachedUserRating(userId, it.id, it.score, it);
            appendCachedAnimeItem(it);
          }
        }
        return data.result;
      }
    }
  } catch (err) {
    console.warn('Direct server bulk import failed, falling back to per-item handling', err);
  }

  // 2. Client-side fallback: ensure ALL items are processed and added even if catalog lacked them
  let catalog = getStoredCatalog();
  if (!catalog || catalog.length === 0) {
    try {
      const res = await fetch(apiUrl('/api/anime?limit=4000'));
      if (res.ok) {
        const data = await res.json();
        catalog = data.items || [];
      }
    } catch {
      catalog = [];
    }
  }

  const existingRatings = getCachedUserRatings(userId) || [];
  const existingMap = new Map(existingRatings.map((r) => [r.id, r.myScore]));

  let newlyRatedCount = 0;
  let alreadyRatedCount = 0;
  let zeroRatedCount = 0;

  for (const item of items) {
    const scoreToSet = typeof item.score === 'number' ? Math.min(10, Math.max(0, item.score)) : 0;
    if (scoreToSet === 0) {
      zeroRatedCount++;
    }

    // Find matching anime in catalog by title or originalTitle
    const matched = catalog.find((c) => {
      if (c.title && item.title && c.title.trim().toLowerCase() === item.title.trim().toLowerCase()) return true;
      if (c.originalTitle && item.originalTitle && c.originalTitle.trim().toLowerCase() === item.originalTitle.trim().toLowerCase()) return true;
      return false;
    });

    if (matched) {
      // Preserve existing rating
      if (existingMap.has(matched.id) && existingMap.get(matched.id) !== null) {
        alreadyRatedCount++;
        continue;
      }

      try {
        await fetch(apiUrl(`/api/anime/${matched.id}/rate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ score: scoreToSet })
        });
      } catch {}

      updateCachedUserRating(userId, matched.id, scoreToSet, matched);
      newlyRatedCount++;
    } else {
      // Anime not in local catalog -> Create anime via API so it is added to the database and catalog!
      let createdId = null;

      try {
        const createRes = await fetch(apiUrl('/api/anime/create'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: item.title,
            originalTitle: item.originalTitle || '',
            image: item.image || '',
            score: scoreToSet,
            type: item.type || 'Сериал'
          })
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          if (createData.anime) {
            createdId = createData.anime.id;
          }
        }
      } catch {}

      const finalId = createdId || (Date.now() + Math.floor(Math.random() * 10000));
      const animeData = {
        id: finalId,
        title: item.title,
        originalTitle: item.originalTitle || '',
        imageUrl: item.image || 'https://placehold.co/300x450/1e293b/ffffff?text=' + encodeURIComponent(item.title.slice(0, 30)),
        type: item.type || 'Сериал',
        description: item.title,
        myScore: scoreToSet,
        averageScore: scoreToSet,
        ratingCount: 1
      };

      updateCachedUserRating(userId, finalId, scoreToSet, animeData);
      appendCachedAnimeItem(animeData);
      newlyRatedCount++;
    }
  }

  return {
    total: items.length,
    newlyRatedCount,
    alreadyRatedCount,
    zeroRatedCount
  };
}
