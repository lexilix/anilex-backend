// In production, VITE_API_URL points to the cloud backend (Render).
// In development, it defaults to empty string to use Vite's proxy (/api -> localhost:3001).
export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://anilex-backend.onrender.com' : '')
).replace(/\/+$/, '');

/**
 * Builds a full API URL given a relative or absolute path.
 * e.g. apiUrl('/api/auth/login') -> 'https://anilex-backend.onrender.com/api/auth/login'
 */
export const apiUrl = (endpoint) => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${path}`;
};

/**
 * Returns proxy image URL for external anime posters to bypass hotlinking / referrer restrictions.
 */
export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  // Local static image paths should be served directly by the web host
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  return apiUrl(`/api/proxy-image?url=${encodeURIComponent(url)}`);
};
