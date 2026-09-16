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

export function getCachedUserRatings(userId) {
  try {
    const key = `${RATINGS_PREFIX}${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function setCachedUserRatings(userId, ratings) {
  try {
    if (!userId) return;
    const key = `${RATINGS_PREFIX}${userId}`;
    const cleanList = (ratings || []).map((r) => ({
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
    if (!userId) return;
    const key = `${RATINGS_PREFIX}${userId}`;
    let list = getCachedUserRatings(userId);
    const numId = Number(animeId);

    if (score === null || score === undefined) {
      // Remove rating
      list = list.filter((it) => Number(it.id) !== numId);
    } else {
      // Update or insert
      const existingIdx = list.findIndex((it) => Number(it.id) === numId);
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          myScore: Number(score)
        };
      } else if (animeData) {
        list.unshift({
          id: numId,
          title: animeData.title,
          originalTitle: animeData.originalTitle,
          imageUrl: animeData.imageUrl,
          type: animeData.type,
          year: animeData.year,
          genres: animeData.genres || [],
          description: animeData.description,
          myScore: Number(score),
          averageScore: animeData.averageScore,
          ratingCount: animeData.ratingCount
        });
      }
    }

    localStorage.setItem(key, JSON.stringify(list.slice(0, 500)));
  } catch (e) {
    console.warn('Failed to update cached rating in localStorage', e);
  }
}
