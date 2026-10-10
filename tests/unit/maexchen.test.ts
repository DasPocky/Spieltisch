import { afterEach, describe, expect, it, vi } from "vitest";
import { chanceAtLeast, labelOf, ORDER, rankOf, valueOf, type MaexState } from "@shared/games/maexchen/logic";
import { getGame } from "@shared/games";
import { applyRoomAction, skipLabel, viewRoom, type RoomState } from "@shared/platform/room";
import { act, fixDice, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as MaexState;
function start(n = 3, options: Record<string, string | number | boolean> = {}, online = false) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "maexchen" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  if (online) r = act(r, { type: "setEntry", mode: "turn" });
  return act(r, { type: "start" }, online ? "p1" : null);
}
const roll = (r: RoomState, faces: [number, number], actor: string | null = null) => {
  const spy = fixDice(faces);
  try { return game(r, { type: "roll" }, actor); } finally { spy.mockRestore(); }
};
const say = (r: RoomState, value: number, actor: string | null = null) => game(r, { type: "announce", value }, actor);
const reveal = (r: RoomState, truth?: boolean, actor: string | null = null) => game(r, { type: "reveal", truth }, actor);

afterEach(() => vi.restoreAllMocks());

describe("Mäxchen – Werte", () => {
  it("Rangfolge: Mäxchen > Pasche > Zahlen, höhere Ziffer vorn", () => {
    expect(valueOf([1, 2])).toBe(21);
    expect(valueOf([3, 6])).toBe(63);
    expect(valueOf([4, 4])).toBe(44);
    expect(rankOf(21)).toBeGreaterThan(rankOf(66));
    expect(rankOf(11)).toBeGreaterThan(rankOf(65));
    expect(rankOf(65)).toBeGreaterThan(rankOf(31));
    expect(ORDER).toHaveLength(21);
    expect(labelOf(21)).toBe("Mäxchen");
    expect(labelOf(66)).toBe("Sechserpasch");
    expect(chanceAtLeast(31)).toBe(1);
    expect(chanceAtLeast(21)).toBeCloseTo(2 / 36);
    expect(chanceAtLeast(11)).toBeCloseTo(8 / 36);
  });
});

describe("Mäxchen – Ablauf", () => {
  it("würfeln, höher ansagen, glauben, aufdecken: Lüge kostet den Ansager", () => {
    let r = start();
    expect(() => say(r, 31)).toThrow(/Erst würfeln/);
    r = roll(r, [3, 1]);
    r = say(r, 54); // gelogen
    expect(g(r).curId).toBe("p2");
    expect(() => say(r, 53)).toThrow(/Erst würfeln|mehr als/);
    r = reveal(r);
    expect(g(r).reveal).toMatchObject({ truth: false, loser: "p1", cost: 1, dice: [3, 1] });
    expect(g(r).lives).toEqual({ p1: 2, p2: 3, p3: 3 });
    // Verlierer beginnt die neue Runde
    expect(g(r).curId).toBe("p1");
    expect(g(r).round).toEqual([]);
  });

  it("Ansage stimmt (Wurf höher als angesagt): der Aufdeckende verliert", () => {
    let r = start();
    r = roll(r, [6, 6]);
    r = say(r, 63);
    r = reveal(r);
    expect(g(r).reveal).toMatchObject({ truth: true, loser: "p2" });
    expect(g(r).curId).toBe("p2");
  });

  it("muss höher ansagen, gleich reicht nicht", () => {
    let r = start();
    r = roll(r, [4, 2]);
    r = say(r, 42);
    r = roll(r, [5, 1]);
    expect(() => say(r, 42)).toThrow(/mehr als 42/);
    expect(() => say(r, 41)).toThrow(/mehr als 42/);
    expect(() => say(r, 99)).toThrow(/gibt es nicht/);
    expect(() => reveal(r)).toThrow(/schon gewürfelt/);
    r = say(r, 51);
    expect(g(r).round.map((a) => a.value)).toEqual([42, 51]);
  });

  it("Mäxchen kostet doppelt, nach Mäxchen nur noch aufdecken", () => {
    let r = start();
    r = roll(r, [2, 1]);
    r = say(r, 21);
    expect(() => roll(r, [3, 3])).toThrow(/nicht zu überbieten/);
    expect(() => say(r, 66)).toThrow();
    r = reveal(r);
    expect(g(r).reveal).toMatchObject({ truth: true, loser: "p2", cost: 2 });
    expect(g(r).lives.p2).toBe(1);
  });

  it("Hausregel: Mäxchen kostet nur einfach", () => {
    let r = start(2, { maexDouble: false });
    r = roll(r, [1, 2]);
    r = reveal(say(r, 21));
    expect(g(r).lives.p2).toBe(2);
  });

  it("blind weitergeben: der alte Wurf bleibt unter dem Becher", () => {
    let r = start();
    r = roll(r, [5, 5]);
    r = say(r, 44);
    r = say(r, 55); // Ben gibt blind weiter
    expect(g(r).round.at(-1)).toMatchObject({ by: "p2", blind: true });
    r = reveal(r); // Cem deckt auf – 55 liegt wirklich
    expect(g(r).reveal).toMatchObject({ truth: true, loser: "p3", target: "p2" });
  });

  it("blind weitergeben lässt sich ausschalten", () => {
    let r = start(3, { blind: false });
    r = roll(r, [5, 5]);
    r = say(r, 44);
    expect(() => say(r, 55)).toThrow(/ausgeschaltet/);
  });

  it("ausscheiden und gewinnen, Ergebnis für die Statistik", () => {
    let r = start(2, { lives: 1 });
    r = roll(r, [3, 1]);
    r = reveal(say(r, 65));
    expect(g(r).over).toBe(true);
    expect(g(r).winnerId).toBe("p2");
    expect(() => roll(r, [1, 1])).toThrow(/entschieden/);
    const res = resultsOf(r);
    expect(res).toEqual([{ id: "p1", won: false, score: 0 }, { id: "p2", won: true, score: 1 }]);
  });

  it("Ausgeschiedene werden übersprungen; ist der Verlierer raus, beginnt sein Nachbar", () => {
    let r = start(3, { lives: 1 });
    r = roll(r, [3, 1]);
    r = reveal(say(r, 65)); // Anna raus
    expect(g(r).out).toEqual(["p1"]);
    expect(g(r).curId).toBe("p2");
    r = roll(r, [4, 1]);
    r = say(r, 41);
    expect(g(r).curId).toBe("p3");
    r = roll(r, [4, 2]);
    r = say(r, 42);
    expect(g(r).curId).toBe("p2"); // Anna wird übersprungen
  });
});

function resultsOf(r: RoomState) {
  return getGame("maexchen").results!(r.game, { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
}

describe("Mäxchen – geheim und online", () => {
  it("den Wurf sieht nur, wer gewürfelt hat", () => {
    let r = start(3, {}, true);
    r = roll(r, [6, 4], "p1");
    expect(g(viewRoom(r, "p1")).dice).toEqual([6, 4]);
    expect(g(viewRoom(r, "p2")).dice).toBeNull();
    expect(g(viewRoom(r, "p3")).dice).toBeNull();
    r = say(r, 64, "p1");
    // nach dem Weitergeben sieht ihn niemand mehr – auch Ben nicht, der ja nur die Ansage kennt
    expect(g(viewRoom(r, "p2")).dice).toBeNull();
    expect(g(viewRoom(r, "p1")).dice).toBeNull();
    // Ansage sehen alle
    expect(g(viewRoom(r, "p3")).round.at(-1)?.value).toBe(64);
    // nach dem Aufdecken ist der Wurf öffentlich
    r = reveal(r, undefined, "p2");
    expect(g(viewRoom(r, "p3")).reveal?.dice).toEqual([6, 4]);
  });

  it("nur der Spieler am Zug – auch der Host nicht für andere", () => {
    let r = start(3, {}, true);
    expect(() => roll(r, [1, 1], "p2")).toThrow();
    r = roll(r, [1, 1], "p1");
    r = say(r, 11, "p1");
    expect(() => reveal(r, undefined, "p1")).toThrow();
    expect(() => reveal(r, undefined, "p3")).toThrow();
  });

  it("überspringen startet eine neue Runde beim Nächsten", () => {
    let r = start(3);
    r = roll(r, [5, 2]);
    r = say(r, 52);
    expect(skipLabel(r)).toMatch(/Ben überspringen/);
    r = applyRoomAction(r, { type: "skip" }, null);
    expect(g(r).curId).toBe("p3");
    expect(g(r).round).toEqual([]);
    expect(g(r).lives).toEqual({ p1: 3, p2: 3, p3: 3 });
  });

  it("Spieler geht: Runde beginnt neu, bei einem Übrigen ist Schluss", () => {
    let r = start(3);
    r = roll(r, [5, 2]);
    r = say(r, 52);
    r = act(r, { type: "removePlayer", id: "p1" });
    expect(g(r).round).toEqual([]);
    expect(g(r).curId).toBe("p2");
    r = act(r, { type: "removePlayer", id: "p2" });
    expect(g(r).over).toBe(true);
    expect(g(r).winnerId).toBe("p3");
  });
});

describe("Mäxchen – echte Würfel", () => {
  it("App führt nur Ansagen und Leben", () => {
    let r = start(2, { mode: "table" });
    expect(() => roll(r, [1, 1])).toThrow(/echten Würfeln/);
    r = say(r, 43);
    r = say(r, 55); // Ben glaubt und sagt höher an
    expect(() => reveal(r)).toThrow(/Stimmte/);
    r = reveal(r, false);
    expect(g(r).reveal).toMatchObject({ truth: false, loser: "p2", dice: null });
    expect(g(r).lives).toEqual({ p1: 3, p2: 2 });
    expect(g(r).curId).toBe("p2");
    r = say(r, 21);
    expect(() => say(r, 66)).toThrow(/nicht zu überbieten/);
    r = reveal(r, true);
    expect(g(r).lives.p1).toBe(1);
  });
});
