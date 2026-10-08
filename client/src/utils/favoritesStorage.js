import { apiUrl } from '../api';
import initialFavorites from '../data/initialFavorites.json';

const STORAGE_PREFIX = 'anilex_favorites_';
const METADATA_PREFIX = 'anilex_fav_meta_';

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

function getMetadataKey(userId) {
  return `${METADATA_PREFIX}${userId || 'guest'}`;
}

/**
 * Returns set of favorite anime IDs for the given user.
 * Seeded with original 17 favorites for user Just (ID 5).
 */
export function getFavoriteAnimeIds(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(Number));
      }
    }
  } catch (e) {}

  // Initial seed fallback for user Just (ID 5)
  if (!userId || Number(userId) === 5) {
    const initialIds = initialFavorites.map((it) => Number(it.id));
    try {
      localStorage.setItem(getStorageKey(userId || 5), JSON.stringify(initialIds));
    } catch (e) {}
    return new Set(initialIds);
  }

  return new Set();
}

export function isAnimeFavoritedLocally(animeId, userId) {
  if (!animeId) return false;
  const ids = getFavoriteAnimeIds(userId);
  return ids.has(Number(animeId));
}

/**
 * Returns full list of favorite anime objects for user profile.
 */
export function getStoredFavoriteAnimeList(userId) {
  try {
    const raw = localStorage.getItem(getMetadataKey(userId));
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (e) {}

  // Seed default favorites for user Just (ID 5)
  if (!userId || Number(userId) === 5) {
    const formatted = initialFavorites.map((it) => ({
      id: Number(it.id),
      title: it.title,
      originalTitle: it.original_title,
      imageUrl: it.image_url,
      type: it.type,
      year: it.year,
      genres: typeof it.genres === 'string' ? JSON.parse(it.genres) : (it.genres || []),
      description: it.description,
      favoritedAt: it.created_at || new Date().toISOString(),
      isFavorite: true
    }));
    try {
      localStorage.setItem(getMetadataKey(userId || 5), JSON.stringify(formatted));
    } catch (e) {}
    return formatted;
  }

  return [];
}

/**
 * Locally add or remove an anime from favorites.
 */
export function setAnimeFavoriteLocally(anime, isFavorite, userId) {
  if (!anime || !anime.id) return;
  try {
    const numId = Number(anime.id);
    const key = getStorageKey(userId);
    const metaKey = getMetadataKey(userId);
    const ids = getFavoriteAnimeIds(userId);

    let metaList = getStoredFavoriteAnimeList(userId);

    if (isFavorite) {
      ids.add(numId);
      if (!metaList.some((it) => Number(it.id) === numId)) {
        const itemObj = {
          id: numId,
          title: anime.title || `Аниме #${numId}`,
          originalTitle: anime.originalTitle || anime.original_title || '',
          imageUrl: anime.imageUrl || anime.image_url || '',
          type: anime.type || 'Сериал',
          year: anime.year || '',
          genres: Array.isArray(anime.genres) ? anime.genres : [],
          description: anime.description || '',
          myScore: anime.myScore !== undefined ? anime.myScore : null,
          averageScore: anime.averageScore !== undefined ? anime.averageScore : null,
          ratingCount: anime.ratingCount || 0,
          favoritedAt: new Date().toISOString(),
          isFavorite: true
        };
        metaList.unshift(itemObj);
      }
    } else {
      ids.delete(numId);
      metaList = metaList.filter((it) => Number(it.id) !== numId && !(Array.isArray(it.aliasIds) && it.aliasIds.map(Number).includes(numId)));
    }

    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
    localStorage.setItem(metaKey, JSON.stringify(metaList.slice(0, 500)));

    // Dispatch global event so UI updates immediately anywhere
    window.dispatchEvent(
      new CustomEvent('anilex:favorite-updated', {
        detail: {
          animeId: numId,
          isFavorite,
          anime: { ...anime, id: numId, isFavorite }
        }
      })
    );
  } catch (e) {
    console.warn('Failed to update favorites in localStorage:', e);
  }
}

/**
 * Toggles favorite state with instant optimistic UI response,
 * animation triggering, local persistence, and background server sync.
 */
export async function toggleFavoriteAnime(anime, token, userId, forcedState = null) {
  if (!anime || !anime.id) return false;
  const numId = Number(anime.id);
  const currentIds = getFavoriteAnimeIds(userId);
  const currentlyFav = currentIds.has(numId) || Boolean(anime.isFavorite);
  const nextFavState = forcedState !== null ? forcedState : !currentlyFav;

  // 1. Immediate optimistic client persistence (0ms)
  setAnimeFavoriteLocally(anime, nextFavState, userId);

  // 2. Background server synchronization
  if (token) {
    try {
      fetch(apiUrl(`/api/anime/${numId}/favorite`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.isFavorite === 'boolean' && data.isFavorite !== nextFavState) {
            setAnimeFavoriteLocally(anime, data.isFavorite, userId);
          }
        })
        .catch((err) => {
          console.warn('Background favorite sync network error (saved locally):', err);
        });
    } catch (e) {}
  }

  return nextFavState;
}
