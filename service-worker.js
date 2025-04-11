const CACHE_NAME = 'flash-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/script.js',
  '/sites.json',
  '/logo.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Helper function to parse flashtags from URL
const parseFlashtagFromUrl = async (url) => {
  try {
    const urlObj = new URL(url);
    const query = urlObj.searchParams.get('f');
    
    if (!query) return null;
    
    // Check if query has a flashtag format (term !tag)
    const match = query.match(/^(.*?)\s+!(\w+)$/);
    if (!match) return null;
    
    const [, searchTerm, tag] = match;
    
    // Get sites.json from cache to resolve the flashtag
    const cache = await caches.open(CACHE_NAME);
    const sitesResponse = await cache.match('/sites.json');
    
    if (!sitesResponse) return null;
    
    const sitesJson = await sitesResponse.json();
    const matchedSite = sitesJson.find(site => site.alias && site.alias.includes(tag));
    
    if (!matchedSite || !matchedSite.site) return null;
    
    // Return the target URL
    return new URL(matchedSite.site + encodeURIComponent(searchTerm));
  } catch (error) {
    console.error('Error parsing flashtag:', error);
    return null;
  }
};

// Fetch event with enhanced flashtag support
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle flashtag redirects even when offline
  if ((url.pathname === '/' || url.pathname === '/index.html') && url.searchParams.has('f')) {
    event.respondWith(
      (async () => {
        try {
          // Check if this is a flashtag query
          const redirectUrl = await parseFlashtagFromUrl(event.request.url);
          
          if (redirectUrl) {
            // If it's a valid flashtag, redirect to the target site
            return Response.redirect(redirectUrl.toString(), 302);
          }
          
          // If not a flashtag, try network first
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log('Network request failed, falling back to offline mode');
          
          // Try one more time to see if it's a flashtag
          const redirectUrl = await parseFlashtagFromUrl(event.request.url);
          
          if (redirectUrl) {
            return Response.redirect(redirectUrl.toString(), 302);
          }
          
          // Fall back to offline page if not a valid flashtag
          const cache = await caches.open(CACHE_NAME);
          return cache.match('/offline.html');
        }
      })()
    );
  } 
  // Handle results page with flashtag fallback
  else if (url.pathname === '/results' && url.searchParams.has('f')) {
    event.respondWith(
      (async () => {
        try {
          // Check for flashtag first
          const redirectUrl = await parseFlashtagFromUrl(event.request.url);
          
          if (redirectUrl) {
            return Response.redirect(redirectUrl.toString(), 302);
          }
          
          // If not a flashtag, try network first
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log('Network request failed for results page');
          
          // Check again for flashtag
          const redirectUrl = await parseFlashtagFromUrl(event.request.url);
          
          if (redirectUrl) {
            return Response.redirect(redirectUrl.toString(), 302);
          }
          
          // Fall back to offline page
          const cache = await caches.open(CACHE_NAME);
          return cache.match('/offline.html');
        }
      })()
    );
  } 
  // For sites.json, always try cache first to ensure flashtags work offline
  else if (url.pathname === '/sites.json') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request)
            .then(networkResponse => {
              return caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
                });
            });
        })
    );
  }
  // Normal caching strategy for other requests
  else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Cache hit - return the response
          if (response) {
            return response;
          }
          
          // Clone the request because it's a one-time use stream
          const fetchRequest = event.request.clone();
          
          return fetch(fetchRequest)
            .then(response => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response because it's a one-time use stream
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
                
              return response;
            }
          ).catch(error => {
            // Network request failed, try to return offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            return new Response('Network error', {
              status: 408,
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
        })
    );
  }
});

// Cache favicon responses
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Check if this is a favicon request from our API
  if (url.pathname.startsWith('/favicon/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => {
            // Return a transparent 1x1 pixel if network fails
            return new Response(
              new Blob([new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 68, 0, 59])], 
              { type: 'image/gif' }), 
              { status: 200, headers: { 'Content-Type': 'image/gif' } }
            );
          });
        });
      })
    );
  }
});

// Add background sync support for offline searches to be retried later
self.addEventListener('sync', event => {
  if (event.tag === 'retry-search') {
    event.waitUntil(
      // Logic to retry pending searches when online
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'online-retry',
            message: 'Network is back online!'
          });
        });
      })
    );
  }
});
