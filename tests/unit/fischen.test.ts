import { describe, expect, it } from "vitest";
import type { Card } from "@shared/cards/german";
import { askableRanks, handSize, leaders, type FischenState } from "@shared/games/fischen/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as FischenState;
function start(n = 3) {
  const r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"].slice(0, n)), { type: "selectGame", gameId: "fischen" });
  return act(r, { type: "start" });
}
function deal(r: RoomState, hands: Record<string, Card[]>, pile: Card[]): RoomState {
  const s: FischenState = { ...g(r), hands, pile, curId: "p1", quartets: Object.fromEntries(Object.keys(hands).map((id) => [id, []])), events: [], fished: null, finished: false };
  return { ...r, game: s };
}
const ask = (r: RoomState, target: string, rank: string, actor: string | null = null) => game(r, { type: "ask", target, rank }, actor);

describe("Fischen", () => {
  it("Kartenzahl nach Spielerzahl", () => {
    expect(handSize(2)).toBe(7);
    expect(handSize(4)).toBe(5);
    const s = g(start(4));
    expect(Object.values(s.hands).map((h) => h.length + (s.quartets[Object.keys(s.hands)[0]]?.length ?? 0) * 0)).toHaveLength(4);
    expect(() => act(act(roomWith(["A"]), { type: "selectGame", gameId: "fischen" }), { type: "start" })).toThrow(/mindestens 2/);
  });

  it("nur nach eigenen Werten fragen", () => {
    const r = deal(start(), { p1: ["rot-K", "gruen-7"], p2: ["eichel-K", "rot-A"], p3: ["schellen-9"] }, ["rot-8"]);
    expect(askableRanks(g(r).hands.p1)).toEqual(["7", "K"]);
    expect(() => ask(r, "p2", "A")).toThrow(/selbst hast/);
    expect(() => ask(r, "p1", "K")).toThrow(/Mitspieler/);
  });

  it("Treffer: alle Karten des Werts wandern, und man fragt weiter", () => {
    let r = deal(start(), { p1: ["rot-K", "gruen-7"], p2: ["eichel-K", "gruen-K", "rot-A"], p3: ["schellen-9"] }, ["rot-8"]);
    r = ask(r, "p2", "K");
    expect(g(r).hands.p1.filter((c) => c.endsWith("-K"))).toHaveLength(3);
    expect(g(r).hands.p2).toEqual(["rot-A"]);
    expect(g(r).curId).toBe("p1");
    expect(g(r).events.at(-1)).toMatchObject({ got: 2, rank: "K" });
  });

  it("Niete: Geh fischen – der Nächste ist dran", () => {
    let r = deal(start(), { p1: ["rot-K", "gruen-7"], p2: ["rot-A"], p3: ["schellen-9"] }, ["rot-8"]);
    r = ask(r, "p2", "K");
    expect(g(r).hands.p1).toContain("rot-8");
    expect(g(r).fished).toBe("rot-8");
    expect(g(r).curId).toBe("p2");
    expect(g(viewRoom(r, "p3")).fished).toBeNull();
  });

  it("Glück beim Fischen: nochmal dran", () => {
    let r = deal(start(), { p1: ["rot-K", "gruen-7"], p2: ["rot-A"], p3: ["schellen-9"] }, ["eichel-K"]);
    r = ask(r, "p2", "K");
    expect(g(r).events.at(-1)!.lucky).toBe(true);
    expect(g(r).curId).toBe("p1");
  });

  it("Quartett wird abgelegt, Ende wenn alle 8 liegen", () => {
    let r = deal(start(2), { p1: ["rot-K", "gruen-K", "eichel-K", "rot-7"], p2: ["schellen-K", "gruen-7"] }, []);
    r = { ...r, game: { ...g(r), quartets: { p1: ["7", "8", "9", "10", "U", "O"], p2: [] } } };
    r = ask(r, "p2", "K");
    expect(g(r).quartets.p1).toContain("K");
    expect(g(r).events.at(-1)!.quartet).toBe("K");
    expect(g(r).finished).toBe(false);
    // Achtes Quartett: Schluss
    r = { ...r, game: { ...g(r), hands: { p1: ["rot-A", "gruen-A", "eichel-A"], p2: ["schellen-A"] }, curId: "p1" } };
    r = ask(r, "p2", "A");
    expect(g(r).finished).toBe(true);
    expect(() => ask(r, "p2", "A")).toThrow(/entschieden/);
  });

  it("kann niemand mehr fragen, endet das Spiel", () => {
    let r = deal(start(2), { p1: ["rot-7"], p2: ["gruen-7"] }, []);
    r = ask(r, "p2", "7");
    expect(g(r).finished).toBe(true);
  });

  it("Rangliste nach Quartetten", () => {
    const s = { ...g(start(2)), quartets: { p1: ["K", "A"], p2: ["7"] } } as FischenState;
    expect(leaders(s, [{ id: "p1", name: "A" }, { id: "p2", name: "B" }])).toEqual(["p1"]);
  });

  it("fremde Hände sind geheim, nur man selbst darf fragen", () => {
    const r = start(3);
    expect(Object.keys(g(viewRoom(r, "p2")).hands)).toEqual(["p2"]);
    const cur = g(r).curId!;
    const other = ["p1", "p2", "p3"].find((x) => x !== cur && x !== "p1")!;
    expect(() => ask(r, cur, "K", other)).toThrow(/ist am Zug/);
  });
});
