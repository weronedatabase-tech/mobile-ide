const CACHE_NAME = 'ide-v5-fix'; // Updated version
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
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
    // THE FIX: Ignore API calls (POST) and let them go straight to the network
    if (e.request.method !== 'GET') {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then(res => {
                // Cache valid GET responses
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() => {
                // If offline, try cache
                return caches.match(e.request);
            })
    );
});
