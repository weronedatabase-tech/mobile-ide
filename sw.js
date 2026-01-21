const CACHE_NAME = 'ide-network-first-v3'; // Bump version to v3 to force update
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192.png',  // <-- Added
    './icon-512.png',  // <-- Added
    'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() => {
                return caches.match(e.request);
            })
    );
});
