import type { RoomState } from "@shared/platform/room";
import { CATS, diceModeOf, totals, type FuenfWuerfelState } from "@shared/games/fuenfwuerfel/logic";
import type { TableModel } from "../../platform/table/model";

/** Fünf Würfel am Tisch: Würfel in der Mitte, Punkte an den Plätzen, letzte Einträge oben */
export function fuenfwuerfelTable(room: RoomState): TableModel | null {
  const s = room.game as FuenfWuerfelState;
  // Echte Würfel: der Tisch kennt die Augen nicht – dann wie ein Handy
  if (s.finished || diceModeOf(room) === "real") return null;
  const scores = Object.fromEntries(room.players.map((p) => [p.id, totals(s, p.id).total]));
  const name = room.players.find((p) => p.id === s.curId)?.name ?? "";
  const note = !s.dice.length ? `${name} würfelt` : s.rollsLeft > 0 ? `noch ${s.rollsLeft} ${s.rollsLeft === 1 ? "Wurf" : "Würfe"}` : "eintragen";
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.curId, n: s.n, scores,
    log: s.log.slice(-6).map((e) => `${e.name}: ${CATS[e.cat].name} ${e.pts}`),
    notes: Object.fromEntries(Object.entries(scores).map(([id, v]) => [id, `${v} Pkt.`])),
    dice: { values: s.dice, held: s.held, n: s.n, note },
  };
}
