/**
 * Service Worker für „Als App installieren“: Seiten immer frisch aus dem Netz (damit Updates sofort da sind),
 * nur ohne Netz aus dem Zwischenspeicher. Räume (/api) und WebSockets laufen nie über den Cache.
 */
const CACHE = "spieltisch-v1";

/** Beim Installieren alle Dateien der Seite mitnehmen (Liste entsteht beim Bauen) – Fehler sind egal, dann eben beim Benutzen */
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(precache());
});

async function precache() {
  try {
    const files = await (await fetch("/precache.json", { cache: "no-store" })).json();
    const c = await caches.open(CACHE);
    const missing = [];
    for (const f of files) if (!(await c.match(f, { ignoreVary: true }))) missing.push(f);
    // Dateien alter Versionen aufräumen
    const keep = new Set(files);
    for (const req of await c.keys()) { const path = new URL(req.url).pathname; if (path.startsWith("/assets/") && !keep.has(path)) await c.delete(req); }
    // Einzeln, damit eine fehlende Datei nicht alles abbricht
    await Promise.all(missing.map((f) => fetch(f).then((res) => (res.ok ? c.put(f, res) : null)).catch(() => null)));
    await fetch("/").then((res) => (res.ok ? c.put("/", res) : null)).catch(() => null);
  } catch { /* offline oder alte Version ohne Liste */ }
}
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

/** Neue Version gebaut: die Seite meldet sich nach dem Laden – dann fehlende Dateien nachladen */
self.addEventListener("message", (e) => { if (e.data === "precache") e.waitUntil(precache()); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Gebaute Dateien haben einen Hash im Namen und ändern sich nie – einmal laden, dann aus dem Cache
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req, { ignoreVary: true, ignoreSearch: true })) ?? fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
    return;
  }
  // Seiten: zuerst Netz, sonst die zuletzt geladene Startseite
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put("/", res.clone()));
      return res;
    }).catch(async () => (await caches.match("/", { ignoreVary: true })) ?? Response.error()));
  }
});
