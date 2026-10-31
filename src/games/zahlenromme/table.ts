import type { RoomState } from "@shared/platform/room";
import type { ZrState } from "@shared/games/zahlenromme/logic";
import type { TableModel } from "../../platform/table/model";

const steine = (n: number) => (n === 1 ? "1 Stein" : `${n} Steine`);

/**
 * Zahlen-Rommé am Großen Tisch: der Tisch mit allen Reihen und Gruppen groß in der Mitte, darunter Pool und Runde.
 * Bänke zeigt der Tisch nie – am Platz nur die Zahl der Steine und die Punkte.
 */
export function zahlenrommeTable(room: RoomState): TableModel | null {
  const s = room.game as ZrState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "?";
  const last = s.rounds[s.rounds.length - 1];
  const note = s.phase === "round" && last
    ? `Runde ${last.round}: ${name(last.winner)} gewinnt (+${last.winner ? last.points[last.winner] : 0})`
    : `Runde ${s.round} · Pool ${s.poolCount} · ${name(s.curId)} ist dran`;
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.phase === "play" ? s.curId : null, n: s.n,
    log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => [p.id, `${steine(s.counts[p.id] ?? 0)} · ${s.scores[p.id] ?? 0} Pkt.${s.melded[p.id] ? "" : " · noch nicht ausgelegt"}`])),
    tiles: { groups: s.table, pool: s.poolCount, note },
  };
}
