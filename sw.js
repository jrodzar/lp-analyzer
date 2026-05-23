// Service Worker mínimo — sin caché agresivo.
//
// Existe solo para que Chrome marque la PWA como "installable" (criterio antiguo
// que aún ayuda a que aparezca el icono "Instalar app" en la barra de URL). NO
// cacheamos los HTML/JS porque queremos que cada apertura traiga la última
// versión deployada (la app tira de APIs externas, no funciona offline).
//
// Si en el futuro queremos modo offline, cambiar el listener "fetch" por una
// estrategia "network-first" con fallback a cache. Por ahora, solo dejamos que
// el navegador siga su camino normal.

self.addEventListener("install", () => {
  self.skipWaiting(); // activar inmediatamente, sin "waiting"
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim()); // controlar páginas abiertas ya
});

// fetch sin interceptar → el navegador hace la petición como siempre.
// (Tener este listener registrado es lo que hace que el SW cuente como "activo".)
self.addEventListener("fetch", () => { /* passthrough */ });
