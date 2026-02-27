const CACHE_NAME = 'timerpro-v1';
const urlsToCache = [
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => console.log('Offline res:', event.request.url));
        })
    );
});