import { describe, expect, it } from "vitest";
import { buildDeck, extend, findPhase, makeGroup, type P10Card, type P10State } from "@shared/games/phase10/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as P10State;
function start(n = 3, options: Record<string, string> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "phase10" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Hand von p1 festlegen, p1 am Zug nach dem Ziehen */
function fix(r: RoomState, hand: P10Card[], extra: Partial<P10State> = {}): RoomState {
  const s = g(r);
  return { ...r, game: { ...s, hands: { ...s.hands, p1: hand }, curId: "p1", step: "play", ...extra } };
}

describe("Phase 10", () => {
  it("108 Karten", () => {
    const d = buildDeck();
    expect(d).toHaveLength(108);
    expect(d.filter((c) => c === "W")).toHaveLength(8);
    expect(d.filter((c) => c === "S")).toHaveLength(4);
  });

  it("Gruppen prüfen: Gleiche, Folge mit Joker, Farbe", () => {
    expect(makeGroup(["r-7", "b-7", "W"], { kind: "set", n: 3 })?.value).toBe(7);
    expect(makeGroup(["r-7", "b-8", "W"], { kind: "set", n: 3 })).toBeNull();
    expect(makeGroup(["W", "W", "W"], { kind: "set", n: 3 })).toBeNull();
    const run = makeGroup(["r-3", "b-4", "W", "g-6"], { kind: "run", n: 4 });
    expect(run).toMatchObject({ lo: 3, hi: 6 });
    expect(makeGroup(["r-11", "b-12", "W", "W"], { kind: "run", n: 4 })).toMatchObject({ lo: 9, hi: 12 });
    expect(makeGroup(["r-3", "b-3", "g-4", "g-5"], { kind: "run", n: 4 })).toBeNull();
    expect(makeGroup(["g-1", "g-5", "g-9", "W", "g-2", "g-3", "g-12"], { kind: "color", n: 7 })?.color).toBe("g");
    expect(extend(run!, "y-7")).toMatchObject({ hi: 7 });
    expect(extend(run!, "y-2")).toMatchObject({ lo: 2 });
    expect(extend(run!, "y-9")).toBeNull();
  });

  it("Phase finden", () => {
    expect(findPhase(["r-2", "b-2", "g-2", "r-9", "W", "y-9", "b-11"], 1)).toHaveLength(2);
    expect(findPhase(["r-2", "b-3", "g-4", "r-9", "y-9", "b-11"], 1)).toBeNull();
    expect(findPhase(["r-1", "b-2", "g-3", "W", "y-5", "b-6", "r-7", "S"], 4)?.[0]).toHaveLength(7);
  });

  it("Austeilen: 10 Karten, erst ziehen, dann auslegen und ablegen", () => {
    let r = start(3);
    expect(g(r).hands.p1).toHaveLength(10);
    expect(g(r).step).toBe("draw");
    const first = g(r).curId!;
    expect(() => game(r, { type: "discard", card: g(r).hands[first][0] })).toThrow(/ziehen/);
    r = game(r, { type: "draw", from: "pile" });
    expect(g(r).hands[first]).toHaveLength(11);
    r = game(r, { type: "discard", card: g(r).hands[first][0] });
    expect(g(r).curId).not.toBe(first);
  });

  it("Auslegen, anlegen, raus – Phase steigt, Strafpunkte zählen", () => {
    let r = fix(start(2), ["r-2", "b-2", "g-2", "r-9", "W", "y-9", "b-10"]);
    r = { ...r, game: { ...g(r), hands: { ...g(r).hands, p2: ["W", "S", "r-1"] } } };
    expect(() => game(r, { type: "hit", card: "b-10", owner: "p1", g: 0 })).toThrow(/erst/);
    expect(() => game(r, { type: "lay", groups: [["r-2", "b-2", "g-2"], ["r-9", "y-9", "b-10"]] })).toThrow(/Gruppe 2/);
    r = game(r, { type: "lay", groups: [["r-2", "b-2", "g-2"], ["r-9", "y-9", "W"]] });
    expect(g(r).laid.p1).toHaveLength(2);
    expect(() => game(r, { type: "hit", card: "b-10", owner: "p1", g: 0 })).toThrow(/passt/);
    r = game(r, { type: "discard", card: "b-10" });
    expect(g(r).step).toBe("roundEnd");
    expect(g(r).phase.p1).toBe(2);
    expect(g(r).phase.p2).toBe(1);
    expect(g(r).scores.p2).toBe(25 + 15 + 5);
    r = game(r, { type: "nextRound" });
    expect(g(r).hands.p1).toHaveLength(10);
    expect(g(r).laid).toEqual({});
  });

  it("Aussetzen: gewählter Spieler wird übersprungen, Ablage nicht aufnehmbar", () => {
    let r = fix(start(3), ["S", "r-1", "r-2"]);
    r = game(r, { type: "discard", card: "S", skip: "p2" });
    expect(g(r).curId).toBe("p3");
    expect(() => game(r, { type: "draw", from: "discard" })).toThrow(/Aussetzen/);
    r = game(r, { type: "draw", from: "pile" });
    r = game(r, { type: "discard", card: g(r).hands.p3[0] });
    expect(g(r).curId).toBe("p1");
    expect(g(r).skips.p2).toBe(0);
  });

  it("Phase 10 geschafft: Spiel vorbei", () => {
    let r = fix(start(2), ["r-5", "b-5", "g-5", "y-5", "W", "r-8", "b-8", "W"], { phase: { p1: 10, p2: 3 } });
    r = game(r, { type: "lay", groups: [["r-5", "b-5", "g-5", "y-5", "W"], ["r-8", "b-8", "W"]] });
    expect(g(r).step).toBe("over");
  });

  it("Kurze Partie endet nach Phase 5", () => {
    let r = fix(start(2, { goal: "5" }), ["r-1", "b-2", "g-3", "W", "y-5", "b-6", "r-7", "r-8", "S"], { phase: { p1: 5, p2: 1 } });
    r = game(r, { type: "lay", groups: [["r-1", "b-2", "g-3", "W", "y-5", "b-6", "r-7", "r-8"]] });
    r = game(r, { type: "discard", card: "S" });
    expect(g(r).step).toBe("over");
  });

  it("Fremde Hände bleiben geheim", () => {
    const v = viewRoom(start(3), "p2").game as P10State;
    expect(Object.keys(v.hands)).toEqual(["p2"]);
    expect(v.pile).toHaveLength(0);
  });

  it("Echte Karten: Phasen und Punkte", () => {
    let r = start(2, { mode: "table" });
    r = game(r, { type: "enter", player: "p1", points: 0 });
    r = game(r, { type: "setDone", player: "p1", done: true });
    expect(() => game(r, { type: "enter", player: "p2", points: 7 })).toThrow(/Fünfer/);
    expect(() => game(r, { type: "finishRound" })).toThrow(/Ben/);
    r = game(r, { type: "enter", points: 45 }, "p2");
    r = game(r, { type: "finishRound" });
    expect(g(r).phase).toEqual({ p1: 2, p2: 1 });
    expect(g(r).scores.p2).toBe(45);
    expect(g(r).step).toBe("enter");
  });
});
