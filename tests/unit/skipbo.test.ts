import { describe, expect, it } from "vitest";
import { buildDeck, JOKER, type SbCard, type SbState } from "@shared/games/skipbo/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as SbState;
function start(n = 2, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Eva"].slice(0, n)), { type: "selectGame", gameId: "skipbo" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Hand und Vorrat von p1 festlegen */
function fix(r: RoomState, hand: SbCard[], stock: SbCard[], pile: SbCard[] = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]): RoomState {
  const s = g(r);
  return { ...r, game: { ...s, hands: { ...s.hands, p1: hand }, stocks: { ...s.stocks, p1: stock }, pile, curId: "p1" } };
}

describe("Skip-Bo", () => {
  it("162 Karten mit 18 Jokern", () => {
    const d = buildDeck();
    expect(d).toHaveLength(162);
    expect(d.filter((c) => c === JOKER)).toHaveLength(18);
    expect(d.filter((c) => c === 12)).toHaveLength(12);
  });

  it("Austeilen: Vorrat 30 (ab 5 Spielern 20), Startspieler hat 5 Karten", () => {
    let r = start(2);
    expect(g(r).stocks.p1).toHaveLength(30);
    expect(g(r).hands.p1).toHaveLength(5);
    expect(g(r).hands.p2).toHaveLength(0);
    r = start(5);
    expect(g(r).stocks.p1).toHaveLength(20);
    r = start(2, { stock: "10" });
    expect(g(r).stocks.p2).toHaveLength(10);
  });

  it("Aufbau nur der Reihe nach, Joker passt überall", () => {
    let r = fix(start(), [1, 3, JOKER, 7, 9], [5, 2]);
    expect(() => game(r, { type: "play", from: "hand", card: 3, to: 0 })).toThrow(/1/);
    r = game(r, { type: "play", from: "hand", card: 1, to: 0 });
    r = game(r, { type: "play", from: "stock", to: 0 });
    r = game(r, { type: "play", from: "hand", card: 3, to: 0 });
    r = game(r, { type: "play", from: "hand", card: JOKER, to: 0 });
    expect(g(r).builds[0]).toEqual([1, 2, 3, JOKER]);
    expect(() => game(r, { type: "play", from: "hand", card: 7, to: 0 })).toThrow(/5/);
    r = game(r, { type: "play", from: "stock", to: 0 });
    expect(g(r).builds[0]).toHaveLength(5);
  });

  it("Hand leer gespielt: fünf neue Karten", () => {
    let r = fix(start(), [1], [9, 9]);
    r = game(r, { type: "play", from: "hand", card: 1, to: 2 });
    expect(g(r).hands.p1).toHaveLength(5);
  });

  it("Ablegen beendet den Zug, der Nächste füllt auf", () => {
    let r = fix(start(), [4, 6, 8, 10, 12], [9]);
    r = game(r, { type: "discard", card: 8, to: 1 });
    expect(g(r).discards.p1[1]).toEqual([8]);
    expect(g(r).curId).toBe("p2");
    expect(g(r).hands.p2).toHaveLength(5);
    expect(() => game(r, { type: "discard", card: 4, to: 0 }, "p1")).toThrow();
  });

  it("Von der Ablage spielen, voller Stapel wird weggelegt", () => {
    let r = fix(start(), [12, 5, 5, 5, 5], [9]);
    const s = g(r);
    r = { ...r, game: { ...s, builds: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [], [], []], discards: { ...s.discards, p1: [[11], [], [], []] } } };
    r = game(r, { type: "play", from: "discard", i: 0, to: 0 });
    r = game(r, { type: "play", from: "hand", card: 12, to: 0 });
    expect(g(r).builds[0]).toEqual([]);
    expect(g(r).done).toHaveLength(12);
  });

  it("Vorrat leer: Runde gewonnen", () => {
    let r = fix(start(2, { target: "500" }), [5, 5, 5, 5, 5], [1]);
    r = game(r, { type: "play", from: "stock", to: 0 });
    expect(g(r).roundWinner).toBe("p1");
    expect(g(r).scores.p1).toBe(25 + 5 * 30);
    expect(g(r).phase).toBe("roundEnd");
  });

  it("Fremde Hände und Vorrat darunter bleiben geheim", () => {
    const r = start(3);
    const v = viewRoom(r, "p2").game as SbState;
    expect(Object.keys(v.hands)).toEqual(["p2"]);
    expect(v.stocks.p1).toHaveLength(1);
    expect(v.stockCounts.p1).toBe(30);
    expect(v.pile).toHaveLength(0);
  });

  it("Echte Karten: Punkteblock 25 + 5 je Restkarte", () => {
    let r = start(3, { mode: "table", target: "500" });
    r = game(r, { type: "setWinner", player: "p3" });
    r = game(r, { type: "enter", player: "p1", points: 4 });
    expect(() => game(r, { type: "finishRound" })).toThrow(/Ben/);
    r = game(r, { type: "enter", points: 6 }, "p2");
    r = game(r, { type: "finishRound" });
    expect(g(r).scores.p3).toBe(75);
    expect(g(r).phase).toBe("enter");
  });
});
