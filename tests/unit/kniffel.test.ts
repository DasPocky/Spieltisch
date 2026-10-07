import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_CATS, scoreFor, totals, validEntry, winners, type Cat, type KniffelState } from "@shared/games/kniffel/logic";
import type { RoomState } from "@shared/platform/room";
import { act, fixDice, game, roomWith } from "./helpers";

afterEach(() => vi.restoreAllMocks());

const g = (r: RoomState) => r.game as KniffelState;
function start(names = ["Anna", "Ben"], options: Record<string, string | boolean> = {}) {
  let r = act(roomWith(names), { type: "selectGame", gameId: "kniffel" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Einmal würfeln (mit festen Augen) und eintragen */
function turn(r: RoomState, dice: number[], cat: Cat) {
  fixDice(dice);
  r = game(r, { type: "roll" });
  vi.restoreAllMocks();
  return game(r, { type: "score", cat });
}

describe("Wertung", () => {
  it.each<[Cat, number[], number]>([
    ["ones", [1, 1, 3, 4, 1], 3], ["sixes", [6, 6, 6, 2, 6], 24], ["fives", [1, 2, 3, 4, 6], 0],
    ["three", [4, 4, 4, 2, 6], 20], ["three", [4, 4, 3, 2, 6], 0], ["four", [3, 3, 3, 3, 5], 17], ["four", [3, 3, 3, 5, 5], 0],
    ["full", [2, 2, 5, 5, 5], 25], ["full", [5, 5, 5, 5, 5], 0], ["full", [2, 2, 5, 5, 6], 0],
    ["small", [1, 2, 3, 4, 6], 30], ["small", [3, 4, 5, 6, 6], 30], ["small", [1, 2, 3, 5, 6], 0],
    ["large", [2, 3, 4, 5, 6], 40], ["large", [1, 2, 3, 4, 6], 0],
    ["kniffel", [6, 6, 6, 6, 6], 50], ["kniffel", [6, 6, 6, 6, 5], 0], ["chance", [1, 2, 3, 4, 6], 16],
  ])("%s mit %j → %i", (cat, dice, pts) => expect(scoreFor(cat, dice)).toBe(pts));

  it("Joker (Schmidt): weiterer Kniffel zählt in jedem Feld die Höchstpunktzahl", () => {
    expect(scoreFor("full", [3, 3, 3, 3, 3], true)).toBe(25);
    expect(scoreFor("large", [3, 3, 3, 3, 3], true)).toBe(40);
    expect(scoreFor("small", [3, 3, 3, 3, 3], true)).toBe(30);
    expect(scoreFor("four", [3, 3, 3, 3, 3], true)).toBe(30);
    expect(scoreFor("chance", [2, 2, 2, 2, 2], true)).toBe(30);
    expect(scoreFor("fives", [4, 4, 4, 4, 4], true)).toBe(25); // 4er-Kniffel → 25 bei den Fünfern
    expect(scoreFor("full", [1, 1, 1, 2, 2], true)).toBe(25); // kein Kniffel: normal
    expect(scoreFor("sixes", [1, 1, 1, 2, 2], true)).toBe(0);
  });

  it("Eingaben mit echten Würfeln werden geprüft", () => {
    expect(validEntry("fours", 12)).toBe(true);
    expect(validEntry("fours", 10)).toBe(false);
    expect(validEntry("fours", 24)).toBe(false);
    expect(validEntry("full", 25)).toBe(true);
    expect(validEntry("full", 20)).toBe(false);
    expect(validEntry("three", 0)).toBe(true);
    expect(validEntry("three", 31)).toBe(false);
    expect(validEntry("chance", 0)).toBe(false);
    expect(validEntry("chance", 2.5)).toBe(false);
  });
});

describe("Ablauf mit App-Würfel", () => {
  it("höchstens drei Würfe, gehaltene Würfel bleiben liegen", () => {
    let r = start();
    fixDice([6, 6, 1, 2, 3, /* 2. Wurf */ 6, 4, 5, /* 3. Wurf */ 6, 6]);
    r = game(r, { type: "roll" });
    r = game(game(r, { type: "hold", i: 0 }), { type: "hold", i: 1 });
    r = game(r, { type: "roll" });
    expect(g(r).dice).toEqual([6, 6, 6, 4, 5]);
    r = game(r, { type: "hold", i: 2 });
    r = game(r, { type: "roll" });
    expect(g(r).dice).toEqual([6, 6, 6, 6, 6]);
    expect(g(r).rollsLeft).toBe(0);
    expect(() => game(r, { type: "roll" })).toThrow(/Keine Würfe/);
    r = game(r, { type: "score", cat: "kniffel" });
    expect(g(r).sheets.p1.kniffel).toBe(50);
    expect(g(r).curId).toBe("p2");
    expect(g(r).dice).toEqual([]);
  });

  it("erst würfeln, jedes Feld nur einmal", () => {
    let r = start(["Anna"]);
    expect(() => game(r, { type: "score", cat: "chance" })).toThrow(/Erst würfeln/);
    r = turn(r, [1, 2, 3, 4, 5], "chance");
    fixDice([1, 1, 1, 1, 1]);
    r = game(r, { type: "roll" });
    expect(() => game(r, { type: "score", cat: "chance" })).toThrow(/schon eingetragen/);
  });

  it("Streichen gibt 0 Punkte", () => {
    const r = turn(start(), [1, 2, 3, 4, 6], "kniffel");
    expect(g(r).sheets.p1.kniffel).toBe(0);
  });

  it("Bonus ab 63 im oberen Teil", () => {
    let r = start(["Anna"]);
    const ups: [Cat, number][] = [["ones", 1], ["twos", 2], ["threes", 3], ["fours", 4], ["fives", 5], ["sixes", 6]];
    for (const [cat, f] of ups) r = turn(r, [f, f, f, 1 === f ? 2 : 1, 1 === f ? 2 : 1], cat);
    const t = totals(g(r), "p1");
    expect(t.upper).toBe(63); // je drei Gleiche
    expect(t.bonus).toBe(35);
  });

  it("weiterer Kniffel: Original +50 und Joker, Hausregel „Ohne Extra“ nicht", () => {
    let r = start(["Anna"]);
    r = turn(r, [2, 2, 2, 2, 2], "kniffel");
    r = turn(r, [2, 2, 2, 2, 2], "large");
    expect(g(r).sheets.p1.large).toBe(40);
    r = turn(r, [2, 2, 2, 2, 2], "sixes");
    expect(g(r).sheets.p1.sixes).toBe(30);
    expect(totals(g(r), "p1").extra).toBe(100);

    let c = start(["Anna"], { moreKniffel: "none" });
    c = turn(c, [2, 2, 2, 2, 2], "kniffel");
    c = turn(c, [2, 2, 2, 2, 2], "large");
    expect(g(c).sheets.p1.large).toBe(0);
    expect(totals(g(c), "p1").extra).toBe(0);
  });

  it("gestrichenes Kniffel-Feld: weiterer Kniffel zählt normal", () => {
    let r = start(["Anna"]);
    r = turn(r, [1, 2, 3, 4, 6], "kniffel"); // gestrichen
    r = turn(r, [3, 3, 3, 3, 3], "full");
    expect(g(r).sheets.p1.full).toBe(0);
    expect(totals(g(r), "p1").extra).toBe(0);
  });

  it("Partie endet, wenn alle Blöcke voll sind", () => {
    let r = start(["Anna", "Ben"]);
    for (const cat of ALL_CATS) {
      r = turn(r, [1, 2, 3, 4, 5], cat); // Anna
      r = turn(r, [6, 6, 6, 6, 6], cat); // Ben
    }
    expect(g(r).finished).toBe(true);
    expect(() => game(r, { type: "roll" })).toThrow(/entschieden/);
    expect(winners(g(r), ["p1", "p2"])).toEqual(["p2"]);
    r = game(r, { type: "undo" });
    expect(g(r).finished).toBe(false);
    expect(g(r).curId).toBe("p2");
  });
});

describe("Echte Würfel (Block)", () => {
  const real = () => start(["Anna", "Ben"], { diceMode: "real" });

  it("Werte eintippen", () => {
    let r = game(real(), { type: "score", cat: "fours", value: 12 });
    expect(g(r).sheets.p1.fours).toBe(12);
    expect(() => game(r, { type: "score", cat: "full", value: 20 })).toThrow(/gehen bei Full House nicht/);
    expect(() => game(r, { type: "roll" })).toThrow(/echten Würfeln/);
    r = game(r, { type: "score", cat: "full", value: 25 });
    expect(g(r).sheets.p2.full).toBe(25);
  });

  it("weiterer Kniffel braucht 50 im Kniffel-Feld und zählt die Höchstpunktzahl", () => {
    expect(() => game(real(), { type: "score", cat: "chance", value: 20, extra: true })).toThrow(/erst, wenn/);
    let r = start(["Anna"], { diceMode: "real" });
    r = game(r, { type: "score", cat: "kniffel", value: 50 });
    r = game(r, { type: "score", cat: "fours", value: 8, extra: true });
    expect(g(r).sheets.p1.fours).toBe(20);
    expect(totals(g(r), "p1").total).toBe(120);
    const off = game(start(["Anna"], { diceMode: "real", moreKniffel: "none" }), { type: "score", cat: "kniffel", value: 50 });
    expect(() => game(off, { type: "score", cat: "chance", value: 30, extra: true })).toThrow(/ausgeschaltet/);
  });
});

describe("Rechte und Spieler", () => {
  it("nur wer dran ist", () => {
    const r = start();
    expect(() => game(r, { type: "roll" }, "p2")).toThrow(/Anna ist am Zug/);
  });

  it("Beitritt während der Partie: Wartebank, ab „Nochmal“ dabei", async () => {
    const { addPlayer } = await import("@shared/platform/room");
    let r = addPlayer(start(), { id: "x", name: "Cem" });
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Ben"]);
    expect(r.bench?.map((p) => p.name)).toEqual(["Cem"]);
    expect(() => addPlayer(r, { id: "y", name: "cem" })).toThrow(/spielt schon mit/);
    // Wer auf der Bank sitzt, darf nicht mitspielen
    expect(() => game(r, { type: "roll" }, "x")).toThrow();
    r = act(r, { type: "restart" });
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Ben", "Cem"]);
    expect(r.bench).toBeUndefined();
    expect(Object.keys((r.game as KniffelState).sheets)).toContain("x");
  });

  it("Wartebank: Host entfernt jemanden, Lobby holt alle rein", async () => {
    const { addPlayer } = await import("@shared/platform/room");
    let r = addPlayer(addPlayer(start(), { id: "x", name: "Cem" }), { id: "y", name: "Dora" });
    r = act(r, { type: "removePlayer", id: "x" });
    expect(r.bench?.map((p) => p.name)).toEqual(["Dora"]);
    expect(r.phase).toBe("playing");
    r = act(r, { type: "toLobby" });
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Ben", "Dora"]);
  });

  it("Spieler am Zug wird entfernt", () => {
    fixDice([1, 2, 3, 4, 5]);
    let r = game(start(["Anna", "Ben", "Cem"]), { type: "roll" });
    r = act(r, { type: "removePlayer", id: "p1" });
    expect(g(r).curId).toBe("p2");
    expect(g(r).dice).toEqual([]);
  });
});
