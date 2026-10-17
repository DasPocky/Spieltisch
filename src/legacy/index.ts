/**
 * Oberflächen früherer Spiel-Versionen – Gegenstück zu `shared/legacy` (angelegt mit `node scripts/legacy.mjs <id>`).
 * Laden erst, wenn eine Partie dieser Version läuft.
 */
import type { GameUI } from "@/games/types";

const LEGACY_UI: Record<string, () => Promise<GameUI>> = {
  // legacy:loaders
};

export const legacyLoader = (id: string, version: number): (() => Promise<GameUI>) | null => LEGACY_UI[`${id}@${version}`] ?? null;
