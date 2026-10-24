import { afterEach, describe, expect, it, vi } from "vitest";
import { handOf, inPlay, LIDS, ranked, schocken, suggest, type ShState } from "@shared/games/schocken/logic";
import { applyRoomAction, roomGame, skipLabel, type RoomState } from "@shared/platform/room";
import { act, fixDice, game, roomWith } from "./helpers";
import { narration } from "../../src/games/schocken/narration";

const g = (r: RoomState) => r.game as ShState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil"].slice(0, n)), { type: "selectGame", gameId: "schocken" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Würfeln mit festen Augen (nur die nicht herausgelegten Würfel bekommen neue) */
function roll(r: RoomState, faces: number[]) {
  const spy = fixDice(faces);
  try { return game(r, { type: "roll" }); } finally { spy.mockRestore(); }
}
/** Ein ganzer Zug: einmal würfeln, stehen lassen */
const once = (r: RoomState, faces: number[]) => game(roll(r, faces), { type: "stop" });
afterEach(() => vi.restoreAllMocks());

describe("Schocken: Rangfolge", () => {
  it("Schock aus > Schock 6…2 > General > Straße > Zahl", () => {
    const order = [[1, 1, 1], [1, 6, 1], [1, 1, 5], [1, 1, 2], [6, 6, 6], [2, 2, 2], [4, 6, 5], [1, 2, 3], [6, 5, 3], [6, 5, 2], [4, 2, 1], [2, 2, 1]];
    const scores = order.map((d) => handOf(d).score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(handOf([1, 1, 1])).toMatchObject({ kind: "aus", label: "Schock aus", lids: LIDS });
    expect(handOf([4, 1, 1])).toMatchObject({ kind: "schock", label: "Schock 4", lids: 4 });
    expect(handOf([5, 5, 5])).toMatchObject({ kind: "general", label: "Fünfer-General", lids: 3 });
    expect(handOf([3, 5, 4])).toMatchObject({ kind: "strasse", label: "Straße 3-4-5", lids: 2 });
    expect(handOf([3, 6, 5])).toMatchObject({ kind: "zahl", label: "653", lids: 1 });
    expect(handOf([1, 1, 1]).score).toBeGreaterThan(handOf([1, 1, 6]).score);
  });

  it("Gleicher Wurf: weniger Würfe vorn, sonst wer früher dran war", () => {
    const hands = { a: { dice: [6, 5, 3], throws: 2 }, b: { dice: [3, 5, 6], throws: 1 }, c: { dice: [6, 3, 5], throws: 2 } };
    expect(ranked({ hands, order: ["a", "b", "c"] })).toEqual(["b", "a", "c"]);
  });
});

describe("Schocken: Runde", () => {
  it("Beginner legt die Wurfzahl vor, Herauslegen behält Würfel", () => {
    let r = start(3);
    expect(g(r).curId).toBe("p1");
    r = roll(r, [1, 4, 6]);
    r = game(r, { type: "hold", i: 0 });
    r = roll(r, [1, 1]);
    expect(g(r).dice).toEqual([1, 1, 1]);
    r = game(r, { type: "stop" });
    expect(g(r).limit).toBe(2);
    expect(g(r).curId).toBe("p2");
    r = roll(r, [2, 3, 5]);
    r = roll(r, [6, 6, 6]);
    // dritter Wurf ist nicht erlaubt
    expect(() => roll(r, [1, 1, 1])).toThrow(/2 Würfe/);
    expect(() => game(r, { type: "hold", i: 0 })).toThrow();
    r = game(r, { type: "stop" });
    r = once(r, [4, 2, 2]);
    // Schock aus: Cem bekommt alle Deckel und verliert die Hälfte
    const s = g(r);
    expect(s.phase).toBe("roundEnd");
    expect(s.last).toMatchObject({ winner: "p1", loser: "p3", aus: true, halfLost: "p3", moved: LIDS });
    expect(s.lids.p3).toBe(LIDS);
    expect(s.halfLosers).toEqual(["p3"]);
    r = game(r, { type: "next" });
    expect(g(r)).toMatchObject({ half: 2, pot: LIDS, curId: "p3" });
  });

  it("Erst würfeln, dann stehen lassen; alle drei draußen: nicht mehr würfeln", () => {
    let r = start(2);
    expect(() => game(r, { type: "stop" })).toThrow(/Erst würfeln/);
    r = roll(r, [2, 3, 4]);
    for (const i of [0, 1, 2]) r = game(r, { type: "hold", i });
    expect(() => roll(r, [])).toThrow(/stehen/);
  });

  it("Deckel erst aus der Mitte, dann vom Gewinner; ohne Deckel raus; alle 13 = Hälfte verloren", () => {
    let r = start(3);
    // Anna Schock 5, Ben Zahl, Cem Straße → Ben bekommt 5 aus der Mitte
    r = once(r, [1, 1, 5]); r = once(r, [4, 2, 2]); r = once(r, [2, 3, 4]);
    expect(g(r).last).toMatchObject({ winner: "p1", loser: "p2", moved: 5, from: "pot" });
    expect(g(r).pot).toBe(8);
    r = game(r, { type: "next" });
    expect(g(r).curId).toBe("p2");
    // Ben beginnt: Ben Schock 6, Cem Zahl, Anna Schock 3 → Cem 6
    r = once(r, [1, 1, 6]); r = once(r, [5, 3, 2]); r = once(r, [1, 3, 1]);
    expect(g(r).lids).toEqual({ p1: 0, p2: 5, p3: 6 });
    expect(g(r).pot).toBe(2);
    r = game(r, { type: "next" });
    // Cem beginnt: Cem Zahl, Anna General, Ben Zahl tiefer → Ben nur noch 2 aus der Mitte
    r = once(r, [6, 5, 2]); r = once(r, [3, 3, 3]); r = once(r, [4, 3, 1]);
    expect(g(r).last).toMatchObject({ winner: "p1", loser: "p2", worth: 3, moved: 2 });
    expect(g(r).pot).toBe(0);
    r = game(r, { type: "next" });
    // Anna hat keine Deckel und ist raus
    expect(inPlay(g(r))).toEqual(["p2", "p3"]);
    expect(g(r).order).toEqual(["p2", "p3"]);
    // Ben (7) gegen Cem (6): Cem Schock 6 → Ben bekommt 6 von Cem, hat alle 13
    r = once(r, [5, 4, 2]); r = once(r, [1, 6, 1]);
    expect(g(r).last).toMatchObject({ winner: "p3", loser: "p2", from: "winner", moved: 6, halfLost: "p2" });
    expect(g(r).lids.p2).toBe(LIDS);
  });

  it("Zwei Hälften, verschiedene Verlierer → Finale; Finale verloren → Partie verloren", () => {
    let r = start(3);
    r = once(r, [1, 1, 1]); r = once(r, [2, 2, 1]); r = once(r, [6, 5, 3]); // Ben verliert Hälfte 1
    r = game(r, { type: "next" });
    expect(g(r).curId).toBe("p2");
    r = once(r, [1, 1, 1]); r = once(r, [6, 5, 3]); r = once(r, [2, 2, 1]); // Anna verliert Hälfte 2
    expect(g(r).phase).toBe("roundEnd");
    r = game(r, { type: "next" });
    expect(g(r)).toMatchObject({ half: 3, members: ["p1", "p2"], curId: "p1" });
    r = once(r, [2, 2, 1]); r = once(r, [1, 1, 1]);
    expect(g(r)).toMatchObject({ phase: "over", loser: "p1" });
    const res = schocken.results!(g(r), { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 });
    expect(res.filter((x) => !x.won).map((x) => x.id)).toEqual(["p1"]);
  });

  it("Zweimal derselbe Verlierer: kein Finale; „Kurz“: nur eine Hälfte", () => {
    let r = start(2);
    r = once(r, [1, 1, 1]); r = once(r, [2, 2, 1]);
    r = game(r, { type: "next" });
    r = once(r, [2, 2, 1]); r = once(r, [1, 1, 1]);
    expect(g(r)).toMatchObject({ phase: "over", loser: "p2" });
    let k = start(2, { length: "half" });
    k = once(k, [2, 2, 1]); k = once(k, [1, 1, 1]);
    expect(g(k)).toMatchObject({ phase: "over", loser: "p1" });
  });

  it("Sechsen drehen: nur mit Regel, nur mit Würfen übrig, dann muss geworfen werden", () => {
    let r = start(2);
    r = roll(r, [6, 6, 3]);
    expect(() => game(r, { type: "turn" })).toThrow(/ausgeschaltet/);
    let k = start(2, { sixes: true });
    k = roll(k, [6, 6, 3]);
    k = game(k, { type: "turn" });
    expect(g(k)).toMatchObject({ dice: [1, 6, 3], held: [true, false, false], turned: true });
    expect(() => game(k, { type: "stop" })).toThrow(/Sechs/);
    k = roll(k, [1, 2]);
    expect(g(k).dice).toEqual([1, 1, 2]);
    k = roll(k, [6, 6]);
    expect(() => game(k, { type: "turn" })).toThrow(/noch würfeln/);
  });

  it("Echte Würfel: höchster, niedrigster und Wert eintippen", () => {
    let r = start(3, { mode: "table" });
    expect(() => game(r, { type: "roll" })).toThrow();
    expect(() => game(r, { type: "tally", winner: "p1", loser: "p1", count: 2 })).toThrow();
    r = game(r, { type: "tally", winner: "p1", loser: "p3", count: 4 });
    expect(g(r).lids.p3).toBe(4);
    r = game(r, { type: "next" });
    expect(g(r).curId).toBe("p3");
    r = game(r, { type: "tally", winner: "p2", loser: "p1", count: "aus" });
    expect(g(r).last?.halfLost).toBe("p1");
  });
});

describe("Schocken: nichts hängt", () => {
  it("Überspringen würfelt einmal und lässt stehen", () => {
    let r = start(2);
    expect(skipLabel(r)).toMatch(/einmal würfeln/);
    r = applyRoomAction(r, { type: "skip" }, "p1");
    expect(g(r).hands.p1?.throws).toBe(1);
    expect(g(r).curId).toBe("p2");
  });

  it("Spieler geht: Deckel zurück in die Mitte, Runde läuft weiter; im Finale verliert, wer geht", () => {
    let r = start(3);
    r = once(r, [1, 1, 5]); r = once(r, [4, 2, 2]); r = once(r, [2, 3, 4]);
    r = game(r, { type: "next" });
    expect(g(r).curId).toBe("p2");
    r = act(r, { type: "removePlayer", id: "p2" }, "p1");
    expect(g(r).pot).toBe(LIDS);
    expect(g(r).curId).toBe("p3");
    const s = g(r);
    const logic = roomGame(r)!;
    const fin = logic.onPlayerRemoved!({ ...s, half: 3, members: ["p1", "p3"] }, "p3", { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 }) as ShState;
    expect(fin).toMatchObject({ phase: "over", loser: "p3" });
  });

  it("Spielhilfe: Einsen herauslegen, Schock stehen lassen", () => {
    let r = start(2);
    r = roll(r, [1, 4, 3]);
    expect(suggest(g(r), "p1", r.options)).toEqual({ type: "roll", hold: [true, false, false] });
    r = roll(game(r, { type: "hold", i: 0 }), [1, 6]);
    expect(suggest(g(r), "p1", r.options)).toEqual({ type: "stop" });
  });

  it("Vorlesen: Wurf, Deckel, Hälfte", () => {
    const name = (id: string | null) => ({ p1: "Anna", p2: "Ben" })[id ?? ""] ?? "?";
    const r0 = start(2);
    expect(narration(null, g(r0), name).join(" ")).toContain("Erste Hälfte. 13 Deckel liegen in der Mitte. Anna beginnt.");
    const r1 = once(r0, [1, 1, 4]);
    expect(narration(g(r0), g(r1), name).join(" ")).toContain("Anna: Schock 4 mit einem Wurf. Höchstens ein Wurf für alle.");
    const r2 = once(r1, [5, 3, 2]);
    expect(narration(g(r1), g(r2), name).join(" ")).toContain("Anna hat Schock 4. Ben bekommt 4 Deckel.");
  });
});
