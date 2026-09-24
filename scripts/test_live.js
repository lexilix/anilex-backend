const https = require('https');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const justToken = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);

function req(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://anilex-backend.onrender.com');
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const r = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

async function main() {
  console.log('Testing live backend...');
  const health = await req('/health');
  console.log('Health:', health);

  // Search users / friends
  const users = await req('/api/users/search?q=', 'GET', null, { 'Authorization': `Bearer ${justToken}` });
  console.log('Users search status:', users.status);
  if (users.status === 200 && Array.isArray(users.body)) {
    console.log('Users found:', users.body.map(u => ({ id: u.id, nickname: u.nickname, ratings_count: u.ratings_count, friendship_status: u.friendship_status })));
  } else {
    console.log('Users body:', users.body);
  }

  // Friends list
  const friends = await req('/api/friends', 'GET', null, { 'Authorization': `Bearer ${justToken}` });
  console.log('Friends status:', friends.status);
  if (friends.status === 200 && Array.isArray(friends.body)) {
    console.log('Friends count:', friends.body.length);
    console.log('Friends:', friends.body.map(f => ({ id: f.id, nickname: f.nickname, status: f.status })));
  }

  // Top 5
  const top5 = await req('/api/user/top5', 'GET', null, { 'Authorization': `Bearer ${justToken}` });
  console.log('Top5 status:', top5.status);
  console.log('Top5:', top5.body);

  // Just ratings count and check if 0 ratings exist
  const ratings = await req('/api/user/ratings', 'GET', null, { 'Authorization': `Bearer ${justToken}` });
  console.log('Just ratings status:', ratings.status);
  if (ratings.status === 200 && Array.isArray(ratings.body)) {
    console.log('Just total ratings count:', ratings.body.length);
    const zeroRatings = ratings.body.filter(r => r.rating === 0);
    console.log('Just 0-ratings count:', zeroRatings.length);
  }
}

main().catch(console.error);
