// Centralized API configuration with Multi-Host Failover and Server Offline Resilience

const PRIMARY_SERVER = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://anilex-backend.onrender.com' : '')
).replace(/\/+$/, '');

const MIRROR_SERVER = (
  (typeof window !== 'undefined' && localStorage.getItem('anilex_backend_mirror')) ||
  import.meta.env.VITE_MIRROR_API_URL ||
  ''
).replace(/\/+$/, '');

let currentActiveBase = PRIMARY_SERVER;
let isServerCurrentlyOffline = false;

export function getActiveApiBase() {
  return currentActiveBase;
}

export function setActiveApiBase(url) {
  currentActiveBase = (url || PRIMARY_SERVER).replace(/\/+$/, '');
}

/**
 * Builds a full API URL given a relative or absolute path.
 */
export const apiUrl = (endpoint, useBase = null) => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const base = useBase !== null ? useBase : currentActiveBase;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

/**
 * Returns proxy image URL for external anime posters.
 */
export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  return apiUrl(`/api/proxy-image?url=${encodeURIComponent(url)}`);
};

/**
 * Human-friendly error translation for network/503/cold-start issues.
 */
export function getFriendlyErrorMessage(err) {
  const msg = err?.message || String(err || '');
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('Load failed') ||
    msg.includes('Unexpected token') ||
    msg.includes('Service Suspended')
  ) {
    return 'Сервер бэкенда временно «спит» или недоступен (Render 503). Все ваши аккаунты и оценки сохранены в безопасности. Подождите 30–60 секунд и повторите попытку.';
  }
  return msg || 'Произошла непредвиденная ошибка';
}

/**
 * Resilient fetch with mirror failover and server status notification
 */
export async function apiFetch(endpoint, options = {}, retries = 1) {
  const url = apiUrl(endpoint);

  try {
    const res = await fetch(url, options);

    // If server returned 503 / 502 / Service Suspended
    if (res.status === 503 || res.status === 502) {
      if (!isServerCurrentlyOffline) {
        isServerCurrentlyOffline = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('server-status-change', { detail: { offline: true, status: res.status } }));
        }
      }

      // Try mirror server if available
      if (MIRROR_SERVER && currentActiveBase !== MIRROR_SERVER) {
        console.warn(`Primary server returned ${res.status}. Failing over to mirror:`, MIRROR_SERVER);
        currentActiveBase = MIRROR_SERVER;
        return apiFetch(endpoint, options, 0);
      }

      throw new Error(`Сервер временно недоступен (${res.status}). Все ваши аккаунты сохранены.`);
    }

    // Success response: restore server status
    if (isServerCurrentlyOffline) {
      isServerCurrentlyOffline = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('server-status-change', { detail: { offline: false } }));
      }
    }

    return res;
  } catch (err) {
    // If it was a network error and we have retries left
    if (retries > 0 && (err.name === 'TypeError' || err.message?.includes('Failed to fetch'))) {
      await new Promise((r) => setTimeout(r, 1500));
      return apiFetch(endpoint, options, retries - 1);
    }

    if (!isServerCurrentlyOffline) {
      isServerCurrentlyOffline = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('server-status-change', { detail: { offline: true, error: err.message } }));
      }
    }

    throw err;
  }
}

export const API_BASE = PRIMARY_SERVER;
