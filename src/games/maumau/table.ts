import type { RoomState } from "@shared/platform/room";
import type { MauMauState } from "@shared/games/maumau/logic";
import type { TableModel } from "../../platform/table/model";

const SUIT_LABEL: Record<string, { label: string; hex: string }> = {
  kreuz: { label: "Kreuz", hex: "#1b1e25" }, pik: { label: "Pik", hex: "#1b1e25" }, herz: { label: "Herz", hex: "#a8454f" }, karo: { label: "Karo", hex: "#a8454f" },
  eichel: { label: "Eichel", hex: "#7a5a3a" }, gruen: { label: "Grün", hex: "#4f7560" }, rot: { label: "Rot", hex: "#a8454f" }, schellen: { label: "Schellen", hex: "#b39a5c" },
};

/** Mau-Mau am Tisch: Stapel, Ablage, verdeckte Hände, gewünschte Farbe */
export function maumauTable(room: RoomState): TableModel | null {
  const s = room.game as MauMauState;
  if (s.mode === "table") return null;
  return { deck: "cards", pile: s.pileCount, discard: s.discard.slice(-4), counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6),
    color: s.wish ? SUIT_LABEL[s.wish] : undefined };
}
