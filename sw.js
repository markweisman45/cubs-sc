// Cubs S&C Program — service worker
// Caches the page shell (HTML/fonts/icons) for offline access. Live program
// data always goes to the network first — an athlete's actual workout data
// should never be served stale from cache when a connection is available.
const CACHE_NAME = 'cubs-sc-program-v2';
const SHELL_ASSETS = [
  './program.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_ASSETS).catch(function(err) {
        console.warn('[SW] Some shell assets failed to cache:', err);
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Never intercept Supabase API calls — a coach's edits should always reach
  // the athlete on next load, not get served from a stale cached response.
  if (url.indexOf('supabase.co') !== -1) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      // Cache-first for static assets: instant load, then quietly refresh
      // the cache in the background for next time.
      var networkFetch = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function() {
        // Offline and this exact request was never cached — for a page
        // navigation, fall back to the cached shell rather than a browser
        // error page.
        if (event.request.mode === 'navigate') {
          return caches.match('./program.html');
        }
      });

      return cached || networkFetch;
    })
  );
});
