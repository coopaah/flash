const CACHE_NAME = 'flash-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/sites.json',
  '/flashtags/',
  '/flashtags',
  '/offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
