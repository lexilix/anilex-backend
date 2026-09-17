const ANIME_EDITS_KEY = 'anilex_custom_anime_edits';
const USER_EDITS_KEY = 'anilex_custom_user_edits';

export function getCustomAnimeEdits() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = localStorage.getItem(ANIME_EDITS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveCustomAnimeEdit(animeId, editData) {
  if (!animeId || !editData) return;
  try {
    const edits = getCustomAnimeEdits();
    const numId = Number(animeId);
    const updated = {
      ...(edits[numId] || {}),
      ...editData,
      id: numId,
      updatedAt: Date.now()
    };
    edits[numId] = updated;
    localStorage.setItem(ANIME_EDITS_KEY, JSON.stringify(edits));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anilex:anime-updated', {
        detail: updated
      }));
    }
  } catch (e) {
    console.warn('Failed to persist custom anime edit:', e);
  }
}

export function applyCustomAnimeEdits(item) {
  if (!item || !item.id) return item;
  try {
    const edits = getCustomAnimeEdits();
    const custom = edits[Number(item.id)];
    if (custom) {
      const bestImg = custom.imageUrl || custom.image_url || item.imageUrl || item.image_url;
      const bestTitle = custom.title || item.title;
      const bestOriginal = custom.originalTitle !== undefined ? custom.originalTitle : (item.originalTitle || item.original_title || '');
      const bestDesc = custom.description !== undefined ? custom.description : item.description;
      const bestType = custom.type || item.type;
      const bestYear = custom.year !== undefined ? custom.year : item.year;
      const bestGenres = Array.isArray(custom.genres) ? custom.genres : (item.genres || []);

      return {
        ...item,
        ...custom,
        title: bestTitle,
        originalTitle: bestOriginal,
        original_title: bestOriginal,
        description: bestDesc,
        imageUrl: bestImg,
        image_url: bestImg,
        type: bestType,
        year: bestYear,
        genres: bestGenres
      };
    }
  } catch (e) {}
  return item;
}

export function getCustomUserEdits() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = localStorage.getItem(USER_EDITS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveCustomUserEdit(userId, userData) {
  if (!userId || !userData) return;
  try {
    const edits = getCustomUserEdits();
    const numId = Number(userId);
    edits[numId] = {
      ...(edits[numId] || {}),
      ...userData,
      id: numId,
      updatedAt: Date.now()
    };
    localStorage.setItem(USER_EDITS_KEY, JSON.stringify(edits));
  } catch (e) {
    console.warn('Failed to persist custom user edit:', e);
  }
}

export function applyCustomUserEdits(userObj) {
  if (!userObj || !userObj.id) return userObj;
  try {
    const edits = getCustomUserEdits();
    const custom = edits[Number(userObj.id)];
    if (custom) {
      return {
        ...userObj,
        ...custom
      };
    }
  } catch (e) {}
  return userObj;
}
