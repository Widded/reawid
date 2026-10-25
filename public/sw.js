// Reawid Service Worker - Apple Minimalist PWA
// Network-First strategy to ensure latest updates are immediately reflected
const CACHE_NAME = 'reawid-cloud-v25';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/reawid-logo.svg',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Purge all old caches on all devices
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bypass AI API & Supabase cloud calls, non-http, and POST requests
  if (
    event.request.url.includes('api.groq.com') ||
    event.request.url.includes('openrouter.ai') ||
    event.request.url.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-First: Always fetch freshest files from server first!
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache ONLY if completely offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
