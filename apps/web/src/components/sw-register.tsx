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
    }
  }, []);

  return null;
}