import type { Player } from "./types";

/**
 * Wer fängt an: reihum je Partie – wie am echten Tisch wandert der Geber weiter.
 * `round` zählt die bisher gestarteten Partien im Raum (0 bei der ersten).
 */
export function firstPlayerId(ctx: { players: Player[]; round?: number }): string | null {
  const n = ctx.players.length;
  return n ? ctx.players[(ctx.round ?? 0) % n].id : null;
}

/** Der Geber vor dem ersten Spieler (gibt aus, links von ihm geht es los) */
export function dealerBefore(ctx: { players: Player[]; round?: number }): string | null {
  const n = ctx.players.length;
  return n ? ctx.players[((ctx.round ?? 0) + n - 1) % n].id : null;
}

/** Der nächste Spieler in Zugreihenfolge nach `id` (unbekannte id: der erste). */
export function nextPlayerId(players: Player[], id: string | null): string | null {
  if (!players.length) return null;
  const i = players.findIndex((p) => p.id === id);
  return players[(i + 1) % players.length].id;
}
