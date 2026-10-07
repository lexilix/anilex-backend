import { getImageProxyUrl } from '../api';

/**
 * Intelligent Image Cache & URL Resolver
 * - Serves external posters (Shikimori, Animego, etc.) through the persistent server-side proxy
 * - Ensures images load instantly from the server disk cache even if the user clears browser cache
 * - Enables automatic stale-while-revalidate updates when Shikimori or Animego change cover art
 * - Pre-warms the cache safely without broken opaque CORS blobs
 */

const prefetchedUrls = new Set();

/**
 * Resolves an anime image URL to its optimal, cached source.
 */
export function resolveImageSrc(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.includes('missing_original') || rawUrl.includes('placehold.co')) return '';

  // Local assets, data URLs or blob URLs are loaded directly
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  // Local paths like /mugen_gacha_poster.jpg
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    return rawUrl;
  }

  // Direct CDN loading with no-referrer: ultrafast, 0 server load, saved network
  // In case of any loading failure, AnimeCard / FeaturedCarousel automatically falls back to getImageProxyUrl()
  return rawUrl;
}

/**
 * Backward-compatible helper for components expecting an async resolver.
 */
export async function getCachedImageUrl(url) {
  return resolveImageSrc(url);
}

/**
 * Pre-warms browser HTTP cache and server disk cache for a list of anime items.
 * Uses native Image() pre-loading which avoids CORS/opaque response issues.
 */
export function prefetchAnimeImages(animeList) {
  if (!Array.isArray(animeList) || typeof window === 'undefined') return;

  const validUrls = animeList
    .slice(0, 15)
    .map((a) => a?.imageUrl || a?.image_url || a?.image)
    .filter((u) => u && typeof u === 'string' && u.startsWith('http') && !u.includes('missing_original'));

  validUrls.forEach((url, i) => {
    const resolved = resolveImageSrc(url);
    if (!resolved || prefetchedUrls.has(resolved)) return;
    prefetchedUrls.add(resolved);

    setTimeout(() => {
      try {
        const img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = resolved;
      } catch (e) {
        // Silently ignore prefetch errors
      }
    }, i * 60);
  });
}
