/**
 * Frühere Adresse endlab.de/spieltisch: Seiten ziehen samt Daten auf dem Gerät
 * nach spieltisch.endlab.de um (siehe shared/platform/move.ts). Dateien und /api bedient der Worker dort weiter, damit
 * offene Tabs nicht brechen.
 */
import { MOVE_MAX_VALUE, MOVE_PARAM, MOVE_PREFIX } from "../shared/platform/move";

export const OLD_HOST = "endlab.de";
export const HOME = "https://spieltisch.endlab.de";

/** Host, von dem Spieltisch umzieht */
export const isOldHost = (host: string) => host === OLD_HOST;

/** Seitenaufruf (nicht Datei, nicht fetch)? */
export function isNavigation(request: Request): boolean {
  if (request.method !== "GET") return false;
  const mode = request.headers.get("sec-fetch-mode");
  if (mode) return mode === "navigate";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

/** Seite, die den Speicher einpackt und weiterleitet. Ohne JavaScript bleibt der Link. */
export function movePage(target: string): Response {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const script = `(function(){var t=${JSON.stringify(target).replace(/</g, "\\u003c")},p=${JSON.stringify(MOVE_PREFIX)},m=${MOVE_MAX_VALUE},d={},n=0;
try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(p)===0){var v=localStorage.getItem(k);if(v!==null&&v.length<=m){d[k]=v;n++}}}}catch(e){}
if(n){var b=new TextEncoder().encode(JSON.stringify(d)),s="";for(var j=0;j<b.length;j++)s+=String.fromCharCode(b[j]);
t+="#${MOVE_PARAM}="+btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}
location.replace(t)})();`;
  const safe = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spieltisch ist umgezogen</title><meta name="robots" content="noindex"></head>
<body>
<p>Spieltisch ist umgezogen.</p><p><a href="${safe}">Weiter zu spieltisch.endlab.de</a></p>
<script nonce="${nonce}">${script}</script></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Service Worker der alten Adresse (nur wenn „Offline“ an war): ersetzt sich durch nichts, leert seinen Vorrat und
 * lädt offene Fenster neu – die landen dann auf der Umzugsseite.
 */
export function retireServiceWorker(): Response {
  const js = `self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil((async function(){
var ks=await caches.keys();await Promise.all(ks.filter(function(k){return k.indexOf("spieltisch")===0}).map(function(k){return caches.delete(k)}));
await self.registration.unregister();
var cs=await self.clients.matchAll({type:"window"});cs.forEach(function(c){c.navigate(c.url)});})())});`;
  return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
}
