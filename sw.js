const CACHE_NAME = 'laapoa-member-v3';
const CACHE_URLS = [
  './',
  './index.html'
];

const MOUWISH_CACHE = 'mouwish-v1';
const MOUWISH_PRECACHE = [
  'https://laapoa.github.io/mouwish/viewer/?inapp=1',
  'https://mouwish-api.mike-a78.workers.dev/api/list'
];

// Install - cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS)),
      caches.open(MOUWISH_CACHE).then(cache =>
        Promise.all(MOUWISH_PRECACHE.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(res => cache.put(url, res))
            .catch(() => {})
        ))
      )
    ])
  );
  self.skipWaiting();
});

// Activate - clean old caches (keep current member + mouwish caches)
self.addEventListener('activate', event => {
  const keep = [CACHE_NAME, MOUWISH_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => keep.indexOf(k) < 0).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip API calls that should never be cached
  if (url.includes('script.google.com') || url.includes('api.ipify.org')) return;

  // MOU wishlist: stale-while-revalidate from dedicated cache
  const isMouwish =
    url.indexOf('laapoa.github.io/mouwish/') >= 0 ||
    url.indexOf('mouwish-api.mike-a78.workers.dev/api/list') >= 0;

  if (isMouwish) {
    event.respondWith(
      caches.open(MOUWISH_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fresh = fetch(event.request)
            .then(res => {
              if (res && (res.ok || res.type === 'opaque')) {
                cache.put(event.request, res.clone());
              }
              return res;
            })
            .catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Default: network first, fall back to cache (original behavior)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
