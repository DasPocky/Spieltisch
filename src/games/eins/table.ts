import type { RoomState } from "@shared/platform/room";
import type { EinsState } from "@shared/games/eins/logic";
import type { TableModel } from "../../platform/table/model";

const EINS_COLOR: Record<string, { label: string; hex: string }> = {
  r: { label: "Rot", hex: "#d72600" }, g: { label: "Grün", hex: "#379711" }, b: { label: "Blau", hex: "#0956bf" }, y: { label: "Gelb", hex: "#ecd407" },
};

/** Eins! am Tisch: Stapel, Ablage, verdeckte Hände, Farbe, Punkte */
export function einsTable(room: RoomState): TableModel | null {
  const s = room.game as EinsState;
  if (s.mode === "table" || s.phase !== "play") return null;
  return { deck: "eins", pile: s.pileCount, discard: s.discard.slice(-4), counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6),
    color: EINS_COLOR[s.color], scores: s.scores };
}
