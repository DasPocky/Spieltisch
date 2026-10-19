import type { RoomState } from "@shared/platform/room";
import { JOKER, type SbCard, type SbState } from "@shared/games/stapelbau/logic";
import type { TableModel } from "../../platform/table/model";

/** Farbe wie auf den Karten: 1–4 blau, 5–8 grün, 9–12 rot, Joker orange */
export const sbTone = (c: SbCard) => (c === JOKER ? "#f08a24" : c <= 4 ? "#2f6fd0" : c <= 8 ? "#2f9a5c" : "#d0453b");
const label = (c: SbCard) => (c === JOKER ? "★" : String(c));

/** Stapelbau am Tisch: vier Aufbaustapel in der Mitte, am Platz Vorrat (oberste Karte offen) und die vier Ablagen */
export function stapelbauTable(room: RoomState): TableModel | null {
  const s = room.game as SbState;
  if (s.phase !== "play") return null;
  const piles = s.builds.map((b, i) => ({
    label: `Stapel ${i + 1}`,
    // erreichter Wert – ein Joker zählt als die Zahl, die er ersetzt
    top: b.length ? String(b.length) : null,
    tone: b.length ? sbTone(b.length) : undefined,
  }));
  const all: NonNullable<TableModel["piles"]> = [...piles, { label: "Ziehen", top: null, count: s.pileCount }];
  const boards = Object.fromEntries(room.players.map((p) => {
    const stock = s.stocks[p.id] ?? [];
    const top = stock[stock.length - 1];
    const cells = [
      top === undefined ? null : { text: label(top), tone: sbTone(top) },
      ...(s.discards[p.id] ?? [[], [], [], []]).map((d) => (d.length ? { text: label(d[d.length - 1]), tone: sbTone(d[d.length - 1]) } : null)),
    ];
    return [p.id, { cells, cols: 5 }];
  }));
  return {
    deck: "cards", pile: 0, discard: [], counts: s.handCounts, turn: s.curId, n: s.n, log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => [p.id, `Vorrat ${s.stockCounts[p.id] ?? 0}`])),
    piles: all, boards,
  };
}
