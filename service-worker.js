const CACHE_NAME = "altamira-port-desk-v070";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./registros.css",
  "./registros.js",
  "./manifest.json",
  "./directory.json",
  "./questions.json",
  "./directorio.html",
  "./directorio.css",
  "./directorio.js",
  "./prestadores.html",
  "./prestadores.css",
  "./prestadores.js",
  "./prestadores.json",
  "./buques.html",
  "./buques.css",
  "./buques.js",
  "./arribos-zarpes.html",
  "./arribos-zarpes.css",
  "./arribos-zarpes.js",
  "./proximos-buques.html",
  "./proximos-buques.css",
  "./proximos-buques.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(asset => cache.add(asset)))
    )
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
