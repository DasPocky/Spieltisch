import { afterEach, describe, expect, it, vi } from "vitest";
import { colorsFor, globalField, HOME, legalMoves, ludo, rulesOf, threeTries, type LudoState } from "@shared/games/ludo/logic";
import type { RoomState } from "@shared/platform/room";
import { act, fixDice, game, roomWith } from "./helpers";

afterEach(() => vi.restoreAllMocks());

const g = (r: RoomState) => r.game as LudoState;
function start(names = ["Anna", "Ben"], options: Record<string, string | boolean> = {}) {
  let r = act(roomWith(names), { type: "selectGame", gameId: "ludo" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Spielstand direkt setzen (Positionen je Spieler, wer dran ist) */
function put(r: RoomState, pos: Record<string, number[]>, curId = "p1"): RoomState {
  return { ...r, game: { ...g(r), pos: { ...g(r).pos, ...pos }, curId, die: null, tries: 0 } };
}
function roll(r: RoomState, v: number) {
  fixDice([v]);
  const out = game(r, { type: "roll" });
  vi.restoreAllMocks();
  return out;
}
const moves = (r: RoomState) => legalMoves(g(r), g(r).curId!, g(r).die!, rulesOf(r.options));

describe("Aufbau", () => {
  it("Original: eine Figur auf dem Startfeld, drei im Haus; zwei Spieler sitzen gegenüber", () => {
    const r = start();
    expect(g(r).pos.p1).toEqual([0, HOME, HOME, HOME]);
    expect(g(r).color).toEqual({ p1: 0, p2: 2 });
    expect(g(r).curId).toBe("p1");
  });
  it("Hausregel: alle im Haus", () => {
    expect(g(start(["A", "B"], { start: "home" })).pos.p1).toEqual([HOME, HOME, HOME, HOME]);
  });
  it("Farben je Spielerzahl", () => {
    expect(colorsFor(3, 4)).toEqual([0, 1, 2]);
    expect(colorsFor(3, 6)).toEqual([0, 2, 4]);
    expect(colorsFor(6, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("6er-Brett erlaubt sechs Spieler, 4er nur vier", () => {
    expect(ludo.playerLimits!({ board: "4" }).max).toBe(4);
    expect(ludo.playerLimits!({ board: "6" }).max).toBe(6);
    const r = start(["A", "B", "C", "D", "E", "F"], { board: "6" });
    expect(g(r).board).toBe(6);
    expect(globalField(5, 9, 6)).toBe(59);
    expect(globalField(5, 10, 6)).toBe(0);
  });
});

describe("Würfeln und Ziehen", () => {
  it("Startfeld muss zuerst geräumt werden", () => {
    let r = start(["A", "B"], { start: "one" });
    r = put(r, { p1: [0, HOME, HOME, HOME] });
    r = roll(r, 3);
    expect(moves(r).map((m) => m.piece)).toEqual([0]);
    r = game(r, { type: "move", piece: 0 });
    expect(g(r).pos.p1[0]).toBe(3);
    expect(g(r).curId).toBe("p2");
  });

  it("6: Figur muss raus, dann nochmal würfeln", () => {
    let r = start();
    r = put(r, { p1: [5, HOME, HOME, HOME] });
    r = roll(r, 6);
    expect(moves(r).every((m) => m.from === HOME)).toBe(true);
    expect(() => game(r, { type: "move", piece: 0 })).toThrow(/muss eine Figur raus/);
    r = game(r, { type: "move", piece: 1 });
    expect(g(r).pos.p1).toEqual([5, 0, HOME, HOME]);
    expect(g(r).curId).toBe("p1");
    expect(g(r).die).toBe(null);
    // jetzt muss das Startfeld geräumt werden
    r = roll(r, 2);
    expect(moves(r).map((m) => m.piece)).toEqual([1]);
  });

  it("Startfeld besetzt von eigener Figur: die 6 zieht diese Figur weiter", () => {
    let r = put(start(), { p1: [0, HOME, HOME, HOME] });
    r = roll(r, 6);
    expect(moves(r)).toEqual([expect.objectContaining({ piece: 0, from: 0, to: 6 })]);
  });

  it("Ist das Startfeld blockiert (eigene Figur im Weg), darf eine andere ziehen", () => {
    let r = put(start(), { p1: [0, 4, HOME, HOME] });
    r = roll(r, 4);
    expect(moves(r).map((m) => m.piece)).toEqual([1]);
  });

  it("Schlagen: fremde Figur zurück ins Haus", () => {
    let r = start();
    // p2 ist Farbe 2: sein Feld 0 ist global 20. p1 steht auf 17 und würfelt 3.
    r = put(r, { p1: [17, HOME, HOME, 39], p2: [0, 3, HOME, HOME] });
    r = roll(r, 3);
    r = game(r, { type: "move", piece: 0 });
    expect(g(r).pos.p2).toEqual([HOME, 3, HOME, HOME]);
    expect(g(r).last?.hit).toEqual({ pid: "p2", piece: 0, from: 0 });
    expect(g(r).log.at(-1)).toMatch(/schlägt B/);
  });

  it("Nicht auf eigene Figuren ziehen, aber über sie springen", () => {
    let r = put(start(), { p1: [5, 8, 10, HOME] });
    r = roll(r, 3);
    expect(moves(r).map((m) => m.piece).sort()).toEqual([1, 2]);
  });

  it("Ins Ziel genau passend und ohne Überspringen", () => {
    let r = put(start(), { p1: [38, 42, HOME, 43] });
    r = roll(r, 5); // 38+5 = 43 besetzt
    expect(g(r).die).toBe(null);
    expect(g(r).curId).toBe("p2");
    r = put(r, { p1: [38, 41, HOME, 43] });
    r = roll(r, 4); // 42: über die 41 springen geht nicht
    expect(g(r).die).toBe(null);
    r = put(r, { p1: [38, 41, HOME, 43] });
    r = roll(r, 2); // 40: frei, nichts übersprungen
    expect(moves(r).map((m) => m.to)).toContain(40);
  });

  it("Hausregel: im Ziel überspringen", () => {
    let r = put(start(["A", "B"], { goalJump: true }), { p1: [38, 41, HOME, 43] });
    r = roll(r, 4);
    expect(moves(r).map((m) => m.to)).toContain(42);
  });

  it("Bis zu dreimal würfeln ohne Figur auf der Bahn", () => {
    let r = put(start(), { p1: [HOME, HOME, HOME, HOME] });
    expect(threeTries(g(r), "p1", rulesOf(r.options))).toBe(true);
    r = roll(r, 2);
    expect(g(r).curId).toBe("p1");
    r = roll(r, 3);
    expect(g(r).curId).toBe("p1");
    r = roll(r, 4);
    expect(g(r).curId).toBe("p2");
  });

  it("Dreimal würfeln auch, wenn die Figuren im Ziel ganz hinten stehen – sonst nicht", () => {
    const r = start();
    const rules = rulesOf(r.options);
    expect(threeTries({ ...g(r), pos: { ...g(r).pos, p1: [43, 42, HOME, HOME] } }, "p1", rules)).toBe(true);
    expect(threeTries({ ...g(r), pos: { ...g(r).pos, p1: [43, 40, HOME, HOME] } }, "p1", rules)).toBe(false);
  });

  it("6 beim dritten Versuch: raus und nochmal", () => {
    let r = put(start(), { p1: [HOME, HOME, HOME, HOME] });
    r = roll(roll(r, 1), 2);
    r = roll(r, 6);
    r = game(r, { type: "move", piece: 2 });
    expect(g(r).pos.p1[2]).toBe(0);
    expect(g(r).curId).toBe("p1");
  });

  it("Kein Zug möglich: der Nächste ist dran", () => {
    let r = put(start(), { p1: [39, 40, 41, 42] });
    r = roll(r, 5);
    expect(g(r).curId).toBe("p2");
    expect(g(r).log.at(-1)).toMatch(/kein Zug/);
  });

  it("Erster mit allen im Ziel gewinnt", () => {
    let r = put(start(), { p1: [39, 41, 42, 43] });
    r = roll(r, 1);
    r = game(r, { type: "move", piece: 0 });
    expect(g(r).finished).toBe(true);
    expect(r.phase).toBe("playing");
    const res = ludo.results!(g(r), { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.find((x) => x.id === "p1")).toMatchObject({ won: true, score: 4 });
  });

  it("Alle Plätze: weiter bis zum Letzten", () => {
    let r = put(start(["A", "B", "C"], { end: "all" }), { p1: [39, 41, 42, 43] });
    r = roll(r, 1);
    r = game(r, { type: "move", piece: 0 });
    expect(g(r).finished).toBe(false);
    expect(g(r).places).toEqual(["p1"]);
    expect(g(r).curId).toBe("p2");
  });
});

describe("Hausregeln", () => {
  it("Schlagzwang", () => {
    let r = start(["A", "B"], { mustHit: true });
    r = put(r, { p1: [17, 5, HOME, HOME], p2: [0, HOME, HOME, HOME] }, "p1");
    r = roll(r, 3);
    expect(moves(r).map((m) => m.piece)).toEqual([0]);
    expect(() => game(r, { type: "move", piece: 1 })).toThrow(/Schlagzwang/);
  });

  it("Startfeld blockieren: dort sicher", () => {
    let r = start(["A", "B"], { startField: "block" });
    r = put(r, { p1: [17, 5, HOME, HOME], p2: [0, HOME, HOME, HOME] }, "p1");
    r = roll(r, 3);
    expect(moves(r).map((m) => m.piece)).toEqual([1]);
  });

  it("Startfeld stehen lassen: andere Figur darf ziehen", () => {
    let r = put(start(["A", "B"], { startField: "free" }), { p1: [0, 5, HOME, HOME] });
    r = roll(r, 2);
    expect(moves(r).map((m) => m.piece).sort()).toEqual([0, 1]);
  });

  it("Rückwärts schlagen", () => {
    let r = start(["A", "B"], { backward: true });
    // p2 (Farbe 2) auf seinem Feld 3 = global 23; p1 auf 25 würfelt 2
    r = put(r, { p1: [25, HOME, HOME, HOME], p2: [3, HOME, HOME, HOME] }, "p1");
    r = roll(r, 2);
    expect(moves(r)).toEqual(expect.arrayContaining([expect.objectContaining({ piece: 0, to: 23, back: true })]));
    r = game(r, { type: "move", piece: 0, back: true });
    expect(g(r).pos.p2[0]).toBe(HOME);
  });

  it("Auch mit 1 raus", () => {
    let r = put(start(["A", "B"], { outOn1: true, start: "home" }), { p1: [HOME, HOME, HOME, HOME] });
    r = roll(r, 1);
    r = game(r, { type: "move", piece: 0 });
    expect(g(r).pos.p1[0]).toBe(0);
    expect(g(r).curId).toBe("p2");
  });
});

describe("Echter Würfel, Rechte und Abbrüche", () => {
  it("Zahl eintippen", () => {
    let r = start(["A", "B"], { dice: "real" });
    expect(() => game(r, { type: "roll" })).toThrow(/1 bis 6/);
    expect(() => game(r, { type: "roll", value: 7 })).toThrow(/1 bis 6/);
    r = game(r, { type: "roll", value: 4 });
    expect(g(r).die).toBe(4);
    expect(() => game(r, { type: "roll", value: 2 })).toThrow(/Erst ziehen/);
  });

  it("App-Würfel nimmt keine Zahl an", () => {
    expect(() => game(start(), { type: "roll", value: 6 })).toThrow(/App würfelt/);
  });

  it("Ungültige Figuren werden abgelehnt", () => {
    const r = roll(start(), 3);
    expect(() => game(r, { type: "move", piece: 9 })).toThrow(/gibt es nicht/);
    expect(() => game(start(), { type: "move", piece: 0 })).toThrow(/Erst würfeln/);
  });

  it("Überspringen und Spieler verlässt das Spiel", () => {
    let r = start(["A", "B", "C"]);
    r = act(r, { type: "skip" });
    expect(g(r).curId).toBe("p2");
    r = act(r, { type: "removePlayer", id: "p2" });
    expect(g(r).curId).toBe("p3");
    expect(g(r).pos.p2).toBeUndefined();
    r = act(r, { type: "removePlayer", id: "p3" });
    expect(r.phase === "lobby" || g(r).finished).toBe(true);
  });
});
