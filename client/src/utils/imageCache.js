import { getImageProxyUrl } from '../api';

/**
 * Intelligent Gradual Image Cache & URL Resolver
 * - Serves medium quality covers (/covers/{id}.webp) and external posters
 * - Caches images persistently in browser CacheStorage ('anilex-covers-v1')
 * - Uses a controlled gradual queue (max 3 concurrent downloads) so network is never choked
 * - Smoothly refills the cache if the user clears browser cache
 */

const CACHE_NAME = 'anilex-covers-v1';
const blobUrlCache = new Map(); // memory cache: url -> blobUrl
const pendingCallbacks = new Map(); // url -> Array<callback>
const queue = [];
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const prefetchedUrls = new Set();

/**
 * Resolves an anime image URL to its optimal source.
 */
export function resolveImageSrc(rawUrl, animeId) {
  if (animeId && Number(animeId) > 0) {
    return `/covers/${Number(animeId)}.webp`;
  }

  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.includes('missing_original') || rawUrl.includes('placehold.co')) return '';

  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || (rawUrl.startsWith('/') && !rawUrl.startsWith('//'))) {
    return rawUrl;
  }

  return rawUrl;
}

/**
 * Process next items in the gradual queue with max concurrency of 3
 */
function processQueue() {
  if (activeRequests >= MAX_CONCURRENT || queue.length === 0) return;

  const item = queue.shift();
  if (!item) return;

  const { url, fallbackUrl } = item;
  activeRequests++;

  (async () => {
    let resolvedUrl = null;

    // 1. Try browser Cache Storage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_NAME);
        const match = await cache.match(url);
        if (match && match.ok) {
          const blob = await match.blob();
          if (blob && blob.size > 500) {
            resolvedUrl = URL.createObjectURL(blob);
          }
        }
      } catch (e) {}
    }

    // 2. If not in Cache Storage, fetch gradually from network
    if (!resolvedUrl) {
      try {
        let res = await fetch(url).catch(() => null);
        if (!res || !res.ok) {
          if (fallbackUrl && fallbackUrl !== url) {
            res = await fetch(fallbackUrl).catch(() => null);
          }
        }

        if (res && res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('image') || url.endsWith('.webp')) {
            const clone = res.clone();
            const blob = await res.blob();
            if (blob && blob.size > 500) {
              resolvedUrl = URL.createObjectURL(blob);

              // Persist into Cache Storage
              if (typeof window !== 'undefined' && 'caches' in window) {
                try {
                  const cache = await window.caches.open(CACHE_NAME);
                  await cache.put(url, clone);
                } catch (e) {}
              }
            }
          }
        }
      } catch (e) {}
    }

    const finalUrl = resolvedUrl || url;
    blobUrlCache.set(url, finalUrl);

    const callbacks = pendingCallbacks.get(url) || [];
    pendingCallbacks.delete(url);
    callbacks.forEach((cb) => {
      try {
        cb(finalUrl);
      } catch (e) {}
    });
  })().finally(() => {
    activeRequests--;
    // Slight tick between requests to ensure UI rendering remains butter-smooth
    setTimeout(processQueue, 25);
  });
}

/**
 * Request gradual loading of an image with persistent caching.
 */
export function loadCachedImage(url, fallbackUrl, callback) {
  if (!url) {
    if (callback) callback('');
    return;
  }

  // If already in memory blob cache
  if (blobUrlCache.has(url)) {
    if (callback) callback(blobUrlCache.get(url));
    return;
  }

  if (pendingCallbacks.has(url)) {
    if (callback) pendingCallbacks.get(url).push(callback);
    return;
  }

  pendingCallbacks.set(url, callback ? [callback] : []);
  queue.push({ url, fallbackUrl });
  processQueue();
}

/**
 * Backward-compatible helper for components expecting an async resolver.
 */
export async function getCachedImageUrl(url, animeId) {
  return new Promise((resolve) => {
    const primary = resolveImageSrc(url, animeId);
    loadCachedImage(primary, url, (res) => resolve(res || primary));
  });
}

/**
 * Pre-warms browser cache for a list of anime items gradually.
 */
export function prefetchAnimeImages(animeList) {
  if (!Array.isArray(animeList) || typeof window === 'undefined') return;

  const validItems = animeList
    .slice(0, 30)
    .map((a) => ({
      url: a?.imageUrl || a?.image_url || a?.image,
      id: a?.id
    }))
    .filter((it) => (it.id && Number(it.id) > 0) || (it.url && typeof it.url === 'string' && !it.url.includes('missing_original')));

  validItems.forEach((item) => {
    const primary = resolveImageSrc(item.url, item.id);
    if (!primary || prefetchedUrls.has(primary)) return;
    prefetchedUrls.add(primary);
    loadCachedImage(primary, item.url, null);
  });
}
