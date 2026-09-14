// Beaver — lightweight app-shell service worker.
//
// Strategy:
//  - Navigation (HTML): network first, fallback to cached /login (offline shell).
//  - Static assets (/_next/*, JS/CSS/icons): cache first, runtime fill.
//  - API / other: network only (auth-bound, never cache).
//
// The CACHE_NAME must be bumped on deploy to invalidate the shell cache.

const CACHE_NAME = 'beaver-shell-v5';

// Minimal offline shell: the root, manifest, and the boot script. The login page
// is deliberately NOT cached so an offline blip can never resurrect a stale
// pre-install copy of the app for the user.
const SHELL = ['/', '/manifest.webmanifest', '/theme-init.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Navigation requests: network first, offline fallback to the cached root
  // (a minimal branded offline page — never a stale copy of a real screen).
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match(request).then((c) => c || caches.match('/'))),
    );
    return;
  }

  // Static hashed assets and known static files: cache first.
  if (
    request.url.includes('/_next/') ||
    request.url.includes('/theme-init.js') ||
    request.url.match(/\.(?:js|css|png|ico|svg|webp|woff2?)$/)
  ) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (API / fonts from third-party): network only.
});
