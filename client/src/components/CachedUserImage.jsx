import React, { useState, useEffect } from 'react';
import { getCachedMediaUrl, getSyncCachedMediaUrl } from '../utils/userMediaCache';
import { getImageUrl } from '../api';

/**
 * CachedUserImage component:
 * Loads avatars and banners from client-side persistent storage (IndexedDB)
 * or RAM cache immediately, falling back to network fetch on first visit.
 * Eliminates redundant network downloads on reload / reopen.
 */
export const CachedUserImage = ({
  src,
  alt = '',
  className = '',
  style = {},
  fallback = null,
  onClick = undefined,
  loading = 'lazy'
}) => {
  const resolvedUrl = src ? getImageUrl(src) : '';
  const initialSrc = resolvedUrl ? (getSyncCachedMediaUrl(resolvedUrl) || resolvedUrl) : '';
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!resolvedUrl) {
      setCurrentSrc('');
      return;
    }

    let isMounted = true;
    setHasError(false);

    // Fast sync check
    const syncVal = getSyncCachedMediaUrl(resolvedUrl);
    if (syncVal) {
      setCurrentSrc(syncVal);
      return;
    }

    // Async IndexedDB / Network fetch
    getCachedMediaUrl(resolvedUrl).then((cachedOrOriginal) => {
      if (isMounted && cachedOrOriginal) {
        setCurrentSrc(cachedOrOriginal);
      }
    }).catch(() => {
      if (isMounted) {
        setCurrentSrc(resolvedUrl);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [resolvedUrl]);

  if (!resolvedUrl || hasError) {
    return fallback || null;
  }

  return (
    <img
      src={currentSrc || resolvedUrl}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      loading={loading}
      onError={() => {
        // If blob or custom URL failed, fall back to resolvedUrl or report error
        if (currentSrc !== resolvedUrl) {
          setCurrentSrc(resolvedUrl);
        } else {
          setHasError(true);
        }
      }}
    />
  );
};

export default CachedUserImage;
