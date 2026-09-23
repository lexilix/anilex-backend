async function run() {
  const urls = [
    { name: '59361 (secrets)', url: 'https://myanimelist.net/anime/59361' },
    { name: '59443 (reincarnation)', url: 'https://myanimelist.net/anime/59443' }
  ];

  for (const item of urls) {
    try {
      const res = await fetch(item.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const html = await res.text();
      const match = html.match(/<meta property="og:image" content="([^"]+)"/i);
      console.log(item.name, '->', match ? match[1] : 'not found');
    } catch (e) {
      console.log(item.name, 'error:', e.message);
    }
  }
}
run();
