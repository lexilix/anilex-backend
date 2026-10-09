const sharp = require('sharp');
const fs = require('fs');

async function searchAndSave(id, title) {
  try {
    const sRes = await fetch('https://animego.me/search/anime?q=' + encodeURIComponent(title), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animego.me/' }
    });
    if (sRes.ok) {
      const html = await sRes.text();
      const m = html.match(/https:\/\/img\.cdngos\.com\/v\/[^"']+/);
      if (m) {
        const iRes = await fetch(m[0], { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animego.me/' } });
        if (iRes.ok) {
          const buf = await iRes.arrayBuffer();
          const out = await sharp(Buffer.from(buf)).resize({ width: 200, withoutEnlargement: true, fit: 'inside' }).webp({ quality: 55 }).toBuffer();
          fs.writeFileSync('client/public/covers/' + id + '.webp', out);
          console.log('Saved', id, title, 'size:', out.length);
          return;
        }
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}

async function run() {
  await searchAndSave(7230, 'Время пыток, принцесса!');
  await searchAndSave(7232, 'Пуниру — милая слизь');
}
run();
