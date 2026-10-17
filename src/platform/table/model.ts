/**
 * Großer Tisch: was der gemeinsame Bildschirm von einer Partie zeigt – Stapel, Ablage, verdeckte Hände, wer dran ist.
 * Jedes Spiel, das am Tisch läuft, liefert dafür ein Modell aus seiner öffentlichen Sicht (ohne fremde Karten).
 * Spiele ohne Modell zeigt der Tisch wie ein Handy in der Mitte.
 */
import type { RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import type { MauMauState } from "@shared/games/maumau/logic";
import type { UnoState } from "@shared/games/uno/logic";
import { HAND, type SchamlosState } from "@shared/games/schamlos/logic";

/** Kartenart: französisch/deutsch („cards“), Uno oder Textkarten (Schamlos) */
export type TableDeck = "cards" | "uno" | "schamlos";

export interface TableModel {
  deck: TableDeck;
  /** Karten im Stapel */
  pile: number;
  /** oberste Karten der Ablage, die oberste zuletzt */
  discard: string[];
  /** Kartenzahl je Spieler (Reihenfolge wie am Tisch) */
  counts: Record<string, number>;
  /** wer dran ist */
  turn: string | null;
  /** zählt Züge – neue Karte auf der Ablage fliegt vom Platz dessen, der eben dran war */
  n: number;
  /** Farbe, die gerade gilt (Wunsch nach Unter bzw. Uno-Farbe) – als Text und Farbton */
  color?: { label: string; hex: string };
  /** Punkte je Spieler, falls das Spiel mitzählt */
  scores?: Record<string, number>;
  /** letzte Ereignisse, das neueste zuletzt */
  log: string[];
  /** Lückensatz-Spiele: schwarze Karte, verdeckt gelegte und aufgedeckte Antworten */
  words?: {
    prompt: string;
    /** wer schon verdeckt gelegt hat (in dieser Reihenfolge) */
    playedBy: string[];
    /** aufgedeckte Antworten (ab dem Wählen), je Antwort eine oder zwei Karten */
    subs: string[][];
    /** gewählte Antwort und von wem (nach dem Wählen) */
    pick: number | null;
    pickBy: string | null;
  };
}

const SUIT_LABEL: Record<string, { label: string; hex: string }> = {
  kreuz: { label: "Kreuz", hex: "#1b1e25" }, pik: { label: "Pik", hex: "#1b1e25" }, herz: { label: "Herz", hex: "#a8454f" }, karo: { label: "Karo", hex: "#a8454f" },
  eichel: { label: "Eichel", hex: "#7a5a3a" }, gruen: { label: "Grün", hex: "#4f7560" }, rot: { label: "Rot", hex: "#a8454f" }, schellen: { label: "Schellen", hex: "#b39a5c" },
};
const UNO_COLOR: Record<string, { label: string; hex: string }> = {
  r: { label: "Rot", hex: "#d72600" }, g: { label: "Grün", hex: "#379711" }, b: { label: "Blau", hex: "#0956bf" }, y: { label: "Gelb", hex: "#ecd407" },
};

export { TABLE_GAMES } from "@shared/platform/modes";

export function tableModel(room: RoomState): TableModel | null {
  if (room.phase !== "playing" || !room.game) return null;
  // Partie läuft nach einem Update noch mit einer älteren Version: Tisch zeigt sie wie ein Handy
  if (room.gameVersion !== undefined && room.gameVersion !== getGame(room.gameId).version) return null;
  if (room.gameId === "maumau") {
    const s = room.game as MauMauState;
    if (s.mode === "table") return null;
    return { deck: "cards", pile: s.pileCount, discard: s.discard.slice(-4), counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6),
      color: s.wish ? SUIT_LABEL[s.wish] : undefined };
  }
  if (room.gameId === "uno") {
    const s = room.game as UnoState;
    if (s.mode === "table" || s.phase !== "play") return null;
    return { deck: "uno", pile: s.pileCount, discard: s.discard.slice(-4), counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6),
      color: UNO_COLOR[s.color], scores: s.scores };
  }
  if (room.gameId === "schamlos") {
    const s = room.game as SchamlosState;
    if (s.phase === "over") return null;
    const counts = Object.fromEntries(room.players.map((p) => [p.id, s.played[p.id] ? HAND - s.blanks : HAND]));
    const subs = s.phase === "pick" ? [] : s.subs.map((x) => x.cards);
    const pick = s.phase === "result" ? s.pick : null;
    return { deck: "schamlos", pile: 0, discard: [], counts, turn: s.czar, n: s.round, log: s.log.slice(-6), scores: s.scores,
      words: { prompt: s.prompt, playedBy: Object.keys(s.played), subs, pick, pickBy: pick !== null ? s.subs[pick]?.by ?? null : null } };
  }
  return null;
}
