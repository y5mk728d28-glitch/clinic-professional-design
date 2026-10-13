const CACHE_NAME = 'cpd-cache-v4';
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
//
// Esto SOLO debe aplicar a los archivos de la app (HTML/CSS/JS propios).
// Las llamadas reales al backend (login, registro, recuperar contraseña,
// cualquier fetch a Supabase) son de otro origen y casi siempre no son GET
// — la Cache API ni siquiera admite guardar algo que no sea GET. Si las
// dejábamos pasar por esta misma lógica, un fallo al intentar cachearlas
// hacía que la petición real nunca se completara (por eso no llegaba el
// correo de recuperación). Así que esas se dejan pasar sin tocar.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return response;
      })
      .catch(() => caches.match(req))
  );
});
