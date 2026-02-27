const CACHE_NAME = 'timerpro-cache-v3';

// Risorse da scaricare e salvare offline
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

// FASE 1: Installazione e Download nella Cache
self.addEventListener('install', event => {
    self.skipWaiting(); // Forza l'installazione immediata del nuovo aggiornamento
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Download risorse per uso Offline in corso...');
            return cache.addAll(urlsToCache);
        })
    );
});

// FASE 2: Attivazione e Pulizia della Vecchia Cache
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Se la cache non è quella attuale, eliminala per liberare spazio
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Vecchia cache eliminata:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Prendi sùbito il controllo dell'app
});

// FASE 3: Intercettazione di Rete (La magia Offline)
self.addEventListener('fetch', event => {
    // Ignora estensioni di Chrome e protocolli non-http
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then(response => {
            // 1. Se il file è salvato in cache, restituisci quello (velocissimo, funziona offline!)
            if (response) {
                return response;
            }

            // 2. Se non c'è, prova a scaricarlo da internet
            return fetch(event.request).then(networkResponse => {
                // Salva una copia in cache per la prossima volta che sei offline
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    let responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                console.warn('[Service Worker] Sei offline e questa risorsa non è salvata:', event.request.url);
            });
        })
    );
});

