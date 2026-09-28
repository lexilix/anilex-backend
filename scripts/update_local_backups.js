const fs = require('fs');
const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 5, nickname: 'Just', email: 'just9jeeet@gmail.com', role: 'admin' },
  'anime-friends-secret-key-2026-minimalism',
  { expiresIn: '7d' }
);

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = https.request('https://anilex-backend.onrender.com' + path, {
      method,
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch (e) {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function backupLiveToDisk() {
  console.log('--- Fetching live state from Render ---');
  const usersRes = await request('GET', '/api/dev/users');
  if (!usersRes.body || !Array.isArray(usersRes.body.users)) {
    console.error('Failed to get users:', usersRes);
    return;
  }

  const liveUsers = usersRes.body.users;
  console.log(`Found ${liveUsers.length} users on Render:`);

  const allRatings = [];
  const allTop5 = [];

  for (const u of liveUsers) {
    console.log(`Fetching profile for user ${u.nickname} (ID: ${u.id})...`);
    const profRes = await request('GET', `/api/users/${u.id}/profile`);
    if (profRes.body) {
      if (Array.isArray(profRes.body.ratings)) {
        for (const r of profRes.body.ratings) {
          allRatings.push({
            user_id: u.id,
            anime_id: r.id,
            score: r.score,
            created_at: r.updatedAt || new Date().toISOString(),
            updated_at: r.updatedAt || new Date().toISOString()
          });
        }
      }
      if (Array.isArray(profRes.body.top5Anime)) {
        for (let i = 0; i < profRes.body.top5Anime.length; i++) {
          allTop5.push({
            user_id: u.id,
            anime_id: profRes.body.top5Anime[i].id,
            position: i + 1
          });
        }
      }
    }
  }

  // Load existing backup to preserve password hashes, custom anime, and salt
  const existingBackup = JSON.parse(fs.readFileSync('data/accounts_backup.json', 'utf8'));

  const mergedUsers = liveUsers.map(lu => {
    const existing = existingBackup.users.find(eu => eu.email?.toLowerCase() === lu.email?.toLowerCase() || eu.id === lu.id);
    return {
      id: lu.id,
      email: lu.email,
      nickname: lu.nickname,
      password_hash: existing?.password_hash || 'RESTORED_ACCOUNT',
      salt: existing?.salt || 'RESTORED_SALT',
      avatar_url: lu.avatarUrl || existing?.avatar_url || null,
      banner_url: lu.bannerUrl || existing?.banner_url || null,
      allow_password_set: 0,
      is_blocked: lu.isBlocked ? 1 : 0
    };
  });

  const newBackupData = {
    savedAt: new Date().toISOString(),
    users: mergedUsers,
    ratings: allRatings,
    top5: allTop5,
    customGenres: existingBackup.customGenres || [],
    customAnime: existingBackup.customAnime || [],
    comments: existingBackup.comments || []
  };

  fs.writeFileSync('data/accounts_backup.json', JSON.stringify(newBackupData, null, 2), 'utf8');
  fs.writeFileSync('data/accounts_backup_permanent.json', JSON.stringify(newBackupData, null, 2), 'utf8');
  console.log('--- Successfully updated accounts_backup.json and accounts_backup_permanent.json! ---');
  console.log('Users saved:', newBackupData.users.length);
  console.log('Ratings saved:', newBackupData.ratings.length);
}

module.exports = { backupLiveToDisk };

if (require.main === module) {
  backupLiveToDisk();
}
