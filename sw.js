// Bump VERSION in the same commit as any change to a precached file —
// the byte-diff is what makes browsers install the new worker and show
// the update banner (see js/sw-register.js). Stale charging data is worse
// than no data on this trip, so this is enforced in CLAUDE.md.
const VERSION = "v12";
const CACHE_NAME = "roadtrip-" + VERSION;

// All URLs relative to this file so everything resolves under the
// GitHub Pages subpath (/road-trip-site/), never the domain root.
const PRECACHE_URLS = [
  "index.html",
  "itinerary.html",
  "charging.html",
  "vegas.html",
  "info.html",
  "expenses.html",
  "photos.html",
  "manifest.webmanifest",
  "css/style.css",
  "css/fonts.css",
  "fonts/anton-400.woff2",
  "fonts/dmmono-400.woff2",
  "fonts/dmmono-500.woff2",
  "fonts/inter-var.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
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
  "js/print.js",
  "js/sw-register.js",
  "js/sync.js",
];

self.addEventListener("install", (event) => {
  // No skipWaiting(): the new worker stays waiting until the user taps the
  // update banner, so content never swaps out from under someone mid-read.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function broadcast(msg) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage(msg));
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Open-Meteo is NEVER cached here — weather.js keeps its own localStorage
  // copy with a 6h expiry, and a service-worker copy would silently serve
  // stale forecasts with no expiry at all.
  if (url.hostname === "api.open-meteo.com") return;

  // Other cross-origin requests go straight to the network. This includes
  // the Supabase sync RPC (*.supabase.co) — js/sync.js has its own offline
  // queue in localStorage, and caching sync responses here would defeat it.
  if (url.origin !== self.location.origin) return;

  // App shell: serve from cache instantly, revalidate in the background when
  // a connection exists. On flaky 1-bar signal this avoids hanging on the
  // network the way network-first would.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networked = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            broadcast({ type: "REVALIDATED", at: Date.now() });
          }
          return res;
        })
        .catch(() => undefined);

      if (cached) return cached;

      return networked.then((res) => {
        if (res) return res;
        // Offline navigation to a page we somehow don't have: fall back to home.
        if (req.mode === "navigate") return caches.match("index.html");
        return Response.error();
      });
    })
  );
});
