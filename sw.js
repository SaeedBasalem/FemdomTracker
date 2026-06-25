/* ==========================================================================
 * sw.js — service worker for offline use & installability.
 *
 * Strategy:
 *   • Precache the app shell on install.
 *   • Navigations  -> network-first, fall back to cached index.html (offline).
 *   • Other assets -> stale-while-revalidate (instant from cache, refresh in bg).
 *
 * All paths are RELATIVE so this works whether the app is served from a
 * domain root or a project subpath like /FemdomTracker/.
 * Bump VERSION to force a clean cache refresh.
 * ======================================================================== */
const VERSION = 'v1';
const CACHE = 'ft-cache-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/core.js',
  './js/stats.js',
  './js/charts.js',
  './js/views.js',
  './js/report.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin (there are none)

  // App navigations: try the network, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: serve cached immediately, update the cache in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
