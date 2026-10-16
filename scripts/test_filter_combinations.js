const initialCatalog = require('../client/src/data/initialCatalog.json');

function testFilter(genres, sort, type, year, filterStatus) {
  let list = initialCatalog.map(it => ({ ...it }));
  if (genres && genres.length > 0) {
    list = list.filter(it => Array.isArray(it.genres) && genres.every(g => it.genres.includes(g)));
  }
  if (type && type !== 'all') {
    list = list.filter(it => it.type === type);
  }
  if (year && year !== 'all') {
    list = list.filter(it => String(it.year) === String(year));
  }
  return list;
}

console.log('Romance count:', testFilter(['Романтика']).length);
console.log('Drama count:', testFilter(['Драма']).length);
console.log('Action + Comedy count:', testFilter(['Экшен', 'Комедия']).length);
console.log('Romance + 2026 count:', testFilter(['Романтика'], null, null, '2026').length);
console.log('Romance + Сериал count:', testFilter(['Романтика'], null, 'Сериал').length);
