import { applyCustomAnimeEdits } from './customEditsStorage';

/**
 * Client-side anime deduplication utility.
 * Unifies duplicate titles (e.g. number-words vs digits, alternate titles with same romanized Japanese title,
 * identical franchise titles with same season/year/type) into a single canonical anime card on the fly.
 */
const NUMBER_WORDS_MAP = {
    'девятьсот девяносто девятого': '999',
    'девятьсот девяносто девять': '999',
    'первый': '1', 'первая': '1', 'первое': '1', 'первом': '1', 'первых': '1', 'первую': '1',
    'второй': '2', 'вторая': '2', 'второе': '2', 'втором': '2', 'вторых': '2', 'вторую': '2',
    'третий': '3', 'третья': '3', 'третье': '3', 'третьем': '3', 'третьих': '3', 'третью': '3',
    'четвертый': '4', 'четвертая': '4', 'четвертое': '4', 'четвертом': '4',
    'пятый': '5', 'пятая': '5', 'пятое': '5',
    'шестой': '6', 'седьмой': '7', 'восьмой': '8', 'девятый': '9', 'десятый': '10',
    'один': '1', 'два': '2', 'две': '2', 'три': '3', 'четыре': '4', 'пять': '5',
    'шесть': '6', 'семь': '7', 'восемь': '8', 'девять': '9', 'десять': '10',
    '1-й': '1', '2-й': '2', '3-й': '3', '4-й': '4', '5-й': '5',
    '1й': '1', '2й': '2', '3й': '3', '4й': '4', '5й': '5',
    '1-го': '1', '2-го': '2', '3-го': '3', '4-го': '4', '5-го': '5',
    'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10'
  };

  function normalizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[«»""''`]/g, '')
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeNumberWords(str) {
    if (!str || typeof str !== 'string') return '';
    let res = normalizeText(str);
    // Multi-word phrases first
    res = res.replace(/\bдевятьсот\s+девяносто\s+девятого\b/g, '999');
    res = res.replace(/\bдевятьсот\s+девяносто\s+девять\b/g, '999');

    const words = res.split(' ');
    const replaced = words.map(w => NUMBER_WORDS_MAP[w] || w);
    return replaced.join(' ');
  }

  function extractSeasonNumber(title) {
    if (!title) return null;
    const norm = normalizeNumberWords(title);
    const m = norm.match(/(?:сезон|season|ч|часть|part)\s*(\d+)/i) ||
              norm.match(/(\d+)(?:\s*-(?:й|ой|ий|го))?\s*(?:сезон|season)/i) ||
              norm.match(/\b([1-9]|1\d|20)\b$/);
    return m ? parseInt(m[1], 10) : null;
  }

  function getWordKey(title) {
    if (!title) return '';
    const norm = normalizeNumberWords(title);
    const stop = ['в', 'на', 'с', 'к', 'и', 'по', 'о', 'об', 'из', 'у', 'от', 'до', 'no', 'to', 'at', 'the', 'of', 'фильм', 'movie'];
    const words = norm.split(' ').filter(w => w.length > 1 && !stop.includes(w));
    words.sort();
    return words.join('_');
  }

  function getOriginalTitles(orig) {
    if (!orig) return [];
    return orig.split(/[\/;]/)
      .map(p => normalizeText(p).replace(/\b(movie|фильм)\b/g, '').replace(/\s+/g, ' ').trim())
      .filter(p => p.length >= 4);
  }

  function areSameAnime(a, b) {
    if (!a || !b) return false;
    if (a.id === b.id) return true;

    // Year check
    const aYear = String(a.year || '').trim();
    const bYear = String(b.year || '').trim();
    if (aYear && bYear && Math.abs(parseInt(aYear, 10) - parseInt(bYear, 10)) > 1) {
      return false;
    }

    // OVA / TV Series check
    const aIsOva = /ova|спешл|спецвыпуск/i.test(a.title || '') || a.type === 'OVA' || a.type === 'Спешл';
    const bIsOva = /ova|спешл|спецвыпуск/i.test(b.title || '') || b.type === 'OVA' || b.type === 'Спешл';
    if (aIsOva !== bIsOva) return false;

    // Movie vs Series check
    const aIsMovie = a.type === 'Фильм' || /\b(фильм|movie)\b/i.test(a.title || '');
    const bIsMovie = b.type === 'Фильм' || /\b(фильм|movie)\b/i.test(b.title || '');
    if (aIsMovie !== bIsMovie) return false;

    // Season check
    const aSeason = extractSeasonNumber(a.title);
    const bSeason = extractSeasonNumber(b.title);
    const aHasExplicitSeason = aSeason !== null;
    const bHasExplicitSeason = bSeason !== null;
    if (aHasExplicitSeason !== bHasExplicitSeason && ((aSeason || 1) > 1 || (bSeason || 1) > 1)) {
      return false;
    }
    if (aHasExplicitSeason && bHasExplicitSeason && aSeason !== bSeason) {
      return false;
    }

    // 1. Direct normalized title match
    const aNorm = normalizeText(a.title);
    const bNorm = normalizeText(b.title);
    if (aNorm && bNorm && aNorm === bNorm) return true;

    // 2. Normalized number-words match
    const aNumNorm = normalizeNumberWords(a.title);
    const bNumNorm = normalizeNumberWords(b.title);
    if (aNumNorm && bNumNorm && aNumNorm === bNumNorm) return true;

    // 3. Word bag key match (e.g. "моя любовь к ямаде 999 уровня" vs "моя любовь девятьсот девяносто девятого уровня к ямаде")
    const aKey = getWordKey(a.title);
    const bKey = getWordKey(b.title);
    if (aKey && bKey && aKey.length >= 8 && aKey === bKey) return true;

    // 4. Original titles overlap (e.g. "Yamada-kun to Lv999 no Koi wo Suru")
    const aOrigs = getOriginalTitles(a.original_title || a.originalTitle);
    const bOrigs = getOriginalTitles(b.original_title || b.originalTitle);
    if (aOrigs.length > 0 && bOrigs.length > 0) {
      for (const ao of aOrigs) {
        if (ao.length >= 8 && bOrigs.includes(ao)) {
          return true;
        }
      }
    }

    // 5. Cross title and originalTitle inclusion
    const aAllOrig = normalizeText(a.original_title || a.originalTitle);
    const bAllOrig = normalizeText(b.original_title || b.originalTitle);
    if (aNorm && aNorm.length >= 10 && (bAllOrig.includes(aNorm) || bNorm === aNorm)) return true;
    if (bNorm && bNorm.length >= 10 && (aAllOrig.includes(bNorm) || aNorm === bNorm)) return true;

    return false;
  }

  function getDeletedAnimeIds() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return new Set(JSON.parse(localStorage.getItem('anilex_deleted_anime_ids') || '[]').map(Number));
      }
    } catch (e) {}
    return new Set();
  }

  function deduplicateAnimeList(items) {
    if (!Array.isArray(items)) return [];
    const deletedIds = getDeletedAnimeIds();
    const cleanItems = items
      .filter((it) => it && !deletedIds.has(Number(it.id)))
      .map((it) => applyCustomAnimeEdits(it));
    if (cleanItems.length <= 1) return cleanItems;

    const result = [];
    const mergedIds = new Set();

    for (let i = 0; i < cleanItems.length; i++) {
      const item = cleanItems[i];
      if (!item || mergedIds.has(item.id)) continue;

      let merged = { ...item };
      merged.aliasIds = Array.isArray(merged.aliasIds) ? [...merged.aliasIds] : [merged.id];
      let hasRating = merged.myScore !== null && merged.myScore !== undefined;

      for (let j = i + 1; j < cleanItems.length; j++) {
        const other = cleanItems[j];
        if (!other || mergedIds.has(other.id)) continue;

        if (areSameAnime(merged, other)) {
          mergedIds.add(other.id);
          merged.aliasIds.push(other.id);

          // Merge ratings
          const otherHasRating = other.myScore !== null && other.myScore !== undefined;
          if (!hasRating && otherHasRating) {
            merged.myScore = other.myScore;
            hasRating = true;
          }

          // Merge average score and rating count
          if ((!merged.averageScore || merged.averageScore === 0) && other.averageScore) {
            merged.averageScore = other.averageScore;
            merged.ratingCount = other.ratingCount;
          } else if (other.ratingCount > (merged.ratingCount || 0)) {
            merged.averageScore = other.averageScore;
            merged.ratingCount = other.ratingCount;
          }

          // Prefer title with numbers instead of spelled out words
          if (/[0-9]/.test(other.title) && !/[0-9]/.test(merged.title)) {
            merged.title = other.title;
          }

          // Merge genres
          const g1 = Array.isArray(merged.genres) ? merged.genres : [];
          const g2 = Array.isArray(other.genres) ? other.genres : [];
          const combinedGenres = Array.from(new Set([...g1, ...g2]));
          merged.genres = combinedGenres;

          // Merge descriptions
          const d1 = merged.description || '';
          const d2 = other.description || '';
          if (d2.length > d1.length && d2.length > 40) {
            merged.description = d2;
          }

          // Merge original titles
          const o1 = merged.originalTitle || merged.original_title || '';
          const o2 = other.originalTitle || other.original_title || '';
          if (o2 && !o1.toLowerCase().includes(o2.toLowerCase().slice(0, 15))) {
            merged.originalTitle = `${o1} / ${o2}`;
            merged.original_title = merged.originalTitle;
          }

          // Merge friends ratings
          const f1 = Array.isArray(merged.friendsRatings) ? merged.friendsRatings : [];
          const f2 = Array.isArray(other.friendsRatings) ? other.friendsRatings : [];
          const friendMap = new Map();
          [...f1, ...f2].forEach((f) => {
            if (f && f.userId && !friendMap.has(f.userId)) {
              friendMap.set(f.userId, f);
            }
          });
          merged.friendsRatings = Array.from(friendMap.values());

          // Merge favorites / hidden
          merged.isFavorite = Boolean(merged.isFavorite || other.isFavorite);
          merged.isHidden = Boolean(merged.isHidden || other.isHidden);
        }
      }

      result.push(merged);
    }

    return result;
  }

export {
  NUMBER_WORDS_MAP,
  normalizeText,
  normalizeNumberWords,
  extractSeasonNumber,
  getWordKey,
  getOriginalTitles,
  areSameAnime,
  deduplicateAnimeList
};
