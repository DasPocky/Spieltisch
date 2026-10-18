import type { RoomState } from "@shared/platform/room";
import type { UnoState } from "@shared/games/uno/logic";
import type { TableModel } from "../../platform/table/model";

const UNO_COLOR: Record<string, { label: string; hex: string }> = {
  r: { label: "Rot", hex: "#d72600" }, g: { label: "Grün", hex: "#379711" }, b: { label: "Blau", hex: "#0956bf" }, y: { label: "Gelb", hex: "#ecd407" },
};

/** Uno am Tisch: Stapel, Ablage, verdeckte Hände, Farbe, Punkte */
export function unoTable(room: RoomState): TableModel | null {
  const s = room.game as UnoState;
  if (s.mode === "table" || s.phase !== "play") return null;
  return { deck: "uno", pile: s.pileCount, discard: s.discard.slice(-4), counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6),
    color: UNO_COLOR[s.color], scores: s.scores };
}
