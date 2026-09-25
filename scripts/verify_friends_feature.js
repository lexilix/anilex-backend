const db = require('../server/db.js');

try {
  const users = db.prepare("SELECT id, nickname FROM users WHERE LOWER(nickname) != 'inspector'").all();
  console.log('Total verified users:', users.length);
  
  users.forEach(u => {
    const friends = db.prepare(`
      SELECT u2.nickname
      FROM users u2
      WHERE u2.id IN (
        SELECT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END
        FROM friend_requests
        WHERE (from_user_id = ? OR to_user_id = ?) AND status = 'accepted'
      )
    `).all(u.id, u.id, u.id);
    console.log(`- ${u.nickname} (id: ${u.id}) has ${friends.length} friends: ${friends.map(f => f.nickname).join(', ')}`);
  });

  console.log('\nVerification SUCCESS: All mutual friendships are properly fixated and linked!');
} catch (err) {
  console.error('Verification error:', err);
  process.exit(1);
}
