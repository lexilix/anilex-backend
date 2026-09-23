const db = require('../server/db');

const users = db.prepare("SELECT id, nickname FROM users WHERE LOWER(nickname) != 'inspector'").all();
console.log('Users found:', users.map(u => `${u.id}: ${u.nickname}`));

const checkStmt = db.prepare(`
  SELECT id, status FROM friend_requests
  WHERE (from_user_id = ? AND to_user_id = ?)
     OR (from_user_id = ? AND to_user_id = ?)
`);

const insertStmt = db.prepare(`
  INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
  VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
`);

const updateStmt = db.prepare(`
  UPDATE friend_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?
`);

let count = 0;
for (let i = 0; i < users.length; i++) {
  for (let j = i + 1; j < users.length; j++) {
    const u1 = users[i];
    const u2 = users[j];
    const existing = checkStmt.get(u1.id, u2.id, u2.id, u1.id);
    if (!existing) {
      insertStmt.run(u1.id, u2.id);
      count++;
      console.log(`Created friendship: ${u1.nickname} <-> ${u2.nickname}`);
    } else if (existing.status !== 'accepted') {
      updateStmt.run(existing.id);
      count++;
      console.log(`Updated friendship to accepted: ${u1.nickname} <-> ${u2.nickname}`);
    } else {
      console.log(`Already friends: ${u1.nickname} <-> ${u2.nickname}`);
    }
  }
}

console.log(`Friendship update complete. Total modified/added: ${count}`);

const allFriends = db.prepare('SELECT * FROM friend_requests').all();
console.log('Total friend requests in DB:', allFriends.length);

db.saveAccountsBackup();
console.log('Accounts backup saved successfully!');
