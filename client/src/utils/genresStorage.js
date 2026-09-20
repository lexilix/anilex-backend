import { apiUrl } from '../api';

const CUSTOM_GENRES_KEY = 'anilex_custom_genres';

export function getCustomGenres() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(CUSTOM_GENRES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomGenre(genreName) {
  if (!genreName || typeof genreName !== 'string') return;
  const cleanName = genreName.trim();
  if (!cleanName) return;

  try {
    const list = getCustomGenres();
    if (!list.some((g) => g.toLowerCase() === cleanName.toLowerCase())) {
      const updated = [...list, cleanName];
      localStorage.setItem(CUSTOM_GENRES_KEY, JSON.stringify(updated));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('anilex:genres-updated', {
          detail: { genre: cleanName, all: updated }
        }));
      }

      fetch(apiUrl('/api/genres'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Failed to save custom genre:', e);
  }
}

export function saveMultipleCustomGenres(genreNames) {
  if (!Array.isArray(genreNames) || genreNames.length === 0) return;
  try {
    const list = getCustomGenres();
    const existingSet = new Set(list.map((g) => g.toLowerCase()));
    const toAdd = [];

    for (const name of genreNames) {
      if (typeof name === 'string' && name.trim()) {
        const clean = name.trim();
        if (!existingSet.has(clean.toLowerCase())) {
          existingSet.add(clean.toLowerCase());
          toAdd.push(clean);
        }
      }
    }

    if (toAdd.length > 0) {
      const updated = [...list, ...toAdd];
      localStorage.setItem(CUSTOM_GENRES_KEY, JSON.stringify(updated));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('anilex:genres-updated', {
          detail: { genres: toAdd, all: updated }
        }));
      }

      fetch(apiUrl('/api/genres'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres: toAdd })
      }).catch(() => {});
    }
  } catch (e) {}
}

export function mergeGenresWithCustom(serverGenres = [], customGenres = []) {
  const result = [...serverGenres];
  const seen = new Set(serverGenres.map((g) => (typeof g === 'string' ? g : g.name).toLowerCase()));

  for (const cg of customGenres) {
    if (cg && !seen.has(cg.toLowerCase())) {
      seen.add(cg.toLowerCase());
      result.push({ name: cg, count: 0 });
    }
  }

  return result;
}
