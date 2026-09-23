import { deduplicateAnimeList } from './animeDeduplicator';
import initialCatalog from '../data/initialCatalog.json';

/**
 * Client-side cache for anime catalog pages.
 * Supports instant loading from storage and change detection (image, description, count).
 */

const CACHE_KEY_PREFIX = 'anilex_catalog_cache_';
const PAGE_CACHE_PREFIX = 'anilex_page_cache_';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours TTL

export function getCachedCatalog(key) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    if (Date.now() - (data.timestamp || 0) > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${key}`);
      return null;
    }
    data.items = deduplicateAnimeList(data.items);
    return data;
  } catch (e) {
    return null;
  }
}

export function setCachedCatalog(key, payload) {
  try {
    const deduped = deduplicateAnimeList(payload.items || []);
    const cleanItems = deduped.map((it) => ({
      id: it.id,
      aliasIds: it.aliasIds || [it.id],
      title: it.title,
      originalTitle: it.originalTitle || it.original_title || '',
      imageUrl: it.imageUrl || it.image_url || '',
      type: it.type,
      year: it.year,
      genres: it.genres || [],
      description: it.description,
      myScore: it.myScore,
      averageScore: it.averageScore,
      ratingCount: it.ratingCount,
      isFavorite: it.isFavorite,
      isHidden: it.isHidden,
      commentsCount: it.commentsCount,
      season: it.season || '',
      linkedAnime: it.linkedAnime || []
    }));

    const cacheData = {
      timestamp: Date.now(),
      page: payload.page || 1,
      items: cleanItems.slice(0, 60),
      total: payload.total || 0,
      totalPages: payload.totalPages || 1,
      recommendationGenresCount: payload.recommendationGenresCount || 0
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(cacheData));
    invalidateAllCachedAnime();
  } catch (e) {
    // LocalStorage may be full or disabled, silently ignore
  }
}

/**
 * Retrieves a specific page from the per-page cache.
 */
export function getCachedPage(filterKey, page) {
  try {
    const raw = localStorage.getItem(`${PAGE_CACHE_PREFIX}${filterKey}_p${page}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    if (Date.now() - (data.timestamp || 0) > CACHE_TTL_MS) {
      localStorage.removeItem(`${PAGE_CACHE_PREFIX}${filterKey}_p${page}`);
      return null;
    }
    data.items = deduplicateAnimeList(data.items);
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Stores a specific page (15 items) into the per-page cache.
 */
export function setCachedPage(filterKey, page, payload) {
  try {
    const deduped = deduplicateAnimeList(payload.items || []);
    const cleanItems = deduped.map((it) => ({
      id: it.id,
      aliasIds: it.aliasIds || [it.id],
      title: it.title,
      originalTitle: it.originalTitle || it.original_title || '',
      imageUrl: it.imageUrl || it.image_url || '',
      type: it.type,
      year: it.year,
      genres: it.genres || [],
      description: it.description,
      myScore: it.myScore,
      averageScore: it.averageScore,
      ratingCount: it.ratingCount,
      isFavorite: it.isFavorite,
      isHidden: it.isHidden,
      commentsCount: it.commentsCount,
      season: it.season || '',
      linkedAnime: it.linkedAnime || []
    }));

    const cacheData = {
      timestamp: Date.now(),
      page: Number(page) || 1,
      items: cleanItems,
      total: payload.total || 0,
      totalPages: payload.totalPages || 1,
      recommendationGenresCount: payload.recommendationGenresCount || 0
    };
    localStorage.setItem(`${PAGE_CACHE_PREFIX}${filterKey}_p${page}`, JSON.stringify(cacheData));
    invalidateAllCachedAnime();
  } catch (e) {
    // Silently ignore storage quota
  }
}

let memoizedAllAnime = null;

export function invalidateAllCachedAnime() {
  memoizedAllAnime = null;
}

/**
 * Collects all unique anime cached across all pages and searches.
 * Cached in-memory to prevent thread-blocking JSON parsing on every keystroke.
 */
export function getAllCachedAnime() {
  if (memoizedAllAnime && memoizedAllAnime.length > 0) {
    return memoizedAllAnime;
  }

  const map = new Map();
  // 1. Pre-seed with bundled initial catalog
  if (Array.isArray(initialCatalog)) {
    for (const item of initialCatalog) {
      if (item && item.id && !map.has(Number(item.id))) {
        map.set(Number(item.id), item);
      }
    }
  }

  // 2. Overlay with items from localStorage cache
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && (storageKey.startsWith(CACHE_KEY_PREFIX) || storageKey.startsWith(PAGE_CACHE_PREFIX))) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.items)) {
            for (const item of data.items) {
              if (item && item.id) {
                const existing = map.get(Number(item.id));
                if (existing) {
                  const mergedLinked = (Array.isArray(item.linkedAnime) && item.linkedAnime.length > 0)
                    ? item.linkedAnime
                    : (existing.linkedAnime || []);
                  const mergedSeason = item.season || existing.season || '';
                  const mergedRelated = (item.related_json && item.related_json !== '[]')
                    ? item.related_json
                    : (existing.related_json || '[]');
                  map.set(Number(item.id), {
                    ...existing,
                    ...item,
                    linkedAnime: mergedLinked,
                    season: mergedSeason,
                    related_json: mergedRelated
                  });
                } else {
                  map.set(Number(item.id), item);
                }
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  memoizedAllAnime = Array.from(map.values());
  return memoizedAllAnime;
}

/**
 * Fallback to provide immediate items from any cached page if target page is not yet cached.
 */
export function getAnyCachedCatalog() {
  const all = getAllCachedAnime();
  if (all.length > 0) {
    return {
      items: all.slice(0, 15),
      total: Math.max(all.length, 3406),
      totalPages: Math.ceil(Math.max(all.length, 3406) / 15)
    };
  }
  return null;
}

/**
 * Helper for Russian word stemming to match grammatical forms (e.g. "безработный" -> "безработн" -> matches "безработного")
 */
export function stemRussianWord(word) {
  if (!word) return '';
  const w = word.toLowerCase().replace(/ё/g, 'е').trim();
  if (w.length <= 3) return w;
  return w.replace(/(?:[ое]го|[ое]му|[ыи]ми|[ыи]х|[ыи]е|[ое]й|[ыи]м|[ая]я|[ую]ю|ом|ем|ах|ях|ам|ям|ов|ев|ей|ий|ый|ой|а|я|у|ю|е|о|ы|и|ь)$/i, '');
}

/**
 * Searches across all cached items for matches on title, original title, or description with stemming and relevance ranking.
 */
export function searchCachedAnime(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  const all = getAllCachedAnime();

  const words = q.split(/\s+/).filter((w) => w.length > 0);
  const stopWords = new Set(['у', 'в', 'и', 'с', 'к', 'о', 'на', 'по', 'за', 'из', 'от', 'до', 'об', 'a', 'an', 'the', 'in', 'on', 'of', 'to', 'is', 'no', 'wa']);
  let meaningfulWords = words.filter((w) => w.length > 2 && !stopWords.has(w));
  if (meaningfulWords.length === 0) {
    meaningfulWords = words.filter((w) => w.length > 1);
    if (meaningfulWords.length === 0) meaningfulWords = words;
  }

  const wordStems = meaningfulWords.map((w) => ({
    raw: w,
    stem: stemRussianWord(w)
  }));

  const scored = [];

  for (const item of all) {
    if (!item || !item.id) continue;
    const t = (item.title || '').toLowerCase().replace(/ё/g, 'е');
    const ot = (item.originalTitle || item.original_title || '').toLowerCase().replace(/ё/g, 'е');
    const season = (item.season || '').toLowerCase().replace(/ё/g, 'е');
    const desc = (item.description || '').toLowerCase().replace(/ё/g, 'е');

    // 1. Direct phrase matching
    let matchScore = 0;
    if (t === q) matchScore += 120;
    else if (t.startsWith(q)) matchScore += 70;
    else if (t.includes(q)) matchScore += 50;
    else if (ot.includes(q)) matchScore += 35;
    else if (season.includes(q)) matchScore += 30;
    else if (desc.includes(q)) matchScore += 10;

    // 2. Multi-word / stem matching
    let allWordsMatched = true;
    for (const ws of wordStems) {
      const inTitle = t.includes(ws.raw) || (ws.stem && ws.stem.length >= 3 && t.includes(ws.stem));
      const inOrig = ot.includes(ws.raw) || (ws.stem && ws.stem.length >= 3 && ot.includes(ws.stem));
      const inSeason = season.includes(ws.raw) || (ws.stem && ws.stem.length >= 3 && season.includes(ws.stem));
      const inDesc = desc.includes(ws.raw) || (ws.stem && ws.stem.length >= 3 && desc.includes(ws.stem));

      if (inTitle) matchScore += 20;
      else if (inOrig) matchScore += 12;
      else if (inSeason) matchScore += 15;
      else if (inDesc) matchScore += 5;
      else {
        allWordsMatched = false;
      }
    }

    if (matchScore > 0 && (allWordsMatched || t.includes(q) || ot.includes(q))) {
      scored.push({ item, score: matchScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

/**
 * Fallback to search Shikimori public API directly from client within seconds if not found locally.
 */
export async function searchExternalAnimeFallback(query) {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();
  try {
    const url = `https://shikimori.io/api/animes?search=${encodeURIComponent(cleanQ)}&limit=15`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const typeMap = {
      tv: 'Сериал',
      movie: 'Фильм',
      ova: 'OVA',
      ona: 'ONA',
      special: 'Спешл',
      music: 'Клип'
    };

    const newItems = [];
    for (const d of data) {
      const title = d.russian || d.name;
      const originalTitle = d.name || '';
      const slug = `shiki-${d.id}`;
      // Give fallback synthetic ID above 80000 to prevent collisions, or use shikimori ID
      const numericId = 80000 + Number(d.id);
      let img = d.image?.original ? (d.image.original.startsWith('http') ? d.image.original : `https://shikimori.io${d.image.original}`) : '';
      if (!img || img.includes('missing_original')) {
        img = d.image?.preview ? (d.image.preview.startsWith('http') ? d.image.preview : `https://shikimori.io${d.image.preview}`) : '';
      }
      const type = typeMap[d.kind] || 'Сериал';
      const year = d.aired_on ? d.aired_on.slice(0, 4) : '';

      if (title && slug && img) {
        const itemObj = {
          id: numericId,
          slug,
          title,
          originalTitle,
          imageUrl: img,
          type,
          year,
          genres: [],
          description: '',
          myScore: null,
          averageScore: null,
          ratingCount: 0,
          isFavorite: false,
          isHidden: false,
          commentsCount: 0
        };
        newItems.push(itemObj);
        appendCachedAnimeItem(itemObj);
      }
    }
    return newItems;
  } catch (err) {
    console.warn('External search fallback warning:', err);
    return [];
  }
}

export function updateCachedAnimeItem(animeIdOrItem, updates = null) {
  try {
    let numId;
    let patch;
    if (typeof animeIdOrItem === 'object' && animeIdOrItem !== null) {
      numId = Number(animeIdOrItem.id);
      patch = updates ? { ...animeIdOrItem, ...updates } : animeIdOrItem;
    } else {
      numId = Number(animeIdOrItem);
      patch = updates || {};
    }
    if (!numId || isNaN(numId)) return;

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(CACHE_KEY_PREFIX)) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.items)) {
            let modified = false;
            data.items = data.items.map((item) => {
              if (Number(item.id) === numId) {
                modified = true;
                return { ...item, ...patch };
              }
              return item;
            });
            if (modified) {
              localStorage.setItem(storageKey, JSON.stringify(data));
            }
          }
        } catch (err) {
          // ignore parsing error for single key
        }
      }
    }
    invalidateAllCachedAnime();
  } catch (e) {
    // ignore
  }
}

export function upsertCachedAnimeItem(item) {
  if (!item || !item.id) return;
  try {
    const numId = Number(item.id);
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && (storageKey.startsWith(CACHE_KEY_PREFIX) || storageKey.startsWith(PAGE_CACHE_PREFIX))) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.items)) {
            const idx = data.items.findIndex((x) => Number(x.id) === numId);
            if (idx !== -1) {
              data.items[idx] = { ...data.items[idx], ...item };
            } else {
              data.items.unshift({
                id: numId,
                title: item.title,
                originalTitle: item.originalTitle || '',
                imageUrl: item.imageUrl || item.image || '',
                type: item.type || 'Сериал',
                year: item.year || '',
                genres: item.genres || [],
                description: item.description || item.title,
                myScore: item.score ?? item.myScore ?? null,
                averageScore: item.score ?? item.averageScore ?? null,
                ratingCount: item.ratingCount || 1,
                isFavorite: false,
                isHidden: false,
                commentsCount: item.commentsCount || 0
              });
              data.total = (data.total || data.items.length) + 1;
            }
            localStorage.setItem(storageKey, JSON.stringify(data));
          }
        } catch (err) {}
      }
    }
    invalidateAllCachedAnime();
  } catch (e) {}
}

export function hasCatalogChanged(cachedItems, newItems) {
  if (!cachedItems || !newItems) return true;
  const compareLen = Math.min(cachedItems.length, newItems.length);
  if (compareLen === 0 && (cachedItems.length > 0 || newItems.length > 0)) return true;
  for (let i = 0; i < compareLen; i++) {
    const a = cachedItems[i];
    const b = newItems[i];
    if (a.id !== b.id) return true;
    if (a.title !== b.title) return true;
    if (a.imageUrl !== b.imageUrl) return true;
    if (a.description !== b.description) return true;
    if ((!a.description || a.description.length < 25) && b.description && b.description.length >= 25) return true;
    if (JSON.stringify(a.genres || []) !== JSON.stringify(b.genres || [])) return true;
    if (a.myScore !== b.myScore) return true;
    if (a.isFavorite !== b.isFavorite) return true;
    if (a.isHidden !== b.isHidden) return true;
    if (a.commentsCount !== b.commentsCount) return true;
  }
  return false;
}

export function appendCachedAnimeItem(item) {
  if (!item || !item.id) return;
  try {
    const numId = Number(item.id);
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && (storageKey.startsWith(CACHE_KEY_PREFIX) || storageKey.startsWith(PAGE_CACHE_PREFIX))) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.items)) {
            const exists = data.items.some((x) => Number(x.id) === numId);
            if (!exists) {
              data.items.unshift({
                id: numId,
                title: item.title,
                originalTitle: item.originalTitle || '',
                imageUrl: item.imageUrl || item.image || 'https://placehold.co/300x450/1e293b/ffffff?text=' + encodeURIComponent((item.title || 'Anime').slice(0, 30)),
                type: item.type || 'Сериал',
                year: item.year || '',
                genres: item.genres || [],
                description: item.description || item.title,
                myScore: item.score ?? item.myScore ?? null,
                averageScore: item.score ?? item.averageScore ?? null,
                ratingCount: 1,
                isFavorite: false,
                isHidden: false,
                commentsCount: 0
              });
              data.total = (data.total || data.items.length) + 1;
              localStorage.setItem(storageKey, JSON.stringify(data));
            }
          }
        } catch (err) {}
      }
    }
    invalidateAllCachedAnime();
  } catch (e) {}
}

export function removeCachedAnimeItem(animeId) {
  if (!animeId) return;
  try {
    const numId = Number(animeId);
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && (storageKey.startsWith(CACHE_KEY_PREFIX) || storageKey.startsWith(PAGE_CACHE_PREFIX))) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.items)) {
            const initialLen = data.items.length;
            data.items = data.items.filter((item) => Number(item.id) !== numId);
            if (data.items.length !== initialLen) {
              if (data.total && data.total > 0) {
                data.total = Math.max(0, data.total - 1);
              }
              localStorage.setItem(storageKey, JSON.stringify(data));
            }
          }
        } catch (err) {}
      }
    }
    invalidateAllCachedAnime();
  } catch (e) {}
}
