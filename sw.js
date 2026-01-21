const CACHE_NAME = 'ide-v1';
const ASSETS = ['./', './index.html', './app.js', './manifest.json', 'https://cdn.tailwindcss.com'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(response => response || fetch(e.request))));
self.addEventListener('message', e => { if (e.data.action === 'skipWaiting') self.skipWaiting(); });
