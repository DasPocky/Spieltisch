/**
 * Updates: Wann geht eine neue Version live? Standard ist „Sofort für alle“: live und jedes Gerät lädt gleich neu
 * (laufende Partien gehen danach weiter). Im Admin (oder per Variable UPDATE_MODE)
 * lässt sich das ändern. Neue Versionen lädt der Build dann nur hoch; der Worker schaltet sie zum gewählten Zeitpunkt frei.
 */
import type { BuildInfo } from "../build";

export type UpdateMode =
  /** sofort live, jedes Gerät lädt gleich neu – auch mitten in der Partie (sie läuft danach weiter) */
  | "force"
  /** sofort live, Geräte laden an einem ruhigen Moment neu (spätestens nach 2 Minuten) */
  | "now"
  /** sofort live, aber jeder Raum wechselt erst nach seiner laufenden Partie (die läuft mit ihrer Version zu Ende) */
  | "round"
  /** warten, bis keine Partie mehr läuft – höchstens `maxWaitHours` */
  | "idle"
  /** zur festen Uhrzeit (`hour`, deutsche Zeit) */
  | "time"
  /** nur per Knopf im Admin */
  | "manual";

export const UPDATE_MODES: { value: UpdateMode; label: string; hint: string }[] = [
  { value: "force", label: "Sofort für alle", hint: "Neue Versionen gehen gleich live und jedes Gerät lädt sofort neu – auch mitten in der Partie, die danach einfach weiterläuft." },
  { value: "now", label: "Am ruhigen Moment", hint: "Neue Versionen gehen gleich live. Geräte laden an einem ruhigen Moment neu, spätestens nach 2 Minuten." },
  { value: "round", label: "Nach Rundenende je Raum", hint: "Sofort live – laufende Partien spielen mit ihrer Version zu Ende, dann wechselt der Raum." },
  { value: "idle", label: "Wenn keine Partie läuft", hint: "Wartet, bis alle Partien vorbei sind – höchstens so viele Stunden." },
  { value: "time", label: "Feste Uhrzeit", hint: "Was bis dahin fertig ist, geht zur gewählten Uhrzeit live." },
  { value: "manual", label: "Nur per Knopf", hint: "Neue Versionen warten, bis jemand hier „Jetzt live schalten“ drückt." },
];

export interface UpdateConfig {
  mode: UpdateMode;
  /** „Wenn keine Partie läuft“: so lange höchstens warten */
  maxWaitHours: number;
  /** „Feste Uhrzeit“: Stunde (0–23, deutsche Zeit) */
  hour: number;
}

export const DEFAULT_UPDATE: UpdateConfig = { mode: "force", maxWaitHours: 3, hour: 4 };

export const isUpdateMode = (x: unknown): x is UpdateMode => UPDATE_MODES.some((m) => m.value === x);

export function sanitizeUpdate(x: unknown): UpdateConfig {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  return {
    mode: isUpdateMode(o.mode) ? o.mode : DEFAULT_UPDATE.mode,
    maxWaitHours: num(o.maxWaitHours, 1, 48, DEFAULT_UPDATE.maxWaitHours),
    hour: num(o.hour, 0, 23, DEFAULT_UPDATE.hour),
  };
}

/** Hochgeladene, noch nicht freigeschaltete Version */
export interface PendingRelease {
  versionId: string;
  sha: string;
  /** Bauzeit (ISO) */
  time: string;
  /** seit wann sie wartet */
  at: number;
}

/** Wie eine Version live ging */
export type ReleaseHow = "sofort" | "ruhe" | "zeitlimit" | "uhrzeit" | "knopf" | "direkt";

export const RELEASE_HOW: Record<ReleaseHow, string> = {
  sofort: "sofort",
  ruhe: "keine Partie mehr",
  zeitlimit: "Höchstwartezeit erreicht",
  uhrzeit: "zur Uhrzeit",
  knopf: "per Knopf",
  direkt: "direkt (ohne Freigabe-Schritt)",
};

export interface ReleaseEntry {
  sha: string;
  time: string;
  /** hochgeladen */
  at: number;
  /** live seit – fehlt, solange sie wartet (oder übersprungen wurde) */
  liveAt?: number;
  how?: ReleaseHow;
  /** von einer neueren Version überholt, bevor sie live ging */
  skipped?: boolean;
}

/** Stand der Updates – für den Admin */
export interface ReleaseStatus {
  mode: UpdateMode;
  /** Modus kommt aus der Variable UPDATE_MODE (im Admin nicht änderbar) */
  modeFromEnv: boolean;
  /** Kann der Worker selbst freischalten? (Schlüssel DEPLOY_TOKEN gesetzt) */
  canPromote: boolean;
  /** Meldet sich der Build? (RELEASE_SECRET gesetzt) */
  canReceive: boolean;
  pending: PendingRelease | null;
  history: ReleaseEntry[];
  /** letzter Fehler beim Freischalten (z. B. Schlüssel abgelaufen) */
  error?: string;
}

/** Antwort auf GET /api/version – fürs Neuladen und den Hinweis im Raum */
export interface VersionInfo {
  build: BuildInfo;
  mode: UpdateMode;
  /** wartendes Update (nur Zeitpunkt, keine Interna) */
  pending: { at: number; mode: UpdateMode; hour?: number } | null;
}

/** Stunde in deutscher Zeit */
export function berlinHour(now: number): number {
  const part = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" }).formatToParts(now).find((p) => p.type === "hour");
  return Number(part?.value ?? 0) % 24;
}

/**
 * Ist ein wartendes Update jetzt dran? Liefert den Grund oder null.
 * `playing`: Räume, in denen gerade eine Partie läuft (mit jemandem online).
 */
export function releaseDue(p: PendingRelease, cfg: UpdateConfig, now: number, playing: number): ReleaseHow | null {
  switch (cfg.mode) {
    case "force":
    case "now":
    case "round":
      return "sofort";
    case "idle":
      if (playing === 0) return "ruhe";
      return now - p.at >= cfg.maxWaitHours * 3_600_000 ? "zeitlimit" : null;
    case "time":
      // Zur Stunde – oder falls sie verpasst wurde (z. B. Worker ruhte), spätestens einen Tag später
      if (berlinHour(now) === cfg.hour && now - p.at > 60_000) return "uhrzeit";
      return now - p.at >= 25 * 3_600_000 ? "uhrzeit" : null;
    case "manual":
      return null;
  }
}
