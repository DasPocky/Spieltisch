/** Kleine Helfer rund um localStorage – alles in try/catch, weil Storage fehlen kann. */

/** Alle Schlüssel der App beginnen so */
export const KEY_PREFIX = "spieltisch:";

const store = (session: boolean) => (session ? sessionStorage : localStorage);

/** Text lesen (null, wenn nichts da oder Speicher gesperrt) */
export function readStr(key: string, session = false): string | null {
  try { return store(session).getItem(key); } catch { return null; }
}

/** Text schreiben; null löscht */
export function writeStr(key: string, value: string | null, session = false) {
  try { if (value === null) store(session).removeItem(key); else store(session).setItem(key, value); } catch { /* voll oder gesperrt */ }
}

/** Alle Daten der App auf diesem Gerät löschen – außer `keep` */
export function wipeLocal(keep: readonly string[] = []) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(KEY_PREFIX) && !keep.includes(k)) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch { /* ohne Speicher gibt es nichts zu löschen */ }
}

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

export function remove(key: string, session = false) {
  try { (session ? sessionStorage : localStorage).removeItem(key); } catch { /* egal */ }
}

export interface RoomCreds { playerId: string; token: string }
export const CREDS_PREFIX = `${KEY_PREFIX}room:`;
export const credsKey = (code: string) => `${CREDS_PREFIX}${code}`;
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
/** Zuletzt lokal gewähltes Spiel – „Ein Handy für alle“ öffnet dessen Lobby (bzw. die laufende Partie) */
export const LOCAL_GAME_KEY = "spieltisch:localGame";
/** Würfel in voller Qualität, auch ohne Grafikchip (Entwickler-Modus, Screenshots) */
export const DICE_HQ_KEY = "spieltisch:diceHQ";
/** Erster Start schon durchlaufen */
export const ONBOARDED_KEY = "spieltisch:onboarded";
/** Von wo aus das Profil geöffnet wurde (Menü im Spiel) – der Zurück-Knopf führt dorthin */
export const RETURN_KEY = "spieltisch:return";
