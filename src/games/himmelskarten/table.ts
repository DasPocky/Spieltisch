import type { RoomState } from "@shared/platform/room";
import type { SkState } from "@shared/games/himmelskarten/logic";
import type { TableModel } from "../../platform/table/model";

/** Farben wie auf den Karten: minus dunkelblau, 0 hellblau, 1–4 grün, 5–8 gelb, 9–12 rot */
export const skTone = (v: number) => (v < 0 ? "#3b4fb8" : v === 0 ? "#5fb0d8" : v <= 4 ? "#3a9a4f" : v <= 8 ? "#d8b02c" : "#d0453b");

/** Himmelskarten am Tisch: Nachziehstapel und Ablage in der Mitte, am Platz das 4×3-Raster (verdeckte Karten als „?“) */
export function himmelskartenTable(room: RoomState): TableModel | null {
  const s = room.game as SkState;
  if (s.mode !== "app" || (s.phase !== "flip" && s.phase !== "turn")) return null;
  const top = s.discard[s.discard.length - 1];
  const boards = Object.fromEntries(room.players.map((p) => {
    // Raster Zeile für Zeile (3 × 4), abgeräumte Spalten bleiben leer
    const cells = (s.grids[p.id] ?? []).map((cell) => (!cell ? null : cell.up && cell.v !== null ? { text: String(cell.v), tone: skTone(cell.v) } : ("?" as const)));
    return [p.id, { cells, cols: 4 }];
  }));
  const open = (id: string) => (s.grids[id] ?? []).reduce((n, c) => n + (c?.up && c.v !== null ? c.v : 0), 0);
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.curId, n: s.log.length, log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => [p.id, `offen ${open(p.id)} · gesamt ${s.scores[p.id] ?? 0}`])),
    piles: [
      { label: "Ziehen", top: null, count: s.deckCount },
      { label: "Ablage", top: top === undefined ? null : String(top), tone: top === undefined ? undefined : skTone(top) },
      ...(s.drawn !== null ? [{ label: "Gezogen", top: String(s.drawn), tone: skTone(s.drawn) }] : []),
    ],
    boards,
  };
}
