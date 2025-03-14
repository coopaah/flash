const CACHE_NAME = 'flash-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/results.html',
  '/results',
  '/offline.html',
  '/script.js',
  '/sites.json',
  '/logo.png',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'INSTALL_COMPLETE' }));
        });
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/' && url.searchParams.has('f')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
});
