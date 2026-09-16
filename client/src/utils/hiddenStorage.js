import { apiUrl } from '../api';

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
    return new Set(Array.isArray(arr) ? arr.map(Number) : []);
  } catch (e) {
    return new Set();
  }
}

export function isAnimeHiddenLocally(animeId, userId) {
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
  try {
    const key = getStorageKey(userId);
    const metaKey = getMetadataKey(userId);
    const ids = getHiddenAnimeIds(userId);
    const numId = Number(anime.id);

    let metaList = getStoredHiddenAnimeList(userId);

    if (isHidden) {
      ids.add(numId);
      if (!metaList.some((it) => Number(it.id) === numId)) {
        metaList.unshift({
          id: numId,
          title: anime.title,
          originalTitle: anime.originalTitle,
          imageUrl: anime.imageUrl,
          type: anime.type,
          year: anime.year,
          genres: anime.genres || [],
          description: anime.description,
          myScore: anime.myScore,
          averageScore: anime.averageScore,
          ratingCount: anime.ratingCount,
          hiddenAt: new Date().toISOString()
        });
      }
    } else {
      ids.delete(numId);
      metaList = metaList.filter((it) => Number(it.id) !== numId);
    }

    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
    localStorage.setItem(metaKey, JSON.stringify(metaList.slice(0, 300)));
  } catch (e) {
    console.warn('Failed to update hidden anime in localStorage', e);
  }
}

export async function toggleHiddenAnime(anime, token, userId, forcedState = null) {
  const numId = Number(anime.id);
  const currentIds = getHiddenAnimeIds(userId);
  const currentlyHidden = currentIds.has(numId) || Boolean(anime.isHidden);
  const newHiddenState = forcedState !== null ? forcedState : !currentlyHidden;

  // 1. Immediate local persistence
  setAnimeHiddenLocally(anime, newHiddenState, userId);

  // 2. Synchronize to server
  if (token) {
    try {
      fetch(apiUrl(`/api/anime/${numId}/hide`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch((err) => {
        console.warn('Background sync for hide anime failed (persisted locally):', err);
      });
    } catch (e) {
      // Ignored, client has local state
    }
  }

  return newHiddenState;
}
