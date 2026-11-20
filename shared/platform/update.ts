/**
 * Updates: Jede neue Version geht sofort live (Workers Builds deployt nach dem Merge direkt). Geräte merken die
 * neue Version, zeigen kurz einen Hinweis, laden neu – laufende Partien gehen danach im selben Raum weiter.
 * Die früheren Warte-Modi (ruhiger Moment, nach Rundenende, keine Partie, Uhrzeit, Knopf) gibt es nicht mehr;
 * die übrigen Werte bleiben nur im Typ, damit ältere Geräte und gespeicherte Einstellungen gültig bleiben.
 */
import type { BuildInfo } from "../build";

export type UpdateMode = "force" | "now" | "round" | "idle" | "time" | "manual";

export const UPDATE_MODES: { value: UpdateMode; label: string; hint: string }[] = [
  { value: "force", label: "Sofort für alle", hint: "Neue Versionen gehen gleich live und jedes Gerät lädt sofort neu – auch mitten in der Partie, die danach einfach weiterläuft." },
];

export interface UpdateConfig {
  mode: UpdateMode;
  maxWaitHours: number;
  hour: number;
}

export const DEFAULT_UPDATE: UpdateConfig = { mode: "force", maxWaitHours: 3, hour: 4 };

export const isUpdateMode = (x: unknown): x is UpdateMode => UPDATE_MODES.some((m) => m.value === x);

/** Gespeicherte Einstellung: es gilt immer „Sofort für alle“. */
export function sanitizeUpdate(_x: unknown): UpdateConfig {
  return { ...DEFAULT_UPDATE };
}

/** Stand der Updates – für den Admin */
export interface ReleaseStatus {
  mode: UpdateMode;
  build: BuildInfo;
}

/** Antwort auf GET /api/version – fürs Neuladen */
export interface VersionInfo {
  build: BuildInfo;
  mode: UpdateMode;
  /** wartendes Update – gibt es nicht mehr, bleibt für ältere Geräte null */
  pending: { at: number; mode: UpdateMode; hour?: number } | null;
}
