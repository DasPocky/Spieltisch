import { describe, expect, it } from "vitest";
import { MILLS, NEIGHBORS, pointName, removable, type MuehleState } from "@shared/games/muehle/logic";
import type { RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as MuehleState;
function start(options: Record<string, string | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben"]), { type: "selectGame", gameId: "muehle" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Stellung direkt setzen: Weiß, Schwarz, Steine in der Hand, wer dran ist */
function pos(r: RoomState, w: number[], b: number[], hand: [number, number] = [0, 0], turn: 0 | 1 = 0): RoomState {
  const board = Array(24).fill(null);
  for (const i of w) board[i] = 0;
  for (const i of b) board[i] = 1;
  return { ...r, game: { ...g(r), board, hand, turn, remove: false } };
}
const place = (r: RoomState, to: number) => game(r, { type: "place", to });

describe("Mühle", () => {
  it("Brett: 24 Punkte, 16 Mühlen, Nachbarn stimmen", () => {
    expect(MILLS).toHaveLength(16);
    expect(NEIGHBORS.flat()).toHaveLength(64); // 32 Linienstücke, je zweimal
    expect([...NEIGHBORS[1]].sort((a, b) => a - b)).toEqual([0, 2, 9]);
    expect([...NEIGHBORS[9]].sort((a, b) => a - b)).toEqual([1, 8, 10, 17]);
    expect(pointName(0)).toBe("a7");
    expect(pointName(4)).toBe("g1");
    expect(pointName(23)).toBe("c4");
  });

  it("Setzen, Mühle schließen, Stein nehmen", () => {
    let r = start();
    r = place(r, 0); r = place(r, 8); r = place(r, 1); r = place(r, 9);
    r = place(r, 2); // Mühle 0-1-2
    expect(g(r).remove).toBe(true);
    expect(g(r).turn).toBe(0);
    expect(() => place(r, 5)).toThrow(/erst einen Stein/);
    expect(() => game(r, { type: "remove", at: 1 })).toThrow(/Gegners/);
    r = game(r, { type: "remove", at: 8 });
    expect(g(r).board[8]).toBeNull();
    expect(g(r).turn).toBe(1);
    expect(g(r).hand).toEqual([6, 7]);
  });

  it("Steine in Mühlen sind geschützt – außer alle stehen in Mühlen", () => {
    let r = pos(start(), [16, 17], [0, 1, 2, 10], [1, 0], 0);
    r = place(r, 18);
    expect(removable(g(r))).toEqual([10]);
    expect(() => game(r, { type: "remove", at: 0 })).toThrow(/geschützt/);
    r = pos(start(), [16, 17], [0, 1, 2], [1, 0], 0);
    r = place(r, 18);
    expect(removable(g(r))).toEqual([0, 1, 2]);
  });

  it("Ziehen nur zum Nachbarn, mit drei Steinen springen", () => {
    let r = pos(start(), [0, 3, 5, 7], [12, 14, 20], [0, 0], 0);
    expect(() => game(r, { type: "move", from: 0, to: 4 })).toThrow(/Linie/);
    r = game(r, { type: "move", from: 0, to: 1 });
    expect(g(r).turn).toBe(1);
    r = game(r, { type: "move", from: 12, to: 2 }); // Schwarz springt
    expect(g(r).board[2]).toBe(1);
    const noJump = pos(start({ jump: false }), [0, 3, 5, 7], [12, 14, 20], [0, 0], 1);
    expect(() => game(noJump, { type: "move", from: 12, to: 2 })).toThrow(/Linie/);
  });

  it("Weniger als drei Steine: verloren", () => {
    let r = pos(start(), [0, 1, 4], [8, 9, 20], [0, 0], 0);
    r = game(r, { type: "move", from: 4, to: 3 });
    r = game(r, { type: "move", from: 8, to: 16 });
    r = game(r, { type: "move", from: 3, to: 2 }); // Mühle 0-1-2
    r = game(r, { type: "remove", at: 20 });
    expect(g(r).winner).toBe(0);
    expect(g(r).end).toMatch(/nur noch 2/);
  });

  it("Eingesperrt: verloren", () => {
    // Schwarz auf 0 und 2 (und 23), ringsum Weiß – nach dem Zug kein Ausweg
    const r = game(pos(start({ jump: false }), [1, 7, 3, 15, 22, 16, 12], [0, 2, 23], [0, 0], 0), { type: "move", from: 12, to: 13 });
    expect(g(r).winner).toBe(0);
    expect(g(r).end).toMatch(/nicht mehr ziehen/);
  });

  it("Remis nach Zügen ohne Mühle (Einstellung)", () => {
    let r = pos(start({ draw: "20" }), [0, 4, 10, 21], [2, 6, 13, 18], [0, 0], 0);
    r = { ...r, game: { ...g(r), quiet: 39 } };
    r = game(r, { type: "move", from: 0, to: 1 });
    expect(g(r).draw).toBe(true);
  });
});
