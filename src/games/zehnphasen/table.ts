import type { RoomState } from "@shared/platform/room";
import { colorOf, isSkip, isWild, valueOf, type P10Card, type P10State } from "@shared/games/zehnphasen/logic";
import type { TableModel } from "../../platform/table/model";
import { P10_INK } from "./colors";

const cell = (c: P10Card) => ({ text: isWild(c) ? "J" : isSkip(c) ? "⊘" : String(valueOf(c)), tone: isWild(c) ? "#1a1a1a" : isSkip(c) ? "#1062c4" : P10_INK[colorOf(c)!] });

/** Zehn Phasen am Tisch: Nachziehstapel und Ablage in der Mitte, verdeckte Hände, am Platz die ausgelegten Gruppen */
export function zehnphasenTable(room: RoomState): TableModel | null {
  const s = room.game as P10State;
  if (s.mode !== "app" || (s.step !== "draw" && s.step !== "play")) return null;
  const top = s.discard[s.discard.length - 1];
  const boards = Object.fromEntries(room.players.flatMap((p) => {
    const groups = s.laid[p.id] ?? [];
    if (!groups.length) return [];
    // Gruppen nacheinander, eine Lücke dazwischen – höchstens 10 Karten breit
    const cells = groups.flatMap((g, i) => [...(i ? [null] : []), ...g.cards.map(cell)]);
    return [[p.id, { cells, cols: Math.min(10, cells.length) }]];
  }));
  return {
    deck: "zahlen", pile: 0, discard: [], counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => [p.id, `Phase ${Math.min(s.phase[p.id] ?? 1, s.goal)}${s.laid[p.id]?.length ? " ✓" : ""}`])),
    piles: [{ label: "Ziehen", top: null, count: s.pileCount }, { label: "Ablage", ...(top ? (({ text, tone }) => ({ top: text, tone }))(cell(top)) : { top: null }) }],
    boards,
  };
}
