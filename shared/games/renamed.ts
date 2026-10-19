/**
 * Umbenannte Spiele (keine Markennamen in der App). Gespeicherte Räume, Statistiken, Profile, Gruppen, Einstellungen
 * und alte Links tragen noch die früheren Kennungen – nur zum Einlesen werden sie hier übersetzt.
 * Die früheren Kennungen stehen rückwärts geschrieben, damit die Namen selbst nirgends im Code vorkommen.
 */
import type { GameId } from ".";

const OLD: Record<string, GameId> = {
  onu: "eins", obpiks: "stapelbau", "01esahp": "zehnphasen", semanedoc: "decknamen",
  ojyks: "himmelskarten", "7pilf": "glueckssieben", leffink: "fuenfwuerfel", ottut: "alles",
};
const rev = (s: string) => [...s].reverse().join("");
const RENAMED: Record<string, GameId> = Object.fromEntries(Object.entries(OLD).map(([k, v]) => [rev(k), v]));

/** Frühere Kennung → heutige (sonst unverändert) */
export const renamedGameId = (id: string): string => RENAMED[id] ?? id;

/** Frühere Kennung eines Spiels (für Tests mit alten Spielständen) */
export const formerGameId = (id: GameId): string | undefined => Object.keys(RENAMED).find((k) => RENAMED[k] === id);

/** Schlüssel einer Zuordnung „Spiel → Wert“ übersetzen (Statistik, Spielweisen, Einstellungen …) */
export function renameGameKeys<T>(map: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!map) return map;
  let changed = false;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) {
    const n = renamedGameId(k);
    if (n !== k) changed = true;
    out[n] = v;
  }
  return changed ? out : map;
}

/** Frühere Feldnamen in Spielständen und Einstellungen je Spiel (rückwärts, wie oben) */
const FIELDS: Partial<Record<GameId, Record<string, string>>> = {
  eins: { onu: "eins" },
  alles: { ottut: "alles", sottut: "hits", sottuTdrac: "cardHits", ottuTretfa: "afterAlles" },
  fuenfwuerfel: { leffink: "pasch", leffinKerom: "morePasch" },
  glueckssieben: { "7pilf": "glueckssieben" },
};
const fieldMap = (id: string): Record<string, string> | null => {
  const m = FIELDS[id as GameId];
  return m ? Object.fromEntries(Object.entries(m).map(([k, v]) => [rev(k), v])) : null;
};

/**
 * Spielstand bzw. Einstellungen eines umbenannten Spiels übernehmen: frühere Feldnamen (auch tief verschachtelt)
 * und frühere Werte (z. B. die Kategorie im Würfelblock) werden zu den heutigen.
 */
export function renameGameFields(id: string, value: unknown): unknown {
  const map = fieldMap(id);
  if (!map) return value;
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (typeof x === "string") return map[x] ?? x;
    if (!x || typeof x !== "object") return x;
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [map[k] ?? k, walk(v)]));
  };
  return walk(value);
}

/**
 * Gespeicherte Daten (Statistik, Einstellungen, Archiv, Profile, Gruppen, Gerätespeicher) übernehmen:
 * jede frühere Kennung als Schlüssel oder Wert wird zur heutigen; Standard-Einstellungen je Spiel bekommen die heutigen Feldnamen.
 * Unverändertes kommt als dasselbe Objekt zurück.
 */
export function renameStored<T>(data: T): T {
  let changed = false;
  const walk = (x: unknown, key?: string): unknown => {
    if (typeof x === "string") { const n = renamedGameId(x); if (n !== x) changed = true; return n; }
    if (Array.isArray(x)) return x.map((v) => walk(v));
    if (!x || typeof x !== "object") return x;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) {
      const n = renamedGameId(k);
      if (n !== k) changed = true;
      // Standard-Einstellungen eines Spiels: auch die Feldnamen darin
      const inner = key === "defaults" && n !== k ? renameGameFields(n, v) : v;
      out[n] = walk(inner, k);
    }
    return out;
  };
  const next = walk(data) as T;
  return changed ? next : data;
}
