// Persistent Client-Side IndexedDB & Memory Cache for User Avatars & Banners
// Ensures media is downloaded at most ONCE, never lost on reload/reopen,
// and automatically invalidated when URL changes (version hash / timestamp).

const DB_NAME = 'anilex_user_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'user_media_blobs';

let dbPromise = null;
const memoryBlobUrlCache = new Map(); // url -> objectUrl string
const pendingFetches = new Map(); // url -> Promise<string>

function openDatabase() {
  if (dbPromise) return dbPromise;
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onerror = (err) => {
        console.warn('IndexedDB open error in userMediaCache:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('Failed to initialize IndexedDB for user media:', e);
      resolve(null);
    }
  });

  return dbPromise;
}

async function getFromIndexedDB(url) {
  try {
    const db = await openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => {
        const result = req.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveToIndexedDB(url, blob) {
  try {
    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ url, blob, timestamp: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    // ignore quota errors or private mode failures
  }
}

/**
 * Retrieves a persistent, fast-loading URL (Object URL or original URL)
 * for a user avatar or banner.
 *
 * 1. Returns from RAM instantly if present (0 ms).
 * 2. Checks IndexedDB; if found, creates ObjectURL, caches in RAM, and returns.
 * 3. If missing, fetches with cache: 'force-cache', persists to IndexedDB, caches in RAM, and returns.
 */
export async function getCachedMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  
  // Data URLs or Blob URLs are already local
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  // Strip fragment (#top5=...) for caching the actual image asset
  const [cleanUrl] = rawUrl.split('#');

  // 1. RAM Cache check
  if (memoryBlobUrlCache.has(cleanUrl)) {
    return memoryBlobUrlCache.get(cleanUrl);
  }

  // Deduplicate in-flight fetches
  if (pendingFetches.has(cleanUrl)) {
    return pendingFetches.get(cleanUrl);
  }

  const fetchPromise = (async () => {
    try {
      // 2. Check IndexedDB
      const cachedBlob = await getFromIndexedDB(cleanUrl);
      if (cachedBlob) {
        const objectUrl = URL.createObjectURL(cachedBlob);
        memoryBlobUrlCache.set(cleanUrl, objectUrl);
        return objectUrl;
      }

      // 3. Network fetch (with HTTP cache force-cache)
      const res = await fetch(cleanUrl, {
        cache: 'force-cache',
        mode: 'cors'
      });

      if (!res.ok) {
        // Fallback to original URL on network/HTTP error
        return cleanUrl;
      }

      const blob = await res.blob();
      await saveToIndexedDB(cleanUrl, blob);
      const objectUrl = URL.createObjectURL(blob);
      memoryBlobUrlCache.set(cleanUrl, objectUrl);
      return objectUrl;
    } catch (err) {
      // Offline fallback: if fetch fails, return cleanUrl
      return cleanUrl;
    } finally {
      pendingFetches.delete(cleanUrl);
    }
  })();

  pendingFetches.set(cleanUrl, fetchPromise);
  return fetchPromise;
}

/**
 * Synchronous read from RAM cache if already resolved.
 * Allows instant first render without a flicker if previously fetched.
 */
export function getSyncCachedMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
  const [cleanUrl] = rawUrl.split('#');
  return memoryBlobUrlCache.get(cleanUrl) || null;
}

/**
 * Remove an item from IndexedDB and RAM cache (used when user uploads a new image with identical URL).
 */
export async function invalidateMediaCache(rawUrl) {
  if (!rawUrl) return;
  const [cleanUrl] = rawUrl.split('#');
  if (memoryBlobUrlCache.has(cleanUrl)) {
    try {
      URL.revokeObjectURL(memoryBlobUrlCache.get(cleanUrl));
    } catch (e) {}
    memoryBlobUrlCache.delete(cleanUrl);
  }
  try {
    const db = await openDatabase();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(cleanUrl);
    }
  } catch (e) {}
}
