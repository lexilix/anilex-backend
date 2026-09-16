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
    const cleanItems = (payload.items || []).map((it) => ({
      id: it.id,
      title: it.title,
      originalTitle: it.originalTitle,
      imageUrl: it.imageUrl,
      type: it.type,
      year: it.year,
      genres: it.genres || [],
      description: it.description,
      myScore: it.myScore,
      averageScore: it.averageScore,
      ratingCount: it.ratingCount,
      isFavorite: it.isFavorite,
      isHidden: it.isHidden,
      commentsCount: it.commentsCount
    }));

    const cacheData = {
      timestamp: Date.now(),
      page: payload.page || 1,
      items: cleanItems.slice(0, 500),
      total: payload.total || 0,
      totalPages: payload.totalPages || 1,
      recommendationGenresCount: payload.recommendationGenresCount || 0
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(cacheData));
  } catch (e) {
    // LocalStorage may be full or disabled, silently ignore
  }
}

export function updateCachedAnimeItem(animeId, updates) {
  try {
    const numId = Number(animeId);
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
                return { ...item, ...updates };
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
      if (storageKey && storageKey.startsWith(CACHE_KEY_PREFIX)) {
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

