/**
 * Service Worker für „Als App installieren“: Seiten immer frisch aus dem Netz (damit Updates sofort da sind),
 * nur ohne Netz aus dem Zwischenspeicher. Räume (/api) und WebSockets laufen nie über den Cache.
 */
const CACHE = "spieltisch-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Gebaute Dateien haben einen Hash im Namen und ändern sich nie – einmal laden, dann aus dem Cache
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
    return;
  }
  // Seiten: zuerst Netz, sonst die zuletzt geladene Startseite
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put("/", res.clone()));
      return res;
    }).catch(async () => (await caches.match("/")) ?? Response.error()));
  }
});
