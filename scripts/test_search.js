const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/anime_ratings.db');
const catalog = JSON.parse(fs.readFileSync('client/src/data/initialCatalog.json', 'utf8'));

const testQueries = ['гача', 'жозе', 'заветное желание', 'медака', 'торадора', 'секреты', 'колдовских', 'лепестки', 'блю лок', 'эрис'];

testQueries.forEach(q => {
  const qLower = q.toLowerCase();
  const catMatches = catalog.filter(it => (it.title || '').toLowerCase().includes(qLower) || (it.originalTitle || '').toLowerCase().includes(qLower));
  const dbMatches = db.prepare('SELECT id, title, year FROM anime WHERE title_lower LIKE ? OR original_title_lower LIKE ?').all('%' + qLower + '%', '%' + qLower + '%');
  console.log(`Query: "${q}" -> Catalog: ${catMatches.length} matches, DB: ${dbMatches.length} matches`);
  if (catMatches.length > 0) console.log(`   Catalog top: [${catMatches[0].id}] ${catMatches[0].title}`);
  if (dbMatches.length > 0) console.log(`   DB top: [${dbMatches[0].id}] ${dbMatches[0].title}`);
});
