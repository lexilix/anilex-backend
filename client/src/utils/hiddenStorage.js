import { apiUrl } from '../api';
import initialCatalog from '../data/initialCatalog.json';
import { getAllCachedAnime } from './catalogCache';

const STORAGE_PREFIX = 'anilex_hidden_anime_';
const METADATA_PREFIX = 'anilex_hidden_meta_';

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

function getMetadataKey(userId) {
  return `${METADATA_PREFIX}${userId || 'guest'}`;
}

export function getHiddenAnimeIds(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(Number).filter((n) => !isNaN(n)) : []);
  } catch (e) {
    return new Set();
  }
}

export function isAnimeHiddenLocally(animeId, userId) {
  if (!animeId) return false;
  const ids = getHiddenAnimeIds(userId);
  return ids.has(Number(animeId));
}

export function getStoredHiddenAnimeList(userId) {
  try {
    const raw = localStorage.getItem(getMetadataKey(userId));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function setAnimeHiddenLocally(anime, isHidden, userId) {
  if (!anime || (!anime.id && !anime.slug)) return;
  try {
    const numId = Number(anime.id);
    const key = getStorageKey(userId);
    const metaKey = getMetadataKey(userId);
    const ids = getHiddenAnimeIds(userId);

    let metaList = getStoredHiddenAnimeList(userId);

    // Fallback metadata lookup from initialCatalog or cache if fields are missing
    let fullMeta = { ...anime };
    if (!fullMeta.title || !fullMeta.imageUrl) {
      try {
        const found =
          (Array.isArray(initialCatalog) ? initialCatalog : []).find(
            (x) => Number(x.id) === numId || (anime.slug && x.slug === anime.slug)
          ) ||
          getAllCachedAnime().find(
            (x) => Number(x.id) === numId || (anime.slug && x.slug === anime.slug)
          );
        if (found) {
          fullMeta = { ...found, ...anime };
        }
      } catch (e) {}
    }

    if (isHidden) {
      if (!isNaN(numId)) ids.add(numId);
      if (!metaList.some((it) => Number(it.id) === numId)) {
        metaList.unshift({
          id: numId,
          slug: fullMeta.slug || `anime-${numId}`,
          title: fullMeta.title || `Аниме #${numId}`,
          originalTitle: fullMeta.originalTitle || fullMeta.original_title || '',
          imageUrl: fullMeta.imageUrl || fullMeta.image_url || '',
          type: fullMeta.type || 'Сериал',
          year: fullMeta.year || '',
          genres: Array.isArray(fullMeta.genres) ? fullMeta.genres : [],
          description: fullMeta.description || '',
          myScore: fullMeta.myScore !== undefined ? fullMeta.myScore : null,
          averageScore: fullMeta.averageScore !== undefined ? fullMeta.averageScore : null,
          ratingCount: fullMeta.ratingCount || 0,
          hiddenAt: new Date().toISOString(),
          isHidden: true
        });
      }
    } else {
      if (!isNaN(numId)) ids.delete(numId);
      metaList = metaList.filter(
        (it) => Number(it.id) !== numId && !(Array.isArray(it.aliasIds) && it.aliasIds.map(Number).includes(numId))
      );
    }

    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
    localStorage.setItem(metaKey, JSON.stringify(metaList.slice(0, 500)));

    // Dispatch global event so all components update immediately
    window.dispatchEvent(
      new CustomEvent('anilex:hidden-updated', {
        detail: {
          animeId: numId,
          isHidden,
          anime: { ...fullMeta, id: numId, isHidden }
        }
      })
    );
  } catch (e) {
    console.warn('Failed to update hidden anime in localStorage', e);
  }
}

/**
 * Synchronize hidden anime list from server to localStorage.
 */
export async function syncHiddenAnimeFromServer(token, userId) {
  if (!token) return getHiddenAnimeIds(userId);
  try {
    const res = await fetch(apiUrl('/api/user/hidden'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const serverItems = Array.isArray(data.items) ? data.items : [];
      const key = getStorageKey(userId);
      const metaKey = getMetadataKey(userId);
      const serverIds = serverItems.map((it) => Number(it.id)).filter((n) => !isNaN(n));

      // Merge with any local ones or set
      localStorage.setItem(key, JSON.stringify(serverIds));
      localStorage.setItem(metaKey, JSON.stringify(serverItems.slice(0, 500)));

      window.dispatchEvent(
        new CustomEvent('anilex:hidden-synced', {
          detail: {
            userId,
            ids: serverIds,
            items: serverItems
          }
        })
      );
      return new Set(serverIds);
    }
  } catch (e) {
    console.warn('Failed to sync hidden anime from server:', e);
  }
  return getHiddenAnimeIds(userId);
}

export async function toggleHiddenAnime(anime, token, userId, forcedState = null) {
  if (!anime || (!anime.id && !anime.slug)) return false;
  const numId = Number(anime.id);
  const currentIds = getHiddenAnimeIds(userId);
  const currentlyHidden = (!isNaN(numId) && currentIds.has(numId)) || Boolean(anime.isHidden);
  const newHiddenState = forcedState !== null ? Boolean(forcedState) : !currentlyHidden;

  // 1. Immediate optimistic local persistence (0ms)
  setAnimeHiddenLocally(anime, newHiddenState, userId);

  // 2. Synchronize to server in background
  if (token) {
    try {
      const targetParam = (!isNaN(numId) && numId > 0) ? numId : (anime.slug || anime.id);
      fetch(apiUrl(`/api/anime/${targetParam}/hide`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isHidden: newHiddenState })
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.isHidden === 'boolean' && data.isHidden !== newHiddenState) {
            setAnimeHiddenLocally(anime, data.isHidden, userId);
          }
        })
        .catch((err) => {
          console.warn('Background sync for hide anime network warning (persisted locally):', err);
        });
    } catch (e) {}
  }

  return newHiddenState;
}
