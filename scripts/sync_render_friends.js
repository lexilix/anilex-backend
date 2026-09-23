const jwt = require('jsonwebtoken');
const secret = 'anime-friends-secret-key-2026-minimalism';

const users = [
  { id: 5, nickname: 'Just', email: 'just9jeeet@gmail.com' },
  { id: 15, nickname: 'Katsu', email: 'katsudemisek@gmail.com' },
  { id: 20, nickname: 'MrTech', email: 'mrtech@example.com' },
  { id: 21, nickname: 'Venicek', email: 'venicek@example.com' }
];

async function syncFriendsOnRender() {
  console.log('--- Connecting all users on live Render backend ---');
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (i === j) continue;
      const uFrom = users[i];
      const uTo = users[j];
      const tokenFrom = jwt.sign({ id: uFrom.id, email: uFrom.email, nickname: uFrom.nickname }, secret);
      
      try {
        const reqRes = await fetch('https://anilex-backend.onrender.com/api/friends/request/' + uTo.id, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + tokenFrom
          }
        });
        const reqData = await reqRes.json().catch(() => ({}));
        console.log(`Request ${uFrom.nickname} -> ${uTo.nickname}: status ${reqRes.status}`, reqData.message || reqData.error || '');
      } catch (e) {
        console.error('Req error:', e.message);
      }
    }
  }

  // Accept all incoming requests for each user
  for (const u of users) {
    const token = jwt.sign({ id: u.id, email: u.email, nickname: u.nickname }, secret);
    try {
      const incRes = await fetch('https://anilex-backend.onrender.com/api/friends/requests', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const incData = await incRes.json().catch(() => ({}));
      const incoming = incData.incoming || [];
      console.log(`User ${u.nickname} has ${incoming.length} incoming requests`);
      for (const req of incoming) {
        const acceptRes = await fetch('https://anilex-backend.onrender.com/api/friends/respond/' + req.requestId, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ action: 'accept' })
        });
        const acceptData = await acceptRes.json().catch(() => ({}));
        console.log(`Accepted request ${req.requestId} for ${u.nickname}:`, acceptData.message || acceptData.error || '');
      }
    } catch (e) {
      console.error('Accept error:', e.message);
    }
  }

  // Check Just's friends list on Render
  const justToken = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, secret);
  const myFriendsRes = await fetch('https://anilex-backend.onrender.com/api/friends/my', {
    headers: { Authorization: 'Bearer ' + justToken }
  });
  const myFriendsData = await myFriendsRes.json();
  console.log('=== JUST MY FRIENDS ON RENDER ===');
  console.log(myFriendsData.friends);

  // Check search statuses on Render
  const searchRes = await fetch('https://anilex-backend.onrender.com/api/users/search?q=', {
    headers: { Authorization: 'Bearer ' + justToken }
  });
  const searchData = await searchRes.json();
  console.log('=== SEARCH USERS ON RENDER ===');
  console.log(searchData.users.map(u => ({ id: u.id, nickname: u.nickname, status: u.friendshipStatus })));
}

syncFriendsOnRender();
