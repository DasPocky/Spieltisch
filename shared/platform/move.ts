/**
 * Umzug von endlab.de/spieltisch nach spieltisch.endlab.de.
 *
 * Browser trennen den Speicher je Adresse. Die alte Adresse liefert deshalb eine kleine Seite aus (worker/move.ts),
 * die alle Einträge mit dem Präfix „spieltisch:“ einpackt und im Anker (#umzug=…) mitschickt. Der Anker geht nie an
 * einen Server. Die neue Adresse packt ihn vor allem anderen aus (src/lib/moveIn.ts) und entfernt ihn sofort.
 */
export const MOVE_PREFIX = "spieltisch:";
export const MOVE_PARAM = "umzug";
/** Ist das Profil schon da, bleibt alles, wie es ist – nie zwei Geräte-Stände mischen */
export const MOVE_ANCHOR = "spieltisch:profile";
/** Einträge darüber bleiben zurück (Zwischenspeicher wie Kartensets, die sich selbst neu laden) */
export const MOVE_MAX_VALUE = 50_000;

/** base64url aus UTF-8 */
export function encodeMove(data: Record<string, string>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gegenstück zu encodeMove; alles, was nicht passt, ergibt null */
export function decodeMove(text: string): Record<string, string> | null {
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith(MOVE_PREFIX) && typeof v === "string" && v.length <= MOVE_MAX_VALUE) out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Was aus dem Umzug übernommen wird: nichts, wenn hier schon ein Profil liegt; sonst nur fehlende Einträge */
export function movePlan(data: Record<string, string>, has: (key: string) => boolean): [string, string][] {
  if (has(MOVE_ANCHOR)) return [];
  return Object.entries(data).filter(([k]) => !has(k));
}

/** Erste Adresse auf workers.dev: Dort liefert Cloudflare die Seite ohne Worker aus, also zieht die App selbst um */
export const MOVE_FROM_HOST = "spieltisch.bjoern-ef9.workers.dev";
export const MOVE_HOME = "https://spieltisch.endlab.de";

/** Wohin die App von der alten Adresse aus geht – samt aller Spieltisch-Einträge im Anker; sonst null */
export function moveOutTarget(loc: { hostname: string; pathname: string; search: string }, storage: { length: number; key(i: number): string | null; getItem(k: string): string | null }): string | null {
  if (loc.hostname !== MOVE_FROM_HOST) return null;
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k?.startsWith(MOVE_PREFIX)) continue;
    const v = storage.getItem(k);
    if (v !== null && v.length <= MOVE_MAX_VALUE) data[k] = v;
  }
  const hash = Object.keys(data).length ? `#${MOVE_PARAM}=${encodeMove(data)}` : "";
  return `${MOVE_HOME}${loc.pathname}${loc.search}${hash}`;
}
