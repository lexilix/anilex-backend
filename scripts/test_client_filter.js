const initialCatalog = require('../client/src/data/initialCatalog.json');

function filterCatalog(list, { search = '', sort = 'newest', type = 'all', year = 'all', filterStatus = 'all', genres = [], userId = 5 }) {
  let result = [...list];

  // 1. Search filter
  if (search && search.trim()) {
    const s = search.trim().toLowerCase().replace(/ё/g, 'е');
    result = result.filter(item => {
      const t = (item.title || '').toLowerCase().replace(/ё/g, 'е');
      const ot = (item.originalTitle || item.original_title || '').toLowerCase().replace(/ё/g, 'е');
      return t.includes(s) || ot.includes(s);
    });
  }

  // 2. Genres filter
  if (genres && genres.length > 0) {
    result = result.filter(item => {
      const itemGenres = Array.isArray(item.genres) ? item.genres : [];
      return genres.every(g => itemGenres.includes(g));
    });
  }

  // 3. Type filter
  if (type && type !== 'all') {
    result = result.filter(item => item.type === type);
  }

  // 4. Year filter
  if (year && year !== 'all') {
    result = result.filter(item => String(item.year) === String(year));
  }

  // 5. Status filter
  if (filterStatus === 'my_rated') {
    result = result.filter(item => item.myScore !== null && item.myScore !== undefined);
  } else if (filterStatus === 'my_unrated') {
    result = result.filter(item => item.myScore === null || item.myScore === undefined);
  } else if (filterStatus === 'friends_rated') {
    result = result.filter(item => (item.ratingCount > 0) || (item.averageScore > 0));
  }

  // 6. Sort
  if (sort === 'my_score_desc') {
    result.sort((a, b) => {
      const aScore = a.myScore !== null && a.myScore !== undefined ? Number(a.myScore) : -1;
      const bScore = b.myScore !== null && b.myScore !== undefined ? Number(b.myScore) : -1;
      if (bScore !== aScore) return bScore - aScore;
      return (Number(b.year) || 0) - (Number(a.year) || 0);
    });
  } else if (sort === 'rating') {
    result.sort((a, b) => {
      const aAvg = Number(a.averageScore) || 0;
      const bAvg = Number(b.averageScore) || 0;
      if (bAvg !== aAvg) return bAvg - aAvg;
      return (Number(b.year) || 0) - (Number(a.year) || 0);
    });
  } else if (sort === 'unrated') {
    result = result.filter(item => item.myScore === null || item.myScore === undefined);
    result.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  } else {
    // newest
    result.sort((a, b) => {
      const yA = Number(a.year) || 0;
      const yB = Number(b.year) || 0;
      if (yB !== yA) return yB - yA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }

  return result;
}

// Test Romance
console.time('Filter romance');
const romanceResults = filterCatalog(initialCatalog, { genres: ['Романтика'] });
console.timeEnd('Filter romance');
console.log('Romance results count:', romanceResults.length);
console.log('Top 3 romance titles:', romanceResults.slice(0, 3).map(r => ({ id: r.id, title: r.title, genres: r.genres, year: r.year })));

// Test Drama
console.time('Filter drama');
const dramaResults = filterCatalog(initialCatalog, { genres: ['Драма'] });
console.timeEnd('Filter drama');
console.log('Drama results count:', dramaResults.length);
console.log('Top 3 drama titles:', dramaResults.slice(0, 3).map(r => ({ id: r.id, title: r.title, genres: r.genres, year: r.year })));

// Test Year 2026
const year2026Results = filterCatalog(initialCatalog, { year: '2026' });
console.log('Year 2026 count:', year2026Results.length, 'All 2026?:', year2026Results.every(r => String(r.year) === '2026'));

// Test Type ONA
const onaResults = filterCatalog(initialCatalog, { type: 'ONA' });
console.log('ONA count:', onaResults.length, 'All ONA?:', onaResults.every(r => r.type === 'ONA'));
