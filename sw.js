// UTMB Training Coach — Service Worker
// Caches the app for full offline use (flights, mountains, no signal)

const CACHE_NAME = 'utmb-coach-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap',
  'https://fonts.gstatic.com'
];

// Install: cache everything
self.addEventListener('install', event => {
  console.log('[SW] Installing UTMB Coach service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache core files — fonts may fail if offline at install time, that's OK
      return cache.addAll(['./', './index.html', './manifest.json']).catch(err => {
        console.log('[SW] Some files failed to cache (OK if offline):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network, cache new responses
self.addEventListener('fetch', event => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve cached version immediately
        // Also fetch fresh version in background and update cache
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => cached); // stay on cached if network fails
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Totally offline and not cached — return offline page if it's a navigation
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
