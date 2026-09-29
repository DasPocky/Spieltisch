import type { Player } from "./types";

/** Der nächste Spieler in Zugreihenfolge nach `id` (unbekannte id: der erste). */
export function nextPlayerId(players: Player[], id: string | null): string | null {
  if (!players.length) return null;
  const i = players.findIndex((p) => p.id === id);
  return players[(i + 1) % players.length].id;
}
