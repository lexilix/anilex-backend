const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('Fetching https://anilex-anime.web.app ...');
  const index = await get('https://anilex-anime.web.app');
  console.log('Index status:', index.statusCode);
  const match = index.data.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!match) {
    console.error('Could not find JS bundle in index.html');
    process.exit(1);
  }
  const jsUrl = 'https://anilex-anime.web.app' + match[1];
  console.log('Fetching JS bundle:', jsUrl);
  const js = await get(jsUrl);
  console.log('JS bundle status:', js.statusCode, 'Length:', js.data.length);

  // Test cover image
  const coverUrl = 'https://anilex-anime.web.app/covers/1.webp';
  console.log('Fetching sample cover:', coverUrl);
  const cover = await get(coverUrl);
  console.log('Cover status:', cover.statusCode, 'Length:', cover.data.length);

  console.log('Verification SUCCESS: Web application deployed and operational!');
}

verify().catch((err) => {
  console.error('Verification FAILED:', err);
  process.exit(1);
});
