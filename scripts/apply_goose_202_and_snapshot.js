const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'anime_ratings.db');
const db = new DatabaseSync(dbPath);

console.log('=== PREPARING GOOSE4KA 202 RATINGS & SNAPSHOT ===');

// 1. Current Goose4ka ratings
const existingGooseRatings = db.prepare('SELECT anime_id, score FROM ratings WHERE user_id = 25').all();
const existingIds = new Set(existingGooseRatings.map(r => r.anime_id));
console.log('Current Goose4ka ratings in DB:', existingGooseRatings.length);

const targetCount = 202;
const needed = targetCount - existingGooseRatings.length;
console.log(`Need to add ${needed} ratings to reach exactly ${targetCount}`);

// Current sum
const currentSum = existingGooseRatings.reduce((sum, r) => sum + r.score, 0);
const targetAvg = 6.3;
const targetTotalSum = Math.round(targetCount * targetAvg); // 1273
let remainingSumNeeded = targetTotalSum - currentSum; // ~982

console.log(`Target total sum: ${targetTotalSum}, current sum: ${currentSum}, needed sum: ${remainingSumNeeded}`);

// Candidate anime to rate (published, excluding ones user 25 already rated)
const candidates = db.prepare(`
  SELECT id, title, year, type, genres, image_url, slug
  FROM anime
  WHERE is_published = 1 AND id NOT IN (${[...existingIds].join(',')})
  ORDER BY id ASC
`).all();

if (candidates.length < needed) {
  throw new Error(`Not enough candidate anime: ${candidates.length} < ${needed}`);
}

// Generate score distribution for 151 ratings to achieve target sum and cover 0..10
// We want:
// score 10: 8
// score 9: 15
// score 8: 25
// score 7: 35
// score 6: 30
// score 5: 18
// score 4: 10
// score 3: 5
// score 2: 2
// score 1: 2
// score 0: 1
const scores = [];
function addScores(val, count) {
  for (let i = 0; i < count; i++) scores.push(val);
}

addScores(10, 8);
addScores(9, 15);
addScores(8, 25);
addScores(7, 35);
addScores(6, 30);
addScores(5, 18);
addScores(4, 10);
addScores(3, 5);
addScores(2, 2);
addScores(1, 2);
addScores(0, 1);

// Ensure exact length of 151
while (scores.length < needed) scores.push(6);
while (scores.length > needed) scores.pop();

// Adjust scores to match exact remainingSumNeeded
let currentAddSum = scores.reduce((a, b) => a + b, 0);
let diff = remainingSumNeeded - currentAddSum;

let idx = 0;
while (diff !== 0 && idx < 1000) {
  idx++;
  if (diff > 0) {
    // Increase a score that is < 10
    const itemIdx = scores.findIndex(s => s >= 5 && s < 9);
    if (itemIdx >= 0) {
      scores[itemIdx]++;
      diff--;
    } else break;
  } else if (diff < 0) {
    // Decrease a score that is > 1
    const itemIdx = scores.findIndex(s => s > 5 && s <= 8);
    if (itemIdx >= 0) {
      scores[itemIdx]--;
      diff++;
    } else break;
  }
}

const finalAddSum = scores.reduce((a, b) => a + b, 0);
console.log(`Generated ${scores.length} scores with sum ${finalAddSum}. Total sum will be ${currentSum + finalAddSum} (avg = ${((currentSum + finalAddSum) / targetCount).toFixed(2)})`);

// Insert new ratings
const insertRatingStmt = db.prepare(`
  INSERT OR IGNORE INTO ratings (user_id, anime_id, score, created_at, updated_at)
  VALUES (25, ?, ?, datetime('now', '-' || ? || ' hours'), datetime('now', '-' || ? || ' hours'))
`);

for (let i = 0; i < needed; i++) {
  const anime = candidates[i];
  const score = scores[i];
  const hoursAgo = Math.floor(i * 1.5) + 1;
  insertRatingStmt.run(anime.id, score, hoursAgo, hoursAgo);
}

// Set Top-5 for Goose4ka
const top5Ids = [3339, 3341, 7184, 60058, 3127];
db.prepare('DELETE FROM user_top5 WHERE user_id = 25').run();
const insTop5 = db.prepare('INSERT INTO user_top5 (user_id, anime_id, position, created_at) VALUES (25, ?, ?, CURRENT_TIMESTAMP)');
top5Ids.forEach((aId, pos) => {
  insTop5.run(aId, pos + 1);
});

// Update Goose4ka user record with real avatar and banner
const bannerWithTop5 = `/api/uploads/user_25_banner.jpg#top5=${top5Ids.join(',')}`;
db.prepare(`
  UPDATE users
  SET avatar_url = '/api/uploads/user_25_avatar.png',
      banner_url = ?
  WHERE id = 25
`).run(bannerWithTop5);

// Verify counts
const gooseCount = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 25').get().c;
const justCount = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = 5').get().c;
console.log(`Goose4ka final ratings count in DB: ${gooseCount} (Expected: 202)`);
console.log(`Just final ratings count in DB: ${justCount} (Expected: 211)`);

if (gooseCount !== 202) throw new Error(`Goose4ka ratings count mismatch: ${gooseCount} != 202`);
if (justCount !== 211) throw new Error(`Just ratings count mismatch: ${justCount} != 211`);

// Update backup JSON files
['accounts_backup.json', 'accounts_backup_permanent.json'].forEach(fName => {
  const fPath = path.join(__dirname, '..', 'data', fName);
  if (fs.existsSync(fPath)) {
    const backup = JSON.parse(fs.readFileSync(fPath, 'utf8'));

    // Update user 25 in users array
    const uIdx = backup.users.findIndex(u => u.id === 25);
    if (uIdx >= 0) {
      backup.users[uIdx].avatar_url = '/api/uploads/user_25_avatar.png';
      backup.users[uIdx].banner_url = bannerWithTop5;
    }

    // Replace user 25 ratings in backup
    const otherRatings = (backup.ratings || []).filter(r => r.user_id !== 25);
    const dbGooseRatings = db.prepare('SELECT user_id, anime_id, score, created_at, updated_at FROM ratings WHERE user_id = 25').all();
    backup.ratings = [...otherRatings, ...dbGooseRatings];

    // Update user_top5
    const otherTop5 = (backup.userTop5 || []).filter(t => t.user_id !== 25);
    const dbGooseTop5 = db.prepare('SELECT user_id, anime_id, position, created_at FROM user_top5 WHERE user_id = 25').all();
    backup.userTop5 = [...otherTop5, ...dbGooseTop5];

    fs.writeFileSync(fPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`Updated ${fName} with 202 Goose4ka ratings and new avatar/banner.`);
  }
});

// Build client snapshot: client/src/data/clubRatingsSnapshot.json
const clubUserIds = [5, 25, 21, 20, 22, 23, 15];
const snapshot = {};

for (const uId of clubUserIds) {
  const rows = db.prepare(`
    SELECT a.id, a.slug, a.title, a.image_url, a.type, a.year, a.genres, r.score, r.updated_at
    FROM ratings r
    JOIN anime a ON r.anime_id = a.id
    WHERE r.user_id = ?
    ORDER BY r.score DESC, r.updated_at DESC
  `).all(uId);

  const uTop5Rows = db.prepare('SELECT anime_id FROM user_top5 WHERE user_id = ? ORDER BY position ASC').all(uId);
  const uTop5Ids = uTop5Rows.map(t => Number(t.anime_id));

  snapshot[uId] = rows.map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    imageUrl: r.image_url,
    type: r.type,
    year: r.year,
    genres: JSON.parse(r.genres || '[]'),
    score: r.score,
    isPinned: uTop5Ids.includes(Number(r.id)),
    updatedAt: r.updated_at
  }));
  console.log(`User ${uId} snapshot ratings count: ${snapshot[uId].length}`);
}

const snapshotPath = path.join(__dirname, '..', 'client', 'src', 'data', 'clubRatingsSnapshot.json');
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot), 'utf8');
console.log(`Saved clubRatingsSnapshot.json with ${Object.keys(snapshot).length} users.`);

console.log('ALL TASKS COMPLETED SUCCESSFULLY!');
