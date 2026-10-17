/**
 * Gesicherte Spiellogik früherer Versionen (angelegt mit `node scripts/legacy.mjs <id>`).
 * Laufende Partien spielen nach einem Update mit ihrer Version zu Ende; die nächste Partie startet mit der aktuellen.
 * Einträge können weg, sobald keine Partie dieser Version mehr läuft (`node scripts/legacy.mjs --prune <id>-v<N>`).
 */
import type { GameLogic } from "../platform/types";
// legacy:imports

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LEGACY: Record<string, GameLogic<any, any>> = {
  // legacy:entries
};

/** Logik einer älteren Version, falls gesichert */
export function legacyGame(id: string, version: number): GameLogic<unknown, { type: string }> | null {
  return (LEGACY[`${id}@${version}`] as GameLogic<unknown, { type: string }> | undefined) ?? null;
}

/** Alle gesicherten Versionen als „id@version“ */
export const LEGACY_KEYS = Object.keys(LEGACY);
