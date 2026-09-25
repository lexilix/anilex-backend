/**
 * Client-side persistent cache for user profile data and ratings.
 * Allows 0ms instant loading upon entering the site, switching tabs, or reloads.
 */

const USER_PROFILE_KEY = 'anilex_cached_user_profile';
const RATINGS_PREFIX = 'anilex_cached_user_ratings_';

export function getCachedUserProfile() {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.id ? data : null;
  } catch (e) {
    return null;
  }
}

export function setCachedUserProfile(user) {
  try {
    if (!user) {
      localStorage.removeItem(USER_PROFILE_KEY);
      return;
    }
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Failed to cache user profile in localStorage', e);
  }
}

export function clearCachedUserProfile() {
  try {
    localStorage.removeItem(USER_PROFILE_KEY);
  } catch (e) {
    // Ignore
  }
}

const UNWANTED_JUST_ZERO_IDS = new Set([1306, 650, 3395, 2069, 2149, 2591, 3492, 1577, 914, 865, 7227, 5655, 7234]);

export function getCachedUserRatings(userId) {
  try {
    const key = `${RATINGS_PREFIX}${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    let list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    const isJustUser = Number(userId) === 5 || userId === '5';
    if (isJustUser) {
      const originalLen = list.length;
      list = list.filter((r) => {
        const idNum = Number(r.id);
        if (UNWANTED_JUST_ZERO_IDS.has(idNum)) return false;
        return true;
      });
      if (list.length !== originalLen) {
        localStorage.setItem(key, JSON.stringify(list));
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

export function setCachedUserRatings(userId, ratings) {
  try {
    if (!userId) return;
    const key = `${RATINGS_PREFIX}${userId}`;
    const isJustUser = Number(userId) === 5 || userId === '5';
    let filteredRatings = ratings || [];
    if (isJustUser) {
      filteredRatings = filteredRatings.filter((r) => {
        const idNum = Number(r.id);
        if (UNWANTED_JUST_ZERO_IDS.has(idNum)) return false;
        return true;
      });
    }
    const cleanList = filteredRatings.map((r) => ({
      id: r.id,
      title: r.title,
      originalTitle: r.originalTitle,
      imageUrl: r.imageUrl,
      type: r.type,
      year: r.year,
      genres: r.genres || [],
      description: r.description,
      myScore: r.myScore,
      averageScore: r.averageScore,
      ratingCount: r.ratingCount
    }));
    localStorage.setItem(key, JSON.stringify(cleanList.slice(0, 500)));
  } catch (e) {
    console.warn('Failed to cache user ratings in localStorage', e);
  }
}

export function updateCachedUserRating(userId, animeId, score, animeData = null) {
  try {
    const targetUserId = userId || getCachedUserProfile()?.id;
    if (!targetUserId) return;
    const key = `${RATINGS_PREFIX}${targetUserId}`;
    let list = getCachedUserRatings(targetUserId);
    const numId = Number(animeId);
    const animeTitle = (animeData?.title || '').trim().toLowerCase();

    const isJustUser = Number(targetUserId) === 5 || targetUserId === '5';
    const isUnwantedBlacklist = isJustUser && UNWANTED_JUST_ZERO_IDS.has(numId);
    if (score === null || score === undefined || score === '' || isUnwantedBlacklist) {
      // Remove rating
      list = list.filter((it) => {
        if (Number(it.id) === numId) return false;
        if (animeTitle && it.title && it.title.trim().toLowerCase() === animeTitle) return false;
        if (isJustUser && UNWANTED_JUST_ZERO_IDS.has(Number(it.id))) return false;
        return true;
      });
    } else {
      // Update or insert
      const existingIdx = list.findIndex(
        (it) =>
          Number(it.id) === numId ||
          (Array.isArray(it.aliasIds) && it.aliasIds.map(Number).includes(numId)) ||
          (animeTitle && it.title && it.title.trim().toLowerCase() === animeTitle)
      );
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          myScore: Number(score)
        };
      } else {
        // Insert newly rated anime into cached ratings list
        list.unshift({
          id: numId,
          title: animeData?.title || 'Аниме #' + numId,
          originalTitle: animeData?.originalTitle || '',
          imageUrl: animeData?.imageUrl || animeData?.image || 'https://placehold.co/300x450/1e293b/ffffff?text=Anime',
          type: animeData?.type || 'Сериал',
          year: animeData?.year || '',
          genres: animeData?.genres || [],
          description: animeData?.description || '',
          myScore: Number(score),
          averageScore: animeData?.averageScore !== undefined && animeData?.averageScore !== null ? Number(animeData.averageScore) : null,
          ratingCount: animeData?.ratingCount !== undefined && animeData?.ratingCount !== null ? Number(animeData.ratingCount) : 0
        });
      }
    }

    localStorage.setItem(key, JSON.stringify(list.slice(0, 1000)));
  } catch (e) {
    console.warn('Failed to update cached rating in localStorage', e);
  }
}
