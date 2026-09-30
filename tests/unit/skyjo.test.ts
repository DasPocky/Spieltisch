import { describe, expect, it } from "vitest";
import { buildDeck, roundPoints, type SkState } from "@shared/games/skyjo/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as SkState;
function start(n = 3, options: Record<string, string | number> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "skyjo" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Raster fest vorgeben (alle verdeckt) */
function grids(r: RoomState, values: Record<string, number[]>): RoomState {
  const s = g(r);
  return { ...r, game: { ...s, grids: Object.fromEntries(Object.entries(values).map(([id, vs]) => [id, vs.map((v) => ({ v, up: false }))])) } };
}
const flipAll2 = (r: RoomState, ids: string[]) => ids.reduce((q, id) => game(game(q, { type: "flipStart", player: id, i: 0 }), { type: "flipStart", player: id, i: 1 }), r);

describe("Skyjo", () => {
  it("150 Karten: 5×−2, 10×−1, 15×0, je 10× 1–12", () => {
    const d = buildDeck();
    expect(d).toHaveLength(150);
    expect(d.filter((v) => v === -2)).toHaveLength(5);
    expect(d.filter((v) => v === 0)).toHaveLength(15);
    expect(d.filter((v) => v === 12)).toHaveLength(10);
  });

  it("Austeilen: 12 verdeckte Karten, eine offene Ablage; höchste Startsumme beginnt", () => {
    let r = start(2);
    expect(g(r).grids.p1).toHaveLength(12);
    expect(g(r).discard).toHaveLength(1);
    r = grids(r, { p1: [1, 2, ...Array(10).fill(5)], p2: [9, 9, ...Array(10).fill(5)] });
    r = flipAll2(r, ["p1", "p2"]);
    expect(g(r).phase).toBe("turn");
    expect(g(r).curId).toBe("p2");
    expect(() => game(r, { type: "flipStart", player: "p1", i: 3 })).toThrow(/schon/);
  });

  it("Verdeckte Karten sieht niemand – auch nicht der Besitzer", () => {
    let r = start(2);
    r = act(roomWith(["A", "B"]), { type: "selectGame", gameId: "skyjo" });
    r = act(r, { type: "start" }, "p1");
    const v = g(viewRoom(r, "p1"));
    expect(v.grids.p1.every((c) => c!.v === null)).toBe(true);
    expect(v.deck).toEqual([]);
    expect(v.deckCount).toBeGreaterThan(100);
  });

  it("Zug: ziehen und tauschen, ablegen und umdrehen, Spalte abräumen", () => {
    let r = start(2);
    r = grids(r, { p1: [7, 7, 0, 0, 7, 1, 1, 1, 3, 3, 3, 3], p2: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9] });
    r = flipAll2(r, ["p1", "p2"]); // p2 beginnt (18 > 14)
    expect(g(r).curId).toBe("p2");
    r = { ...r, game: { ...g(r), deck: [...g(r).deck, 4] } };
    r = game(r, { type: "draw", from: "deck" });
    expect(g(r).drawn).toBe(4);
    r = game(r, { type: "discardDrawn" });
    expect(() => game(r, { type: "flip", i: 0 })).toThrow(/schon offen/);
    r = game(r, { type: "flip", i: 2 });
    expect(g(r).curId).toBe("p1");
    // p1: Spalte 0 = Plätze 0, 4, 8 → 7, 7, 3; mit einer 7 aus der Ablage auf Platz 8 wird sie abgeräumt
    r = { ...r, game: { ...g(r), discard: [...g(r).discard, 7], grids: { ...g(r).grids, p1: g(r).grids.p1.map((c, i) => (i === 4 ? { v: 7, up: true } : c)) } } };
    r = game(r, { type: "draw", from: "discard" });
    expect(() => game(r, { type: "discardDrawn" })).toThrow(/Stapel/);
    r = game(r, { type: "swap", i: 8 });
    expect(g(r).grids.p1[0]).toBeNull();
    expect(g(r).grids.p1[4]).toBeNull();
    expect(g(r).grids.p1[8]).toBeNull();
  });

  it("Verdopplung: Beender nicht allein am wenigsten", () => {
    expect(roundPoints({ a: 10, b: 20 }, "a")).toEqual({ points: { a: 10, b: 20 }, doubled: false });
    expect(roundPoints({ a: 10, b: 10 }, "a")).toEqual({ points: { a: 20, b: 10 }, doubled: true });
    expect(roundPoints({ a: 15, b: 5 }, "a").points.a).toBe(30);
    expect(roundPoints({ a: -3, b: -5 }, "a").points.a).toBe(-3); // Minus wird nicht verdoppelt
  });

  it("Rundenende: wer alles offen hat, danach jeder noch einmal", () => {
    let r = start(3);
    r = grids(r, { p1: [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2], p2: [5, 6, 7, 8, 6, 7, 8, 5, 7, 8, 5, 6], p3: [9, 8, 7, 6, 8, 7, 6, 9, 7, 6, 9, 8] });
    // p1 hat bis auf eine Karte alles offen
    r = flipAll2(r, ["p1", "p2", "p3"]);
    r = { ...r, game: { ...g(r), curId: "p1", grids: { ...g(r).grids, p1: g(r).grids.p1.map((c, i) => ({ ...c!, up: i !== 11 })) } } };
    r = { ...r, game: { ...g(r), deck: [...g(r).deck, 2] } };
    r = game(game(r, { type: "draw", from: "deck" }), { type: "discardDrawn" }); // alles offen → mustFlip? nein, eine verdeckte bleibt
    r = game(r, { type: "flip", i: 11 });
    expect(g(r).ender).toBe("p1");
    expect(g(r).lastTurns).toEqual(["p2", "p3"]);
    for (const id of ["p2", "p3"]) {
      expect(g(r).curId).toBe(id);
      r = game(game(r, { type: "draw", from: "deck" }), { type: "discardDrawn" });
      r = game(r, { type: "flip", i: 5 });
    }
    expect(g(r).phase).toBe("roundEnd");
    expect(g(r).rounds[0].points.p1).toBe(30); // nicht verdoppelt: p1 hat allein am wenigsten
    r = game(r, { type: "nextRound" });
    expect(g(r).phase).toBe("flip");
    r = flipAll2(r, ["p1", "p2", "p3"]);
    expect(g(r).curId).toBe("p1"); // Beender beginnt
  });

  it("Echte Karten: Punkteblock mit Verdopplung und Spielende", () => {
    let r = start(2, { mode: "table", target: 50 });
    expect(() => game(r, { type: "finishRound" })).toThrow(/fehlen/);
    r = game(game(r, { type: "enter", player: "p1", points: 20 }), { type: "enter", player: "p2", points: 15 });
    r = game(r, { type: "setEnder", player: "p1" });
    r = game(r, { type: "finishRound" });
    expect(g(r).scores).toEqual({ p1: 40, p2: 15 });
    r = game(r, { type: "undoRound" });
    expect(g(r).scores).toEqual({ p1: 0, p2: 0 });
    r = game(game(r, { type: "enter", player: "p1", points: 60 }), { type: "enter", player: "p2", points: 5 });
    r = game(r, { type: "finishRound" });
    expect(g(r).phase).toBe("over");
    expect(() => game(r, { type: "draw", from: "deck" })).toThrow();
  });

  it("Echte Karten online: jeder trägt nur sich selbst ein", () => {
    let r = act(roomWith(["A", "B"]), { type: "selectGame", gameId: "skyjo" });
    r = act(r, { type: "setOption", key: "mode", value: "table" });
    r = act(r, { type: "start" }, "p1");
    expect(() => game(r, { type: "enter", player: "p1", points: 3 }, "p2")).toThrow(/eigenen/);
    r = game(r, { type: "enter", points: 3 }, "p2");
    expect(g(r).entries.p2).toBe(3);
  });
});
