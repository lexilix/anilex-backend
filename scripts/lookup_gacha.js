const fs = require('fs');

async function test() {
  const r = await fetch('https://animego.me/search/anime?q=' + encodeURIComponent('Бесконечная гача'), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await r.text();
  const re = /<a[^>]+href="(\/anime\/[^"]+)"[^>]*title="([^"]+)"/g;
  let m;
  const list = [];
  while ((m = re.exec(html)) !== null) {
    list.push({ url: m[1], title: m[2] });
  }
  console.log('ANIMEGO RESULTS:', list);
}

test().catch(console.error);
