const CACHE_NAME = 'cpd-cache-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

// Borra cualquier caché de versiones anteriores del service worker (de
// cuando sí intentábamos guardar archivos en caché) para no dejar basura
// ocupando espacio en el teléfono de nadie.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// A propósito esto NO intenta guardar nada en caché ni inventar una
// respuesta de respaldo — cada intento de hacerlo (primero caché-primero,
// luego red-con-respaldo-en-caché) terminó rompiendo peticiones reales
// (login, registro, recuperar contraseña) en Safari/iOS: en cuanto un
// fetch fallaba por cualquier motivo y no había nada guardado para ese
// archivo, devolvíamos "nada" (undefined) como respuesta, y eso es
// justo lo que provoca el error "FetchEvent.respondWith received an
// error: Returned response is null". Esta app siempre necesita internet
// de todas formas (por el backend real), así que no hay beneficio real en
// un respaldo de caché — solo dejamos pasar la petición directo a la red.
// Esto también cumple el requisito técnico de "tener un fetch handler"
// para que la app se pueda instalar como PWA.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
