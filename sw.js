const CACHE_NAME = "roadtrip-cache-v9";

const PRECACHE_URLS = [
  "index.html",
  "itinerary.html",
  "charging.html",
  "vegas.html",
  "info.html",
  "expenses.html",
  "photos.html",
  "css/style.css",
  "js/accessibility.js",
  "js/nav.js",
  "js/transitions.js",
  "js/charging.js",
  "js/rotation.js",
  "js/soc.js",
  "js/vegas.js",
  "js/info.js",
  "js/expenses.js",
  "js/photos.js",
  "js/maps-link.js",
  "js/countdown.js",
  "js/trip-data.js",
  "js/today.js",
  "js/weather.js",
  "js/sw-register.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Google Fonts etc. to the network

  const isHtml = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    // network-first: fresh content when online, cached page when offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("index.html")))
    );
    return;
  }

  // cache-first for css/js: fast repeat loads, refreshed whenever the cache version bumps
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      });
    })
  );
});
