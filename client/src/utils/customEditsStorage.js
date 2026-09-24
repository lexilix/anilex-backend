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
      const bestSeason = custom.season !== undefined ? custom.season : (item.season || '');
      const bestLinked = Array.isArray(custom.linkedAnime) ? custom.linkedAnime : (item.linkedAnime || []);

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
        genres: bestGenres,
        season: bestSeason,
        linkedAnime: bestLinked
      };
    } else if (!item.linkedAnime && item.related_json) {
      try {
        const parsed = JSON.parse(item.related_json);
        if (Array.isArray(parsed)) {
          return {
            ...item,
            linkedAnime: parsed
          };
        }
      } catch (e) {}
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
    // Auto-purge stale haitek collision on ID 23
    if (edits[23] && edits[23].nickname === 'haitek') {
      delete edits[23];
      try {
        localStorage.setItem(USER_EDITS_KEY, JSON.stringify(edits));
      } catch (e) {}
    }
    const custom = edits[Number(userObj.id)];
    if (custom) {
      // Mismatched email check
      if (custom.email && userObj.email && custom.email.toLowerCase() !== userObj.email.toLowerCase()) {
        return userObj;
      }
      // Prevent haitek override on lonely4ka
      if (Number(userObj.id) === 23 && custom.nickname && custom.nickname.toLowerCase() === 'haitek') {
        return userObj;
      }
      const finalNickname = (custom.nickname && (!userObj.nickname || (custom.email && custom.email === userObj.email)))
        ? custom.nickname
        : (userObj.nickname || custom.nickname);
      const finalAvatar = custom.avatarUrl || userObj.avatarUrl;
      const finalBanner = custom.bannerUrl || userObj.bannerUrl;

      return {
        ...userObj,
        ...custom,
        nickname: finalNickname,
        avatarUrl: finalAvatar,
        bannerUrl: finalBanner
      };
    }
  } catch (e) {}
  return userObj;
}
