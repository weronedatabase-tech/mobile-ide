const CACHE_NAME = 'ide-network-first-v2'; // Updated version
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    'https://cdn.tailwindcss.com'
];

// 1. INSTALL: Cache assets but force activation immediately
self.addEventListener('install', e => {
    self.skipWaiting(); // Skip the "waiting" phase to update immediately
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

// 2. ACTIVATE: Clean up old caches from previous versions
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        )).then(() => self.clients.claim()) // Take control of all open tabs immediately
    );
});

// 3. FETCH: NETWORK FIRST STRATEGY
// Always try the Network first. If successful, update the cache.
// If Network fails (Offline), use the Cache.
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request)
            .then(res => {
                // If the response is valid, clone it and update the cache
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() => {
                // Network failed (Offline), return cached version
                return caches.match(e.request);
            })
    );
});
