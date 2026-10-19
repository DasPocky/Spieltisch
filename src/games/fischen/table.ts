import type { RoomState } from "@shared/platform/room";
import { RANK_PLURAL } from "@shared/cards/deck";
import type { FischenState } from "@shared/games/fischen/logic";
import type { TableModel } from "../../platform/table/model";

/** Fischen am Tisch: der Teich in der Mitte, verdeckte Hände, vor jedem Platz die gelegten Quartette; die letzte Frage oben */
export function fischenTable(room: RoomState): TableModel | null {
  const s = room.game as FischenState;
  // Echte Karten: der Tisch kennt die Hände nicht – dann wie ein Handy
  if (s.table || s.finished) return null;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? "";
  const boards = Object.fromEntries(room.players.flatMap((p) => {
    const q = s.quartets[p.id] ?? [];
    return q.length ? [[p.id, { cells: q.map((r) => ({ text: r, tone: "#1f5f5b" })), cols: Math.min(6, q.length) }]] : [];
  }));
  return {
    deck: "cards", pile: 0, discard: [], counts: s.counts, turn: s.curId, n: s.n,
    log: s.events.slice(-6).map((e) => `${name(e.askerId)} fragt ${name(e.targetId)} nach ${RANK_PLURAL[e.rank]} – ${e.got ? `bekommt ${e.got}` : e.lucky ? "gefischt und Glück gehabt" : "Geh fischen!"}`),
    notes: Object.fromEntries(room.players.map((p) => [p.id, `${(s.quartets[p.id] ?? []).length} Quartette`])),
    piles: [{ label: "Teich", top: null, count: s.pileCount }],
    boards,
  };
}
