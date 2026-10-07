const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const IMAGE_CACHE_DIR = path.join(__dirname, '../data/image_cache');
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

function getUpstreamReferer(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('shikimori')) return 'https://shikimori.one/';
  if (url.includes('animego') || url.includes('cdngos')) return 'https://animego.me/';
  if (url.includes('desu')) return 'https://desu.me/';
  if (url.includes('anilist')) return 'https://anilist.co/';
  return '';
}

async function fetchAndCacheImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) return false;
  if (imageUrl.includes('missing_original')) return false;

  const cacheKey = crypto.createHash('sha256').update(imageUrl).digest('hex');
  const cacheMetaFile = path.join(IMAGE_CACHE_DIR, `${cacheKey}.json`);
  const cacheDataFile = path.join(IMAGE_CACHE_DIR, `${cacheKey}.bin`);

  if (fs.existsSync(cacheMetaFile) && fs.existsSync(cacheDataFile)) {
    return true; // Already cached!
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': getUpstreamReferer(imageUrl),
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) return false;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    const buffer = await res.arrayBuffer();

    if (buffer.byteLength < 500 || buffer.byteLength === 16876) return false;

    fs.writeFileSync(cacheDataFile, Buffer.from(buffer));
    fs.writeFileSync(
      cacheMetaFile,
      JSON.stringify({
        contentType,
        url: imageUrl,
        savedAt: Date.now(),
        etag,
        lastModified,
        byteLength: buffer.byteLength
      })
    );
    return true;
  } catch (e) {
    return false;
  }
}

async function warmCache() {
  const dbPath = path.join(__dirname, '../data/anime_ratings.db');
  const db = new DatabaseSync(dbPath);

  // 1. All anime rated by user 5 (Just) and others
  const rated = db.prepare(`
    SELECT DISTINCT a.id, a.title, a.image_url 
    FROM anime a
    JOIN ratings r ON r.anime_id = a.id
    WHERE a.image_url IS NOT NULL AND a.image_url LIKE 'http%'
  `).all();

  // 2. Initial catalog & top 150 anime
  const topAnime = db.prepare(`
    SELECT id, title, image_url 
    FROM anime 
    WHERE image_url IS NOT NULL AND image_url LIKE 'http%'
    LIMIT 200
  `).all();

  const allTargets = new Map();
  for (const it of [...rated, ...topAnime]) {
    if (it && it.image_url && !allTargets.has(it.image_url)) {
      allTargets.set(it.image_url, it.title);
    }
  }

  // Also include initialCatalog top items
  try {
    const initCat = JSON.parse(fs.readFileSync(path.join(__dirname, '../client/src/data/initialCatalog.json'), 'utf8'));
    for (const it of initCat.slice(0, 100)) {
      if (it && it.imageUrl && it.imageUrl.startsWith('http') && !allTargets.has(it.imageUrl)) {
        allTargets.set(it.imageUrl, it.title);
      }
    }
  } catch (e) {}

  console.log(`Starting cache warm-up for ${allTargets.size} posters...`);

  let count = 0;
  let cached = 0;
  for (const [url, title] of allTargets.entries()) {
    count++;
    const ok = await fetchAndCacheImage(url);
    if (ok) cached++;
    if (count % 25 === 0 || count === allTargets.size) {
      console.log(`Progress: ${count}/${allTargets.size} processed, ${cached} cached.`);
    }
  }

  console.log(`Cache warming complete! Total cached: ${cached}/${allTargets.size}`);
}

warmCache();
