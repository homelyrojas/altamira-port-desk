const CACHE_NAME = "altamira-port-desk-v098";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./version.json",
  "./directory.json",
  "./questions.json",
  "./registros.js",
  "./registros.css",
  "./buques.html",
  "./buques.css",
  "./buques.js",
  "./arribos-zarpes.html",
  "./arribos-zarpes.css",
  "./arribos-zarpes.js",
  "./proximos-buques.html",
  "./proximos-buques.css",
  "./proximos-buques.js",
  "./schematic.html",
  "./schematic.css",
  "./schematic.js",
  "./prestadores.html",
  "./prestadores.css",
  "./prestadores.js",
  "./prestadores.json",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./directorio.html",
  "./directorio.css",
  "./directorio.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
