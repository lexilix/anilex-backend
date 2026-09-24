const db = require('../server/db');

console.log('--- Testing Local DB State ---');
const users = db.prepare('SELECT id, nickname, email FROM users').all();
console.log('Users in DB:', users.map(u => ({ id: u.id, nickname: u.nickname, email: u.email })));

for (const u of users) {
  const rCount = db.prepare('SELECT count(id) as count FROM ratings WHERE user_id = ?').get(u.id)?.count;
  console.log('User', u.id, u.nickname, 'ratings count:', rCount);
}

const justTop5 = db.prepare('SELECT anime_id, position FROM user_top5 WHERE user_id = 5 ORDER BY position ASC').all();
console.log('Just top-5:', justTop5);

const shadowRatings = db.prepare('SELECT id, anime_id, score FROM ratings WHERE user_id = 5 AND anime_id IN (6970, 5655)').all();
console.log('Shadow ratings for Just:', shadowRatings);

const frCount = db.prepare("SELECT count(id) as count FROM friend_requests WHERE status = 'accepted'").get()?.count;
console.log('Accepted friendships count:', frCount);

const tower = db.prepare('SELECT id, title, description FROM anime WHERE id = 2346').get();
console.log('Tower of God desc:', tower?.description?.slice(0, 100));

if (typeof db.saveAccountsBackup === 'function') {
  db.saveAccountsBackup();
  console.log('Saved accounts backup successfully.');
}
