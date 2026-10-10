import { describe, expect, it } from "vitest";
import { winningCols, type VierState } from "@shared/games/vier/logic";
import { applyRoomAction, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as VierState;
function start(options: Record<string, string> = {}) {
  let r = act(roomWith(["Anna", "Ben"]), { type: "selectGame", gameId: "vier" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
const drops = (r: RoomState, cols: number[]) => cols.reduce((x, col) => game(x, { type: "drop", col }), r);

describe("Vier in einer Reihe", () => {
  it("genau zwei Spieler, Rot beginnt", () => {
    expect(() => act(act(roomWith(["A", "B", "C"]), { type: "selectGame", gameId: "vier" }), { type: "start" })).toThrow(/höchstens 2/);
    const s = g(start());
    expect([s.cols, s.rows]).toEqual([7, 6]);
    expect(s.colors).toEqual(["p1", "p2"]);
    expect(s.turn).toBe(0);
  });

  it("Steine stapeln sich, volle Spalte geht nicht", () => {
    let r = drops(start(), [3, 3, 3, 3, 3, 3]);
    expect(g(r).grid[3]).toEqual([0, 1, 0, 1, 0, 1]);
    expect(() => game(r, { type: "drop", col: 3 })).toThrow(/voll/);
    expect(() => game(r, { type: "drop", col: 7 })).toThrow(/gibt es nicht/);
    r = game(r, { type: "drop", col: 0 });
    expect(g(r).last).toEqual({ c: 0, r: 0 });
  });

  it("waagerecht gewinnt und markiert die Reihe", () => {
    const r = drops(start(), [0, 0, 1, 1, 2, 2, 3]);
    expect(g(r).winner).toBe(0);
    expect(g(r).line).toHaveLength(4);
    expect(() => game(r, { type: "drop", col: 4 })).toThrow(/entschieden/);
    expect(applyRoomAction(r, { type: "undo" }, null).game).toMatchObject({ winner: null });
  });

  it("diagonal gewinnt", () => {
    // Rot: (0,0) (1,1) (2,2) (3,3)
    const r = drops(start(), [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(g(r).winner).toBe(0);
    expect(g(r).line.map(([c, y]) => `${c}${y}`).sort()).toEqual(["00", "11", "22", "33"]);
  });

  it("senkrecht und Spielhilfe findet Gewinnspalte", () => {
    const r = drops(start(), [5, 6, 5, 6, 5]);
    expect(winningCols(g(r), 0)).toEqual([5]);
    expect(winningCols(g(r), 1)).toEqual([]);
    expect(g(drops(r, [0, 5])).winner).toBe(0);
  });

  it("volles Brett ohne Reihe ist unentschieden", () => {
    // Spaltenpaare im Wechsel füllen – so entsteht keine Vierer-Reihe
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const r = drops(start(), order);
    expect(g(r).winner).toBeNull();
    expect(g(r).draw).toBe(true);
  });

  it("Nochmal: die Farben wechseln", () => {
    let r = drops(start(), [0, 0, 1, 1, 2, 2, 3]);
    r = act(r, { type: "restart" });
    expect(g(r).colors).toEqual(["p2", "p1"]);
    expect(g(r).turn).toBe(0);
  });

  it("Brettgröße, Aufgeben, Verlassen, Überspringen", () => {
    let r = start({ size: "9x7" });
    expect([g(r).cols, g(r).rows]).toEqual([9, 7]);
    expect(g(act(r, { type: "skip" })).grid.flat()).toHaveLength(1);
    expect(g(game(r, { type: "resign" }, "p2")).winner).toBe(0);
    expect(() => game(r, { type: "drop", col: 0 }, "p2")).toThrow(/am Zug/);
    r = act(r, { type: "removePlayer", id: "p1" });
    expect(g(r).winner).toBe(1);
  });
});
