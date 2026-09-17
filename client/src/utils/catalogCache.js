import { deduplicateAnimeList } from './animeDeduplicator';

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
  } catch (e) {
    // Silently ignore storage quota
  }
}

/**
 * Collects all unique anime cached across all pages and searches.
 */
export function getAllCachedAnime() {
  const map = new Map();
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
              if (item && item.id && !map.has(Number(item.id))) {
                map.set(Number(item.id), item);
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  return Array.from(map.values());
}

/**
 * Fallback to provide immediate items from any cached page if target page is not yet cached.
 */
export function getAnyCachedCatalog() {
  const all = getAllCachedAnime();
  if (all.length > 0) {
    return {
      items: all.slice(0, 15),
      total: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / 15))
    };
  }
  return null;
}

/**
 * Searches across all cached items for matches on title, original title, or description.
 */
export function searchCachedAnime(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const all = getAllCachedAnime();
  return all.filter((item) => {
    const t = (item.title || '').toLowerCase();
    const ot = (item.originalTitle || item.original_title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    return t.includes(q) || ot.includes(q) || desc.includes(q);
  });
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
  } catch (e) {}
}
