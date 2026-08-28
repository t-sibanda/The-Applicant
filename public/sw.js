/* The Applicant service worker.
 * Strategy:
 *  - Never touch /api/* (always live network so data is fresh + secure).
 *  - Static assets (JS/CSS/fonts/images): cache-first, fast repeat loads.
 *  - Navigations (HTML): network-first with a cached shell fallback so the
 *    installed app still opens when offline.
 */
const VERSION = "v1";
const SHELL_CACHE = `ta-shell-${VERSION}`;
const ASSET_CACHE = `ta-assets-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API traffic.
  if (url.pathname.startsWith("/api/")) return;

  // Only handle same-origin GETs; let the browser deal with cross-origin.
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
