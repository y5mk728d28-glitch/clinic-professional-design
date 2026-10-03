const CACHE_NAME = 'cpd-cache-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/i18n.js',
  './js/db.js',
  './js/supabaseClient.js',
  './js/calendar.js',
  './js/config.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Red primero, caché solo como respaldo sin internet. Antes era al revés
// (caché primero) y eso significaba que cualquier cambio nuevo que
// publicáramos nunca le llegaba a quien ya tenía la app instalada, sin
// importar cuántas veces le diera "refrescar". Con esto, mientras haya
// internet (que esta app siempre necesita, por el backend real) se ve
// siempre la última versión.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
