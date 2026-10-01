import { describe, expect, it } from "vitest";
import { buildDeck, canPlay, cardPoints, type UnoCard, type UnoState } from "@shared/games/uno/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as UnoState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "uno" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Hände und Ablage fest vorgeben */
function fix(r: RoomState, hands: Record<string, UnoCard[]>, topCard: UnoCard, pile: UnoCard[] = ["r-1", "r-2", "r-3", "r-4", "r-5", "r-6", "r-7", "r-8"]): RoomState {
  const s = g(r);
  const counts = Object.fromEntries(Object.entries(hands).map(([k, v]) => [k, v.length]));
  return { ...r, game: { ...s, hands, counts, discard: [topCard], color: topCard[0] as UnoState["color"], pile, pileCount: pile.length, curId: "p1" } };
}

describe("Uno", () => {
  it("108 Karten mit richtiger Verteilung und Punkten", () => {
    const d = buildDeck();
    expect(d).toHaveLength(108);
    expect(d.filter((c) => c === "w-plus4")).toHaveLength(4);
    expect(d.filter((c) => c === "r-0")).toHaveLength(1);
    expect(d.filter((c) => c === "g-7")).toHaveLength(2);
    expect(cardPoints("b-7")).toBe(7);
    expect(cardPoints("y-skip")).toBe(20);
    expect(cardPoints("w-wild")).toBe(50);
  });

  it("Austeilen: 7 Karten, Startkarte ist eine Zahl", () => {
    const r = start(3);
    expect(g(r).hands.p1).toHaveLength(7);
    expect(g(r).discard[0]).toMatch(/^[rgby]-\d$/);
    expect(g(r).curId).toBe("p1");
  });

  it("Farbe oder Wert bedienen, sonst Fehler", () => {
    let r = fix(start(3), { p1: ["r-3", "b-5", "g-9"], p2: ["y-1", "y-2"], p3: ["y-3", "y-4"] }, "b-9");
    expect(() => game(r, { type: "play", card: "r-3" })).toThrow(/passt nicht/);
    r = game(r, { type: "play", card: "g-9" });
    expect(g(r).color).toBe("g");
    expect(g(r).curId).toBe("p2");
  });

  it("+4 nur ohne passende Farbe (außer Hausregel)", () => {
    const r = fix(start(2), { p1: ["w-plus4", "r-3", "b-1"], p2: ["y-1", "y-2"] }, "r-9");
    expect(() => game(r, { type: "play", card: "w-plus4", color: "b", uno: true })).toThrow(/keine Karte in der Farbe/);
    const s = g(r);
    expect(canPlay(s, "w-plus4", { plus4Any: true }, s.hands.p1)).toBe(true);
  });

  it("+2 lässt den Nächsten ziehen und aussetzen", () => {
    let r = fix(start(3), { p1: ["r-plus2", "b-1", "b-2"], p2: ["y-1"], p3: ["y-3", "y-4"] }, "r-9");
    r = game(r, { type: "play", card: "r-plus2" });
    expect(g(r).hands.p2).toHaveLength(3);
    expect(g(r).curId).toBe("p3");
  });

  it("Stapeln: +2 auf +2, der Letzte zieht alles", () => {
    let r = fix(start(3, { stack: true }), { p1: ["r-plus2", "b-1", "b-2"], p2: ["g-plus2", "g-3"], p3: ["y-3", "y-4"] }, "r-9");
    r = game(r, { type: "play", card: "r-plus2" });
    r = game(r, { type: "play", card: "g-plus2" });
    expect(g(r).pendingDraw).toBe(4);
    expect(() => game(r, { type: "play", card: "y-3" })).toThrow(/4 Karten/);
    r = game(r, { type: "draw" });
    expect(g(r).hands.p3).toHaveLength(6);
    expect(g(r).curId).toBe("p1");
  });

  it("Richtungswechsel zu zweit wirkt wie Aussetzen", () => {
    let r = fix(start(2), { p1: ["r-rev", "b-1", "b-2"], p2: ["y-1", "y-2"] }, "r-9");
    r = game(r, { type: "play", card: "r-rev" });
    expect(g(r).curId).toBe("p1");
  });

  it("„Uno“ vergessen kostet zwei Karten", () => {
    let r = fix(start(2), { p1: ["r-1", "r-2"], p2: ["y-1", "y-2"] }, "r-9");
    r = game(r, { type: "play", card: "r-1" });
    expect(g(r).hands.p1).toHaveLength(3);
    r = fix(start(2), { p1: ["r-1", "r-2"], p2: ["y-1", "y-2"] }, "r-9");
    r = game(r, { type: "play", card: "r-1", uno: true });
    expect(g(r).hands.p1).toHaveLength(1);
  });

  it("Gezogene Karte: nur sie darf gelegt werden, sonst passen", () => {
    let r = fix(start(2), { p1: ["b-1", "b-2"], p2: ["y-1", "y-2"] }, "r-9", ["g-4", "r-5"]);
    r = game(r, { type: "draw" });
    expect(g(r).drawn).toBe("r-5");
    expect(() => game(r, { type: "play", card: "b-1" })).toThrow(/gezogene/);
    r = game(r, { type: "pass" });
    expect(g(r).curId).toBe("p2");
  });

  it("Rundensieger bekommt die Kartenpunkte der anderen", () => {
    let r = fix(start(3), { p1: ["r-1"], p2: ["y-5", "w-wild"], p3: ["g-skip"] }, "r-9");
    r = game(r, { type: "play", card: "r-1" });
    expect(g(r).scores.p1).toBe(75);
    expect(g(r).phase).toBe("roundEnd");
    r = game(r, { type: "nextRound" });
    expect(g(r).round).toBe(2);
    expect(g(r).hands.p2).toHaveLength(7);
  });

  it("Eine Runde: Spiel endet mit dem ersten Leeren", () => {
    let r = fix(start(2, { target: "round" }), { p1: ["r-1"], p2: ["y-5"] }, "r-9");
    r = game(r, { type: "play", card: "r-1" });
    expect(g(r).phase).toBe("over");
  });

  it("Fremde Hände und der Stapel bleiben geheim", () => {
    const r = start(3);
    const v = viewRoom(r, "p2").game as UnoState;
    expect(Object.keys(v.hands)).toEqual(["p2"]);
    expect(v.pile).toHaveLength(0);
    expect(v.pileCount).toBe(g(r).pile.length);
  });

  it("Echte Karten: Punkteblock", () => {
    let r = start(3, { mode: "table" });
    expect(() => game(r, { type: "finishRound" })).toThrow(/gewonnen/);
    r = game(r, { type: "setWinner", player: "p2" });
    r = game(r, { type: "enter", player: "p1", points: 30 });
    expect(() => game(r, { type: "finishRound" })).toThrow(/Cem/);
    expect(() => game(r, { type: "enter", player: "p3", points: 5 }, "p2")).toThrow(/eigenen/);
    r = game(r, { type: "enter", points: 12 }, "p3");
    r = game(r, { type: "finishRound" });
    expect(g(r).scores.p2).toBe(42);
    expect(g(r).round).toBe(2);
    expect(g(r).phase).toBe("enter");
  });
});

describe("Uno – nächste Runde", () => {
  it("darf jeder starten, nicht nur der Host", () => {
    let r = fix(start(3), { p1: ["r-1"], p2: ["y-5"], p3: ["g-skip"] }, "r-9");
    r = game(r, { type: "play", card: "r-1" });
    r = game(r, { type: "nextRound" }, "p3");
    expect(g(r).round).toBe(2);
  });
});
