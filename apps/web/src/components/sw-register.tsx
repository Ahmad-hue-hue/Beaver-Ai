'use client';

import { useEffect } from 'react';

/** Registers the app-shell service worker. Include once in the root providers. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          /* SW registration is best-effort; offline won't work but app stays functional. */
        });

      // When a newer service worker (and therefore newer app bundle) takes control,
      // hard-refresh once. Combined with skipWaiting+clients.claim in the SW this
      // guarantees a phone can never stay stuck on an old cached version.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  return null;
}