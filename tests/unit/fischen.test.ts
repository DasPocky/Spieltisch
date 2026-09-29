import { describe, expect, it } from "vitest";
import type { Card } from "@shared/cards/deck";
import { askableRanks, handSize, leaders, type FischenState } from "@shared/games/fischen/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as FischenState;
/** Die Regeltests nutzen das deutsche Blatt (32 Karten, 8 Quartette) */
function start(n = 3) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"].slice(0, n)), { type: "selectGame", gameId: "fischen" });
  r = act(r, { type: "setOption", key: "deck", value: "de32" });
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
    expect(askableRanks(g(r), g(r).hands.p1)).toEqual(["7", "K"]);
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

  it("Standard: französisch mit 52 Karten und 13 Quartetten, bis 8 Spieler", () => {
    const r = act(act(roomWith(["A", "B", "C", "D", "E", "F", "G", "H"]), { type: "selectGame", gameId: "fischen" }), { type: "start" });
    const s = g(r);
    expect(s.deck).toBe("fr52");
    expect(s.pile.length + Object.values(s.hands).flat().length + Object.values(s.quartets).flat().length * 4).toBe(52);
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

  it("Variante: nach „Geh fischen!“ ist der Gefragte dran", () => {
    let r = act(start(), { type: "setOption", key: "afterFish", value: "asked" });
    r = deal(r, { p1: ["rot-K", "gruen-7"], p2: ["eichel-A"], p3: ["schellen-9", "rot-9"] }, ["rot-8"]);
    r = ask(r, "p3", "K");
    expect(g(r).curId).toBe("p3");
  });
});

describe("Fischen mit echten Karten", () => {
  const table = (n = 3) => {
    let r = act(roomWith(["Anna", "Ben", "Cem"].slice(0, n)), { type: "selectGame", gameId: "fischen" });
    r = act(r, { type: "setOption", key: "deck", value: "de32" });
    r = act(r, { type: "setOption", key: "cards", value: "table" });
    return act(r, { type: "start" });
  };

  it("keine Karten in der App, Fragen am Tisch", () => {
    const r = table();
    expect(g(r).table).toBe(true);
    expect(g(r).hands).toEqual({});
    expect(() => ask(r, "p2", "K")).toThrow(/am Tisch/);
  });

  it("Quartette eintragen, zurücknehmen, Sieger", () => {
    let r = table();
    r = game(r, { type: "quartet", rank: "K", owner: "p2" });
    expect(() => game(r, { type: "quartet", rank: "K", owner: "p1" })).toThrow(/liegt schon/);
    r = game(r, { type: "undo" });
    expect(g(r).quartets.p2).toEqual([]);
    for (const rank of ["7", "8", "9", "10", "U", "O", "K"]) r = game(r, { type: "quartet", rank, owner: "p1" });
    expect(g(r).finished).toBe(false);
    r = game(r, { type: "quartet", rank: "A", owner: "p3" });
    expect(g(r).finished).toBe(true);
    expect(leaders(g(r), r.players)).toEqual(["p1"]);
  });

  it("Geh fischen gibt den Zug weiter – nur der Spieler am Zug tippt", () => {
    let r = table();
    expect(() => game(r, { type: "fish" }, "p2")).toThrow(/am Zug/);
    r = game(r, { type: "fish" }, "p1");
    expect(g(r).curId).toBe("p2");
    r = act(r, { type: "setOption", key: "afterFish", value: "asked" });
    r = game(r, { type: "fish", target: "p1" }, "p2");
    expect(g(r).curId).toBe("p1");
  });

  it("wer geht, gibt seine Quartette frei – die Partie kann trotzdem enden", () => {
    let r = table();
    r = game(r, { type: "quartet", rank: "K", owner: "p3" });
    r = act(r, { type: "removePlayer", id: "p3" });
    expect(g(r).finished).toBe(false);
    for (const rank of ["7", "8", "9", "10", "U", "O", "K", "A"]) r = game(r, { type: "quartet", rank, owner: "p1" });
    expect(g(r).finished).toBe(true);
  });
});
