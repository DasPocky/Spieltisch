import type { RoomState } from "@shared/platform/room";
import { cardLabel, linePoints, type F7State } from "@shared/games/glueckssieben/logic";
import type { TableModel } from "../../platform/table/model";

const STATUS: Record<string, string> = { active: "spielt", stayed: "bleibt stehen", bust: "raus", frozen: "eingefroren", done: "fertig" };
const tone = (c: string) => (c.startsWith("m:") ? "#c2492e" : c.startsWith("a:") ? "#6d62a3" : "#1f5f5b");

/** Glückssieben am Tisch: Nachziehstapel in der Mitte, am Platz die offene Reihe mit Punkten und Status */
export function glueckssiebenTable(room: RoomState): TableModel | null {
  const s = room.game as F7State;
  if (s.mode !== "app" || !s.lines || s.winners.length) return null;
  const boards = Object.fromEntries(room.players.flatMap((p) => {
    const line = s.lines[p.id];
    if (!line) return [];
    const cards = [...line.nums, ...line.mods];
    if (!cards.length) return [];
    return [[p.id, { cells: cards.map((c) => ({ text: cardLabel(c), tone: tone(c) })), cols: Math.min(8, cards.length) }]];
  }));
  const top = s.discard[s.discard.length - 1];
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: s.curId, n: s.n, log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => {
      const line = s.lines[p.id];
      return [p.id, line ? `${linePoints(line)} Pkt. · ${STATUS[line.status] ?? ""}` : `${s.scores[p.id] ?? 0} gesamt`];
    })),
    piles: [{ label: "Ziehen", top: null, count: s.deckCount }, ...(top ? [{ label: "Ablage", top: cardLabel(top), tone: tone(top) }] : [])],
    boards,
  };
}
