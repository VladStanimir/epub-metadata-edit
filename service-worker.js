const CACHE_NAME = 'epub-editor-cache-v2';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;

    if (request.method !== 'GET') return;

    event.respondWith(
        fetch(request)
            .then(response => {
                const responseCopy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, responseCopy));
                return response;
            })
            .catch(() => caches.match(request))
    );
});
