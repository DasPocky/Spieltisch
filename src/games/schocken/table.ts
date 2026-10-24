import type { RoomState } from "@shared/platform/room";
import { handOf, type ShState } from "@shared/games/schocken/logic";
import type { TableModel } from "../../platform/table/model";

/** Schocken am Tisch: Würfel in der Mitte, Deckel und fertige Würfe an den Plätzen */
export function schockenTable(room: RoomState): TableModel | null {
  const s = room.game as ShState;
  // Echte Würfel: der Tisch kennt die Augen nicht – dann wie ein Handy
  if (s.table || s.phase === "over") return null;
  const name = (id: string | null | undefined) => room.players.find((p) => p.id === id)?.name ?? "";
  const hands = s.phase === "roundEnd" ? s.last?.hands ?? {} : s.hands;
  const r = s.last;
  const note = s.phase === "roundEnd" && r
    ? `${name(r.winner)}: ${r.label} – ${name(r.loser)} bekommt ${r.moved} Deckel${r.halfLost ? ` und verliert die Hälfte` : ""}`
    : s.dice.length ? `${name(s.curId)}: ${handOf(s.dice).label} · noch ${Math.max(0, s.limit - s.throws)}` : `${name(s.curId)} würfelt · Mitte ${s.pot} Deckel`;
  const shown = s.phase === "roundEnd" && r ? hands[r.winner]?.dice ?? [] : s.dice;
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.phase === "roll" ? s.curId : null, n: s.n,
    log: s.log.slice(-6), scores: s.lids,
    notes: Object.fromEntries(room.players.map((p) => {
      const h = hands[p.id];
      const lids = s.lids[p.id];
      return [p.id, `${lids === undefined ? "zuschauen" : `${lids} Deckel`}${h ? ` · ${handOf(h.dice).label}` : ""}`];
    })),
    dice: { values: shown, held: s.phase === "roundEnd" ? [] : s.held, n: s.n, note, still: s.phase === "roundEnd" },
  };
}
