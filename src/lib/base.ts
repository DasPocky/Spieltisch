/**
 * Basispfad für Anfragen: Der Code ruft weiter „/api/…“ auf, beim App-Start kommt hier einmal für alle der Basispfad
 * davor (auch für künftigen Code, ohne dass jede Stelle daran denken muss). Ohne Basispfad passiert nichts.
 */
import { BASE, withBase } from "@shared/platform/base";

export function installBase(base = BASE) {
  if (!base || typeof window === "undefined" || (window.fetch as { base?: string }).base) return;
  const plain = window.fetch.bind(window);
  const fix = (u: string) => (u.startsWith("/api/") || u === "/api" ? withBase(u, base) : u);
  const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") return plain(fix(input), init);
    if (input instanceof URL) {
      if (input.origin === location.origin && input.pathname.startsWith("/api/")) { const u = new URL(input); u.pathname = withBase(u.pathname, base); return plain(u, init); }
      return plain(input, init);
    }
    const u = new URL(input.url);
    if (u.origin === location.origin && u.pathname.startsWith("/api/")) { u.pathname = withBase(u.pathname, base); return plain(new Request(u, input), init); }
    return plain(input, init);
  }) as typeof fetch & { base?: string };
  wrapped.base = base;
  window.fetch = wrapped;
}

/** Service Worker dieser App: eigener Bereich (unter endlab.de liegen auch andere Projekte und die Startseite) */
export const SW_URL = withBase("/sw.js");
export const SW_SCOPE = withBase("/");
export const ownsRegistration = (r: ServiceWorkerRegistration) => new URL(r.scope).pathname === SW_SCOPE;
