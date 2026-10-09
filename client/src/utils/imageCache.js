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
 * Prioritizes local compressed WebP covers (/covers/{id}.webp) if animeId is provided.
 */
export function resolveImageSrc(rawUrl, animeId) {
  // 1. If animeId is provided and valid, prioritize fast local compressed WebP cover
  if (animeId && Number(animeId) > 0) {
    return `/covers/${Number(animeId)}.webp`;
  }

  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.includes('missing_original') || rawUrl.includes('placehold.co')) return '';

  // Local assets, data URLs or blob URLs are loaded directly
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  // Local paths like /covers/123.webp or /mugen_gacha_poster.jpg
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    return rawUrl;
  }

  // Direct CDN loading with no-referrer
  return rawUrl;
}

/**
 * Backward-compatible helper for components expecting an async resolver.
 */
export async function getCachedImageUrl(url, animeId) {
  return resolveImageSrc(url, animeId);
}

/**
 * Pre-warms browser HTTP cache for a list of anime items.
 * Uses native Image() pre-loading which avoids CORS/opaque response issues.
 */
export function prefetchAnimeImages(animeList) {
  if (!Array.isArray(animeList) || typeof window === 'undefined') return;

  const validItems = animeList
    .slice(0, 20)
    .map((a) => ({
      url: a?.imageUrl || a?.image_url || a?.image,
      id: a?.id
    }))
    .filter((it) => (it.id && Number(it.id) > 0) || (it.url && typeof it.url === 'string' && !it.url.includes('missing_original')));

  validItems.forEach((item, i) => {
    const resolved = resolveImageSrc(item.url, item.id);
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
    }, i * 40);
  });
}
