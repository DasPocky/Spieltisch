import type { RoomState } from "@shared/platform/room";
import type { ONState } from "@shared/games/einenacht/logic";
import type { TableModel } from "../../platform/table/model";

/** Eine Nacht am Tisch: drei verdeckte Karten in der Mitte, vor jedem Platz die eigene verdeckt, Aufsteller mit Phase und Uhr */
export function einenachtTable(room: RoomState): TableModel | null {
  const s = room.game as ONState;
  if (s.phase === "over" || s.own) return null;
  const ids = Object.keys(s.start);
  const sign: NonNullable<TableModel["sign"]> =
    s.phase === "reveal" ? { title: "Schaut eure Karte an", sub: `${s.ready.length} von ${ids.length} bereit` }
    : s.phase === "night" ? { title: "Die Nacht", sub: "Alle schließen die Augen" }
    : { title: "Wer ist der Werwolf?", sub: `${Object.keys(s.votes).length} von ${ids.length} haben abgestimmt`, endsAt: s.dayStartedAt ? s.dayStartedAt + s.minutes * 60_000 : null };
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: null, n: s.ready.length + s.done.length + Object.keys(s.votes).length, log: [],
    notes: Object.fromEntries(ids.map((id) => [id, s.phase === "day" ? (s.votes[id] ? "abgestimmt ✓" : "überlegt") : s.ready.includes(id) ? "bereit" : ""])),
    piles: s.center.map(() => ({ label: "Mitte", top: "?", single: true })),
    boards: Object.fromEntries(ids.map((id) => [id, { cols: 1, cells: ["?" as const] }])),
    sign, night: s.phase === "night",
  };
}
