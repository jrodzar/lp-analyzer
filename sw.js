// Service Worker mínimo — sin caché agresivo, sin handler de fetch.
//
// Existe solo para que Chrome marque la PWA como "installable". Antes hacía
// falta declarar un listener "fetch" aunque fuera no-op, pero Chrome ahora lo
// considera overhead innecesario y emite un warning en consola: "Fetch event
// handler is recognized as no-op". Modernamente basta con install + activate;
// si en el futuro queremos modo offline, añadir un fetch listener con
// estrategia real (network-first con cache fallback).
//
// NO cacheamos los HTML/JS porque queremos que cada apertura traiga la última
// versión deployada (la app tira de APIs externas, no funciona offline).

self.addEventListener("install", () => {
  self.skipWaiting(); // activar inmediatamente, sin "waiting"
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim()); // controlar páginas abiertas ya
});
