/**
 * Updates im Gerät: merkt, wenn der Server eine neuere Version hat, und lädt an einem ruhigen Moment neu.
 *
 * Woher die Version kommt: beim Verbinden mit einem Raum („hello“) und alle paar Minuten über /api/version.
 * Standard („Sofort für alle“): sofort mit kurzem Hinweis neu laden – egal, wer gerade dran ist.
 * In den anderen Modi sagt die gerade sichtbare Seite über `useUpdateGate`, wann:
 *  - „now“   – passt gerade (Startseite, Lobby, nicht dran)
 *  - „later“ – lieber gleich nicht (man ist dran, tippt gerade); spätestens nach 2 Minuten trotzdem
 *  - „hold“  – erst nach der laufenden Partie (Update-Modus „Nach Rundenende je Raum“)
 * Nach dem Neuladen geht es im selben Raum weiter (Zugang ist gespeichert) und es erscheint kurz „Neue Version geladen“.
 */
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BUILD, type BuildInfo } from "@shared/build";
import { DEFAULT_UPDATE, type UpdateMode, type VersionInfo } from "@shared/platform/update";
import { PROTOCOL } from "@shared/platform/protocol";

export type Gate = "now" | "later" | "hold";

/** So lange wartet „later“ höchstens */
export const LATER_MAX_MS = 2 * 60_000;
/** So oft fragt die App nach einer neuen Version (in Räumen meldet der Server sie ohnehin beim Wiederverbinden) */
const POLL_MS = 60_000;
/** Vorwarnung vor dem erzwungenen Neuladen */
export const FORCE_MS = 2500;
const RELOADED_KEY = "spieltisch:updated";
/** Für welche Version schon neu geladen wurde (bleibt bis zum Schließen des Tabs – nie im Kreis laden) */
const GUARD_KEY = "spieltisch:reloadedFor";

interface UpdateState {
  /** neuere Version auf dem Server (null: aktuell) */
  ready: BuildInfo | null;
  /** seit wann bekannt */
  since: number;
  mode: UpdateMode;
  /** wartendes Update (Hinweis im Raum) */
  pending: VersionInfo["pending"];
  /** Protokoll passt nicht – sofort neu laden */
  urgent?: boolean;
}

/** Eigene Version – Tests können sie vorgeben (window.__TEST_BUILD__), sonst die gebaute */
const mine = (): BuildInfo => (globalThis as { __TEST_BUILD__?: BuildInfo }).__TEST_BUILD__ ?? BUILD;

let state: UpdateState = { ready: null, since: 0, mode: DEFAULT_UPDATE.mode, pending: null };
const listeners = new Set<() => void>();
const set = (next: Partial<UpdateState>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

/** Gerät läuft mit einer gebauten Version (nicht beim Entwickeln) */
const real = () => mine().sha !== "dev" && !!mine().time;

/** Ist `b` neuer als das, was hier läuft? (Bauzeit – während eines Deploys antworten kurz alte und neue Server) */
function newer(b: BuildInfo | undefined): boolean {
  return !!b && real() && b.sha !== "dev" && b.sha !== mine().sha && !!b.time && Date.parse(b.time) > Date.parse(mine().time);
}

/**
 * Version vom Server gehört (Raum-„hello“ oder /api/version). `protocol`: Nachrichtenformat des Servers –
 * passt es nicht zu diesem Gerät, wird sofort neu geladen (sonst reden beide aneinander vorbei).
 */
export function noteServerBuild(b: BuildInfo | undefined, protocol?: number): void {
  if (protocol !== undefined && protocol !== PROTOCOL && b && real() && b.sha !== mine().sha) {
    if (readSession(GUARD_KEY) === `${b.sha}:from:${mine().sha}`) return;
    set({ ready: b, since: 0, urgent: true });
    reload();
    return;
  }
  if (!newer(b)) return;
  // Schon einmal für genau diese Version neu geladen und trotzdem alt (Zwischenspeicher)? Nicht im Kreis laden.
  if (readSession(GUARD_KEY) === `${b!.sha}:from:${mine().sha}`) return;
  if (state.ready?.sha !== b!.sha) {
    set({ ready: b!, since: Date.now() });
    // Modus und Zeitpunkt nachholen (der Raum-Gruß nennt nur die Version) – erst dann entscheiden
    if (!modeKnown) { void check().then(decide); return; }
    void check();
  }
  decide();
}

/** Modus schon vom Server gehört? (vorher nicht erzwungen neu laden) */
let modeKnown = false;
export async function check(): Promise<void> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const v = (await res.json()) as VersionInfo;
    modeKnown = true;
    set({ mode: v.mode, pending: v.pending });
    if (newer(v.build)) noteServerBuild(v.build);
  } catch { /* offline – später */ }
}

// ---------- Wann neu laden? ----------

let gate: () => Gate = () => "now";
let timer: ReturnType<typeof setTimeout> | undefined;

/** Sichtbare Seite sagt, ob gerade ein guter Moment ist (die zuletzt angemeldete gilt) */
export function useUpdateGate(fn: () => Gate): void {
  useEffect(() => {
    const prev = gate;
    gate = fn;
    decide();
    return () => { if (gate === fn) gate = prev; };
  }, [fn]);
}

/** Entscheidung (auch erneut nach jedem Zug, über `decide()` aus der Seite) */
let forcing = false;
export function decide(): void {
  clearTimeout(timer);
  if (!state.ready || forcing) return;
  // Sofort für alle: kurzer Hinweis, dann neu laden – die Partie läuft danach im selben Raum weiter
  if (state.mode === "force") {
    forcing = true;
    toast("Neue Version – die App lädt kurz neu", { duration: FORCE_MS + 1000 });
    setTimeout(reload, FORCE_MS);
    return;
  }
  const g = typing() ? "later" : gate();
  if (g === "now" || (g === "later" && Date.now() - state.since >= LATER_MAX_MS)) { reload(); return; }
  timer = setTimeout(decide, 3000);
}

const typing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && document.visibilityState === "visible";
};

function reload(): void {
  if (!state.ready) return;
  writeSession(RELOADED_KEY, `${state.ready.sha}:from:${mine().sha}`);
  writeSession(GUARD_KEY, `${state.ready.sha}:from:${mine().sha}`);
  location.reload();
}

/** Für den Hinweis im Raum */
export function useUpdate(): UpdateState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// ---------- Start ----------

/**
 * Einmal beim App-Start: nach einem Update kurz Bescheid geben, regelmäßig nachfragen,
 * und fehlende Dateien (alte Version nach einem Update weg) mit einem Neuladen abfangen.
 */
export function startUpdates(): void {
  const done = readSession(RELOADED_KEY);
  if (done) {
    removeSession(RELOADED_KEY);
    if (done.startsWith(`${mine().sha}:`)) setTimeout(() => toast("Neue Version geladen", { duration: 4000 }), 600);
  }
  if (!real()) return;
  void check();
  setInterval(() => { if (document.visibilityState === "visible") void check(); }, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void check(); });
  // Nachladen einer Datei schlägt fehl (nach einem Update gibt es sie nicht mehr): einmal neu laden
  window.addEventListener("vite:preloadError", (e) => { if (reloadForMissingFile()) e.preventDefault(); });
}

const MISSING_KEY = "spieltisch:missingReload";

/** Eine Datei der App fehlt: einmal pro Minute neu laden (mit Netz) – true, wenn neu geladen wird */
export function reloadForMissingFile(): boolean {
  if (!navigator.onLine) return false;
  const last = Number(readSession(MISSING_KEY) ?? 0);
  if (Date.now() - last < 60_000) return false;
  writeSession(MISSING_KEY, String(Date.now()));
  location.reload();
  return true;
}

/** Fehler beim Nachladen eines Programmteils? */
export const isChunkError = (e: unknown) => /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i.test(String((e as Error)?.message ?? e));

function readSession(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } }
function writeSession(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* egal */ } }
function removeSession(k: string) { try { sessionStorage.removeItem(k); } catch { /* egal */ } }
