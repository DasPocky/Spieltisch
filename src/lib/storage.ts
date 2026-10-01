/** Kleine Helfer rund um localStorage – alles in try/catch, weil Storage fehlen kann. */

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* voll oder gesperrt */ }
}

export function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* egal */ }
}

export interface RoomCreds { playerId: string; token: string }
export const credsKey = (code: string) => `spieltisch:room:${code}`;
export const NAME_KEY = "spieltisch:name";
/** Zuletzt online gewähltes Spiel – damit ist ein neuer Raum gleich richtig vorbelegt */
export const LAST_GAME_KEY = "spieltisch:lastGame";

/** Beim Erstellen/Beitreten übergibt die Startseite Name und PIN einmalig an den Raum. */
export const pendingKey = (code: string) => `spieltisch:pending:${code}`;
export function setPendingJoin(code: string, join: { name: string; pin: string }) {
  try { sessionStorage.setItem(pendingKey(code), JSON.stringify(join)); } catch { /* egal */ }
}
export function takePendingJoin(code: string): { name: string; pin: string } | null {
  try {
    const raw = sessionStorage.getItem(pendingKey(code));
    sessionStorage.removeItem(pendingKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Lokaler Spielstand pro Spiel */
export const localKey = (gameId: string) => `spieltisch:local:${gameId}`;
