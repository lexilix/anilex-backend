import { apiUrl } from '../api';
import { getCachedUserRatings, updateCachedUserRating } from './profileCache';

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
 * Parses AnimeLib raw HTML or JSON or text lines
 */
export function parseAnimeLibContent(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  const allItems = [];

  // 1. Check if raw JSON
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.items || []);
      for (const it of list) {
        const title = it.rus_name || it.name || it.title || '';
        const score = typeof it.user_rate === 'number' ? it.user_rate : (typeof it.score === 'number' ? it.score : 0);
        if (title) {
          allItems.push({
            slug: it.slug || title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
            title,
            originalTitle: it.eng_name || it.original_title || '',
            score: Math.min(10, Math.max(0, Math.round(score))),
            image: it.cover?.default || it.image || null,
            type: it.type || 'Сериал'
          });
        }
      }
      if (allItems.length > 0) return allItems;
    } catch {
      // Not pure JSON, continue to HTML/regex
    }
  }

  // 2. Parse Next.js __NEXT_DATA__ embedded JSON
  const nextDataMatch = text.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextJson = JSON.parse(nextDataMatch[1]);
      const pageProps = nextJson?.props?.pageProps || {};
      const bookmarks = pageProps.bookmarks || pageProps.items || pageProps.userBookmarks || [];
      if (Array.isArray(bookmarks) && bookmarks.length > 0) {
        for (const it of bookmarks) {
          const anime = it.anime || it.media || it.item || it;
          const title = anime.rus_name || anime.name || anime.title;
          const score = it.rate || it.user_rate || it.score || 0;
          if (title) {
            allItems.push({
              slug: anime.slug || title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
              title,
              originalTitle: anime.eng_name || '',
              score: Math.min(10, Math.max(0, Math.round(Number(score)))),
              image: anime.cover?.default || null,
              type: 'Сериал'
            });
          }
        }
        if (allItems.length > 0) return allItems;
      }
    } catch {
      // Continue
    }
  }

  // 3. Fallback regex for HTML cards
  const cardMatches = text.matchAll(/(?:class="[^"]*media-card[^"]*"|class="[^"]*item[^"]*")[\s\S]*?(?:href="\/ru\/anime\/([a-zA-Z0-9_-]+)"|href="\/([a-zA-Z0-9_-]+)")[\s\S]*?(?:<h3|<div class="[^"]*title[^"]*")>([^<]+)<[\s\S]*?(?:data-score="(\d+)"|(\d+)\s*\/\s*10)?/gi);
  for (const cm of cardMatches) {
    const slug = cm[1] || cm[2];
    const title = (cm[3] || '').trim();
    const score = cm[4] || cm[5] ? parseInt(cm[4] || cm[5], 10) : 0;
    if (title && !allItems.some((x) => x.title.toLowerCase() === title.toLowerCase())) {
      allItems.push({
        slug: slug || title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
        title,
        originalTitle: '',
        score: Math.min(10, Math.max(0, score)),
        image: null,
        type: 'Сериал'
      });
    }
  }

  // 4. Line-by-line fallback: "Наруто - 9" or "Атака титанов: 10"
  if (allItems.length === 0) {
    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const m = line.match(/^([^—–\-:]{2,100})\s*[—–\-:]\s*(\d{1,2})(?:\s*\/\s*10)?$/i);
      if (m) {
        const title = m[1].trim();
        const score = parseInt(m[2], 10);
        if (title && !allItems.some((x) => x.title.toLowerCase() === title.toLowerCase())) {
          allItems.push({
            slug: title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
            title,
            originalTitle: '',
            score: Math.min(10, Math.max(0, score)),
            image: null,
            type: 'Сериал'
          });
        }
      }
    }
  }

  return allItems;
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
    throw new Error(`Ошибка Shikimori API (код ${res.status}). Попробуйте позже.`);
  }

  const rates = await res.json();
  if (!Array.isArray(rates) || rates.length === 0) {
    throw new Error(`В профиле «${username}» на Shikimori нет оценённых или добавленных аниме.`);
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
 * 1. Calls backend /api/user/import
 * 2. If backend returns 404 or fails, applies resilient client fallbacks:
 *    - AnimeGO -> /api/user/import-animego
 *    - Shikimori -> direct client fetch from Shikimori API + save ratings
 *    - AnimeLib / Raw -> client parsing + save ratings
 */
export async function executeImportWorkflow({ platform, input, rawContent, token, userId }) {
  if (!token) throw new Error('Требуется авторизация в профиле');

  const cleanId = extractPlatformIdentifier(platform, input);
  const isRaw = platform === 'raw' || Boolean(rawContent && rawContent.trim());

  // Step 1: Try unified backend endpoint first
  try {
    const res = await fetch(apiUrl('/api/user/import'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        platform: isRaw ? 'raw' : platform,
        input: cleanId || input.trim(),
        rawContent: (rawContent || '').trim()
      })
    });

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (res.ok && data?.result) {
      return data.result;
    }

    // If backend gave a clear user-facing error (like 400 with message), throw it
    if (res.status === 400 && data?.error) {
      throw new Error(data.error);
    }

    // If backend returned 404 HTML, proceed to fallbacks below
  } catch (err) {
    if (err.message && !err.message.includes('Unexpected token') && !err.message.includes('<!DOCTYPE')) {
      // If it's a genuine logical error (e.g. user not found), don't silently ignore
      if (err.message.includes('не найден') || err.message.includes('Укажите')) {
        throw err;
      }
    }
  }

  // Step 2: Fallbacks for when backend /api/user/import is not deployed yet on Render
  if (platform === 'animego') {
    // Call legacy /api/user/import-animego which IS deployed on Render
    const res = await fetch(apiUrl('/api/user/import-animego'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        animegoUrlOrId: cleanId || input.trim(),
        rawHtml: (rawContent || '').trim()
      })
    });

    const resText = await res.text();
    let data = null;
    try {
      data = JSON.parse(resText);
    } catch {
      throw new Error('Сервер AnimeGO временно недоступен. Попробуйте повторить попытку через минуту.');
    }

    if (!res.ok) {
      throw new Error(data?.error || 'Ошибка при импорте с AnimeGO');
    }
    return data.result;
  }

  if (platform === 'shikimori') {
    // Shikimori API has open CORS! Fetch directly from browser
    const username = cleanId || input.trim();
    const items = await fetchShikimoriDirect(username);
    return await saveItemsDirectlyToCatalog(items, token, userId);
  }

  if (platform === 'animelib' || platform === 'raw') {
    let items = [];
    if (rawContent && rawContent.trim()) {
      items = parseAnimeLibContent(rawContent);
    }

    if (items.length === 0) {
      // If user provided a link to AnimeLib and no raw content
      throw new Error(
        'Сайт AnimeLib защищён проверкой DDoS-Guard и блокирует автоматические запросы по ссылке. ' +
        'Пожалуйста, откройте страницу ваших закладок AnimeLib, нажмите Ctrl+U (Исходный код страницы), скопируйте его и вставьте во вкладку «Вставить код страницы / текст» — все оценки перенесутся моментально!'
      );
    }

    return await saveItemsDirectlyToCatalog(items, token, userId);
  }

  throw new Error('Не удалось выполнить импорт. Пожалуйста, проверьте введённые данные.');
}

/**
 * Saves an array of parsed anime rating items to user's profile
 */
async function saveItemsDirectlyToCatalog(items, token, userId) {
  if (!items || items.length === 0) {
    throw new Error('Не найдено ни одного тайтла для импорта');
  }

  // Load catalog to match titles
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
    // Find matching anime in catalog by title or originalTitle
    const matched = catalog.find((c) => {
      if (c.title && item.title && c.title.trim().toLowerCase() === item.title.trim().toLowerCase()) return true;
      if (c.originalTitle && item.originalTitle && c.originalTitle.trim().toLowerCase() === item.originalTitle.trim().toLowerCase()) return true;
      return false;
    });

    if (!matched) continue;

    // Preserve existing rating
    if (existingMap.has(matched.id) && existingMap.get(matched.id) !== null) {
      alreadyRatedCount++;
      continue;
    }

    const scoreToSet = typeof item.score === 'number' ? Math.min(10, Math.max(0, item.score)) : 0;
    if (scoreToSet === 0) {
      zeroRatedCount++;
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
      updateCachedUserRating(userId, matched.id, scoreToSet);
      newlyRatedCount++;
    } catch {
      // Ignore individual item rate errors
    }
  }

  return {
    total: items.length,
    newlyRatedCount,
    alreadyRatedCount,
    zeroRatedCount
  };
}
