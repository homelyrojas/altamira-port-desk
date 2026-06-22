const CACHE_NAME = "altamira-port-desk-v090";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./registros.css",
  "./registros.js",
  "./manifest.json",
  "./version.json",
  "./directory.json",
  "./questions.json",

  "./buques.html",
  "./buques.css",
  "./buques.js",

  "./arribos-zarpes.html",
  "./arribos-zarpes.css",
  "./arribos-zarpes.js",

  "./proximos-buques.html",
  "./proximos-buques.css",
  "./proximos-buques.js",

  "./directorio.html",
  "./directorio.css",
  "./directorio.js",

  "./prestadores.html",
  "./prestadores.css",
  "./prestadores.js",
  "./prestadores.json",

  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
