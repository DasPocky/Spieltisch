import { describe, expect, it } from "vitest";
import { legalMoves, type DameState } from "@shared/games/dame/logic";
import type { RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as DameState;
function start(options: Record<string, string | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben"]), { type: "selectGame", gameId: "dame" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Feldname wie „c3“ → Index (8×8) */
const sq = (n: string) => (Number(n.slice(1)) - 1) * 8 + "abcdefgh".indexOf(n[0]);
/** Stellung: Großbuchstaben-Präfix K = Dame, z. B. { w: ["c3", "Kd4"], b: ["e5"] } */
function pos(r: RoomState, w: string[], b: string[], turn: 0 | 1 = 0): RoomState {
  const board = Array(64).fill(0);
  for (const x of w) board[sq(x.replace("K", ""))] = x.startsWith("K") ? 2 : 1;
  for (const x of b) board[sq(x.replace("K", ""))] = x.startsWith("K") ? -2 : -1;
  return { ...r, game: { ...g(r), board, turn, blow: [], quiet: 0 } };
}
const mv = (r: RoomState, from: string, ...path: string[]) => game(r, { type: "move", from: sq(from), path: path.map(sq) });
const names = (s: DameState, o: Record<string, unknown> = {}) =>
  legalMoves(s, o as never).map((m) => [m.from, ...m.path].map((i) => `${"abcdefgh"[i % 8]}${Math.floor(i / 8) + 1}`).join("-")).sort();

describe("Dame", () => {
  it("Aufbau: je 12 Steine auf dunklen Feldern, Weiß beginnt", () => {
    const s = g(start());
    expect(s.board.filter((v) => v === 1)).toHaveLength(12);
    expect(s.board.filter((v) => v === -1)).toHaveLength(12);
    expect(s.board[sq("a1")]).toBe(1);
    expect(s.board[sq("h8")]).toBe(-1);
    expect(s.board[sq("b1")]).toBe(0);
    expect(names(s)).toHaveLength(7);
    expect(g(start({ size: "10" })).board.filter((v) => v === 1)).toHaveLength(20);
  });

  it("Steine ziehen ein Feld schräg vorwärts", () => {
    let r = start();
    expect(() => mv(r, "c3", "c4")).toThrow(/So darf/);
    expect(() => mv(r, "f6", "e5")).toThrow(/nicht dein/);
    r = mv(r, "c3", "d4");
    expect(g(r).turn).toBe(1);
    const back = pos(start(), ["d4"], ["a7"]);
    expect(() => mv(back, "d4", "c3")).toThrow(/So darf/);
  });

  it("Schlagzwang, auch rückwärts", () => {
    const r = pos(start(), ["d4", "a1"], ["c3"]);
    expect(names(g(r))).toEqual(["d4-b2"]);
    expect(() => mv(r, "a1", "b2")).toThrow(/Schlagzwang/);
    const after = mv(r, "d4", "b2");
    expect(g(after).winner).toBe(0);
    // Englisch: Steine schlagen nur vorwärts
    expect(names(g(r), { back: false })).toEqual(["a1-b2", "d4-c5", "d4-e5"]);
  });

  it("Mehrfachschlagen muss zu Ende geführt werden; Wahl zwischen Schlägen ist frei", () => {
    const r = pos(start(), ["a1", "h2"], ["b2", "b4", "g3", "a7"]);
    // a1×c3×a5 (zwei Steine) oder h2×f4 (einer) – beides erlaubt, keine Mehrheitspflicht
    expect(names(g(r))).toEqual(["a1-c3-a5", "h2-f4"]);
    expect(() => mv(r, "a1", "c3")).toThrow(/Weiterschlagen/);
    const after = mv(r, "a1", "c3", "a5");
    expect(g(after).board[sq("b2")]).toBe(0);
    expect(g(after).board[sq("b4")]).toBe(0);
    expect(g(after).turn).toBe(1);
  });

  it("Dame wird man am Zugende auf der Grundreihe – nicht mitten im Schlag", () => {
    let r = pos(start(), ["b6"], ["h4"]);
    r = mv(r, "b6", "c7");
    r = mv(r, "h4", "g3");
    r = mv(r, "c7", "d8");
    expect(g(r).board[sq("d8")]).toBe(2);
    // Schlag über c7 nach d8, dann rückwärts weiter über e7 nach f6: bleibt ein Stein
    const r2 = pos(start(), ["b6"], ["c7", "e7", "a1"]);
    expect(names(g(r2))).toEqual(["b6-d8-f6"]);
    expect(g(mv(r2, "b6", "d8", "f6")).board[sq("f6")]).toBe(1);
  });

  it("Fliegende Dame: zieht weit und landet hinter dem geschlagenen Stein, wo sie will", () => {
    const r = pos(start(), ["Ka1", "h2"], ["d4", "a7"]);
    // Schlagzwang: a1×d4, Landung auf e5, f6, g7 oder h8
    expect(names(g(r))).toEqual(["a1-e5", "a1-f6", "a1-g7", "a1-h8"]);
    const quiet = pos(start(), ["Ka1"], ["h8"]);
    expect(names(g(quiet))).toEqual(["a1-b2", "a1-c3", "a1-d4", "a1-e5", "a1-f6", "a1-g7"]);
    // Englisch: Dame nur ein Feld, schlägt nur aus der Nähe
    expect(names(g(quiet), { flying: false })).toEqual(["a1-b2"]);
    expect(names(g(r), { flying: false }).filter((m) => m.startsWith("a1"))).toEqual(["a1-b2"]);
  });

  it("Dame darf denselben Stein nicht zweimal überspringen", () => {
    const r = pos(start(), ["Kc1"], ["d2", "f4", "a7"]);
    const moves = names(g(r));
    expect(moves.every((m) => m.startsWith("c1-e3"))).toBe(true);
    expect(moves).toContain("c1-e3-g5");
  });

  it("Pusten: wer nicht schlägt, verliert den Stein, wenn der Gegner pustet", () => {
    let r = pos(start({ capture: "blow" }), ["d4", "a1"], ["e5", "h8"]);
    r = mv(r, "a1", "b2"); // hätte d4×f6 schlagen können
    expect(g(r).blow).toEqual([sq("d4")]);
    r = game(r, { type: "blow", at: sq("d4") });
    expect(g(r).board[sq("d4")]).toBe(0);
    expect(g(r).turn).toBe(1);
    expect(() => game(r, { type: "blow", at: sq("b2") })).toThrow(/pusten/);
    r = mv(r, "e5", "d4");
    expect(g(r).blow).toEqual([]);
  });

  it("Ohne Steine oder ohne Zug verloren", () => {
    // Weiß hat nur a1, davor b2 und c3 von Schwarz – nach h8-g7 kann Weiß nicht mehr ziehen
    const r = mv(pos(start(), ["a1"], ["h8", "b2", "c3"], 1), "h8", "g7");
    expect(g(r).winner).toBe(1);
    expect(g(r).end).toMatch(/nicht mehr ziehen/);
    const end = mv(pos(start(), ["c3"], ["d4"]), "c3", "e5");
    expect(g(end).winner).toBe(0);
    expect(g(end).end).toMatch(/keine Steine/);
  });

  it("Remis nach Damenzügen ohne Schlagen (Einstellung)", () => {
    let r = pos(start({ draw: "15" }), ["Ka1"], ["Kh8"]);
    r = { ...r, game: { ...g(r), quiet: 29 } };
    r = mv(r, "a1", "b2");
    expect(g(r).draw).toBe(true);
  });

  it("Nochmal: Schwarz und Weiß tauschen", () => {
    const r = act(start(), { type: "restart" });
    expect(g(r).colors).toEqual(["p2", "p1"]);
  });
});

describe("Dame 10×10 (international): Mehrheitsschlag", () => {
  /** Feldname wie „c3“ → Index (10×10) */
  const sq10 = (n: string) => (Number(n.slice(1)) - 1) * 10 + "abcdefghij".indexOf(n[0]);
  function pos10(w: string[], b: string[]): RoomState {
    const r = start({ size: "10" });
    const board = Array(100).fill(0);
    for (const x of w) board[sq10(x.replace("K", ""))] = x.startsWith("K") ? 2 : 1;
    for (const x of b) board[sq10(x.replace("K", ""))] = x.startsWith("K") ? -2 : -1;
    return { ...r, game: { ...g(r), board, turn: 0, blow: [], quiet: 0 } };
  }
  const names10 = (s: DameState, o: Record<string, unknown> = { size: "10" }) =>
    legalMoves(s, o as never).map((m) => [m.from, ...m.path].map((i) => `${"abcdefghij"[i % 10]}${Math.floor(i / 10) + 1}`).join("-")).sort();
  const mv10 = (r: RoomState, from: string, ...path: string[]) => game(r, { type: "move", from: sq10(from), path: path.map(sq10) });

  it("nur die Schlagfolge mit den meisten Steinen ist erlaubt", () => {
    // a1×c3×a5 (zwei Steine) gegen h2×f4 (einer): international nur die zwei
    const r = pos10(["a1", "h2"], ["b2", "b4", "g3", "a9"]);
    expect(names10(g(r))).toEqual(["a1-c3-a5"]);
    expect(() => mv10(r, "h2", "f4")).toThrow(/Mehrheitsschlag/);
    expect(g(mv10(r, "a1", "c3", "a5")).board.filter((v) => v < 0)).toHaveLength(2);
  });

  it("gleich viele: freie Wahl; ohne Schlagzwang (Pusten, frei) gilt keine Mehrheit", () => {
    const r = pos10(["a1", "h2"], ["b2", "g3", "a9"]);
    expect(names10(g(r))).toEqual(["a1-c3", "h2-f4"]);
    const two = pos10(["a1", "h2"], ["b2", "b4", "g3", "a9"]);
    expect(names10(g(two), { size: "10", capture: "free" })).toEqual(expect.arrayContaining(["a1-c3-a5", "h2-f4"]));
  });

  it("8×8 (deutsch) bleibt bei freier Wahl zwischen Schlägen", () => {
    const r = pos(start(), ["a1", "h2"], ["b2", "b4", "g3", "a7"]);
    expect(names(g(r))).toEqual(["a1-c3-a5", "h2-f4"]);
  });
});
