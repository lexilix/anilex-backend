const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const COVERS_DIR = path.join(__dirname, '..', 'client', 'public', 'covers');
const IMAGE_CACHE_DIR = path.join(__dirname, '..', 'data', 'image_cache');
const CATALOG_PATH = path.join(__dirname, '..', 'client', 'src', 'data', 'initialCatalog.json');
const DB_PATH = path.join(__dirname, '..', 'data', 'anime_ratings.db');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// 1. Collect all unique anime items across catalog and DB
const animeMap = new Map();

if (fs.existsSync(CATALOG_PATH)) {
  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    for (const item of catalog) {
      if (item && item.id) {
        const url = item.imageUrl || item.image_url;
        animeMap.set(Number(item.id), {
          id: Number(item.id),
          title: item.title || '',
          slug: item.slug || '',
          url: url || ''
        });
      }
    }
  } catch (e) {
    console.error('Error reading initialCatalog.json:', e);
  }
}

if (fs.existsSync(DB_PATH)) {
  try {
    const db = new (require('node:sqlite').DatabaseSync)(DB_PATH);
    const rows = db.prepare('SELECT id, title, slug, image_url FROM anime').all();
    for (const r of rows) {
      const numId = Number(r.id);
      if (!animeMap.has(numId) || !animeMap.get(numId).url) {
        animeMap.set(numId, {
          id: numId,
          title: r.title || '',
          slug: r.slug || '',
          url: r.image_url || ''
        });
      }
    }
  } catch (e) {
    console.error('Error reading SQLite DB:', e);
  }
}

const allItems = Array.from(animeMap.values()).filter(a => a.url && typeof a.url === 'string');
console.log(`Starting image download and compression for ${allItems.length} anime covers...`);
console.log(`Output directory: ${COVERS_DIR}`);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchImageBuffer(item) {
  const rawUrl = item.url.trim();

  // 1. Local file handling (e.g. /mugen_gacha_poster.jpg)
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    const localPath = path.join(__dirname, '..', 'client', 'public', rawUrl.replace(/^\/+/, ''));
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  // 2. Check disk cache in data/image_cache/
  try {
    const cacheKey = crypto.createHash('sha256').update(rawUrl).digest('hex');
    const binFile = path.join(IMAGE_CACHE_DIR, `${cacheKey}.bin`);
    if (fs.existsSync(binFile)) {
      const stat = fs.statSync(binFile);
      if (stat.size > 1000) {
        return fs.readFileSync(binFile);
      }
    }
  } catch (e) {}

  // 3. Network fetch with retries
  const urlsToTry = [rawUrl];

  // Fallback for Shikimori by slug
  if (item.slug && item.slug.startsWith('shiki-')) {
    const shikiId = item.slug.replace('shiki-', '');
    urlsToTry.push(`https://shikimori.one/system/animes/original/${shikiId}.jpg`);
  }

  for (const targetUrl of urlsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const isAnimeGo = targetUrl.includes('cdngos.com') || targetUrl.includes('animego');
        const headers = {
          'User-Agent': USER_AGENT,
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        };
        if (isAnimeGo) {
          headers['Referer'] = 'https://animego.me/';
        }

        const res = await fetch(targetUrl, {
          headers,
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const arrBuf = await res.arrayBuffer();
          if (arrBuf && arrBuf.byteLength > 800) {
            return Buffer.from(arrBuf);
          }
        }
      } catch (err) {
        // Retry after short delay
        if (attempt === 0) await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  return null;
}

async function processItem(item) {
  const destPath = path.join(COVERS_DIR, `${item.id}.webp`);

  // Check if valid compressed image already exists
  if (fs.existsSync(destPath)) {
    try {
      const stat = fs.statSync(destPath);
      if (stat.size > 800) {
        return { success: true, skipped: true, size: stat.size };
      }
    } catch (e) {}
  }

  const rawBuffer = await fetchImageBuffer(item);
  if (!rawBuffer) {
    return { success: false, id: item.id, title: item.title, error: 'Download failed' };
  }

  try {
    const compressedBuffer = await sharp(rawBuffer)
      .resize({
        width: 200,
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({
        quality: 55,
        effort: 4
      })
      .toBuffer();

    fs.writeFileSync(destPath, compressedBuffer);
    return { success: true, skipped: false, size: compressedBuffer.length };
  } catch (err) {
    return { success: false, id: item.id, title: item.title, error: err.message };
  }
}

async function main() {
  const startTime = Date.now();
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;

  const CONCURRENCY = 20;
  const queue = [...allItems];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const res = await processItem(item);
      completed++;
      if (res.success) {
        if (res.skipped) {
          skipped++;
        }
        totalBytes += (res.size || 0);
      } else {
        failed++;
      }

      if (completed % 150 === 0 || queue.length === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Progress] ${completed}/${allItems.length} done (${skipped} cached, ${failed} failed) in ${elapsed}s. Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('====================================================');
  console.log(`FINISHED in ${totalTime}s`);
  console.log(`Total processed: ${completed}`);
  console.log(`Already cached: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total covers size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  if (completed - failed > 0) {
    console.log(`Average cover size: ${(totalBytes / (completed - failed) / 1024).toFixed(1)} KB`);
  }
  console.log('====================================================');
}

main().catch(console.error);
