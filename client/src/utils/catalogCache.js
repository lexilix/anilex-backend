/**
 * Client-side cache for anime catalog pages.
 * Supports instant loading from storage and change detection (image, description, count).
 */

const CACHE_KEY_PREFIX = 'anilex_catalog_cache_';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours TTL

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
    return data;
  } catch (e) {
    return null;
  }
}

export function setCachedCatalog(key, payload) {
  try {
    const cacheData = {
      timestamp: Date.now(),
      items: (payload.items || []).slice(0, 50),
      total: payload.total || 0,
      totalPages: payload.totalPages || 1,
      recommendationGenresCount: payload.recommendationGenresCount || 0
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(cacheData));
  } catch (e) {
    // LocalStorage may be full or disabled, silently ignore
  }
}

export function hasCatalogChanged(cachedItems, newItems) {
  if (!cachedItems || !newItems) return true;
  if (cachedItems.length !== newItems.length) return true;
  for (let i = 0; i < cachedItems.length; i++) {
    const a = cachedItems[i];
    const b = newItems[i];
    if (a.id !== b.id) return true;
    if (a.title !== b.title) return true;
    if (a.imageUrl !== b.imageUrl) return true;
    if (a.description !== b.description) return true;
    if (a.myScore !== b.myScore) return true;
    if (a.isFavorite !== b.isFavorite) return true;
    if (a.isHidden !== b.isHidden) return true;
    if (a.commentsCount !== b.commentsCount) return true;
  }
  return false;
}

