import type { RoomState } from "@shared/platform/room";
import { DIR_NAME, type HzState } from "@shared/games/herzen/logic";
import type { TableModel } from "../../platform/table/model";

/** Herzen am Tisch: der Stich in der Mitte, verdeckte Hände, Punkte der Runde am Platz; „Herz gebrochen“ als Farbe */
export function herzenTable(room: RoomState): TableModel | null {
  const s = room.game as HzState;
  if (s.phase !== "pass" && s.phase !== "play") return null;
  // Zwischen zwei Stichen bleibt der letzte liegen, bis jemand ausspielt
  const trick = s.trick.length ? s.trick : (s.lastTrick?.plays ?? []);
  return {
    deck: "cards", pile: 0, discard: trick.map((p) => p.card), counts: s.counts, turn: s.phase === "play" ? s.curId : null, n: s.n,
    log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => [p.id, s.phase === "pass"
      ? (s.passIn[p.id] ? "hat weitergegeben" : `gibt ${DIR_NAME[s.dir]}`)
      : `${s.taken[p.id] ?? 0} Pkt. diese Runde`])),
    color: s.heartsBroken ? { label: "Herz gebrochen", hex: "#a8454f" } : undefined,
  };
}
