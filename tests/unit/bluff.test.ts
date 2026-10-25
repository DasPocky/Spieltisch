import { describe, expect, it } from "vitest";
import { atLeast, bidChance, bluff, isHigher, minCount, suggest, totalDice, type BluffState } from "@shared/games/bluff/logic";
import { applyRoomAction, roomGame, skipLabel, viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { act, game, roomWith } from "./helpers";
import { narration } from "../../src/games/bluff/narration";
import { bluffTable } from "../../src/games/bluff/table";

const g = (r: RoomState) => r.game as BluffState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil"].slice(0, n)), { type: "selectGame", gameId: "bluff" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Feste Becher setzen (in Spielerreihenfolge) */
function cups(r: RoomState, ...dice: number[][]): RoomState {
  const s = structuredClone(g(r));
  r.players.forEach((p, i) => { if (dice[i]) { s.cups[p.id] = dice[i]; s.count[p.id] = dice[i].length; } });
  return { ...r, game: s };
}
const cur = (r: RoomState) => g(r).curId;
const name = (r: RoomState) => (id: string | null) => r.players.find((p) => p.id === id)?.name ?? "?";

describe("Bluff: Ansagen", () => {
  it("Erhöhen: mehr Würfel oder gleich viele mit höherer Augenzahl", () => {
    expect(isHigher({ count: 3, face: 4 }, { count: 3, face: 5 }, false)).toBe(true);
    expect(isHigher({ count: 3, face: 4 }, { count: 4, face: 2 }, false)).toBe(true);
    expect(isHigher({ count: 3, face: 4 }, { count: 3, face: 4 }, false)).toBe(false);
    expect(isHigher({ count: 3, face: 4 }, { count: 3, face: 3 }, false)).toBe(false);
    expect(isHigher({ count: 3, face: 6 }, { count: 3, face: 1 }, false)).toBe(false);
  });
  it("Joker: auf Einsen die halbe Anzahl, zurück das Doppelte plus eins", () => {
    expect(isHigher({ count: 7, face: 5 }, { count: 4, face: 1 }, true)).toBe(true);
    expect(isHigher({ count: 7, face: 5 }, { count: 3, face: 1 }, true)).toBe(false);
    expect(isHigher({ count: 4, face: 1 }, { count: 9, face: 2 }, true)).toBe(true);
    expect(isHigher({ count: 4, face: 1 }, { count: 8, face: 6 }, true)).toBe(false);
    expect(isHigher({ count: 4, face: 1 }, { count: 5, face: 1 }, true)).toBe(true);
  });
  it("Reihum, jede Ansage höher; mit Einsen eröffnet niemand; nicht mehr als Würfel im Spiel", () => {
    let r = start(3);
    expect(cur(r)).toBe("p1");
    expect(() => game(r, { type: "bid", count: 2, face: 1 })).toThrow(/Einsen/);
    expect(() => game(r, { type: "doubt" })).toThrow(/keine Ansage/);
    expect(() => game(r, { type: "bid", count: 16, face: 3 })).toThrow(/nur 15/);
    r = game(r, { type: "bid", count: 3, face: 4 });
    expect(cur(r)).toBe("p2");
    expect(() => game(r, { type: "bid", count: 3, face: 3 })).toThrow(/mehr als 3 × Vieren/);
    expect(minCount(g(r), 1, r.options)).toBe(2);
    expect(minCount(g(r), 5, r.options)).toBe(3);
    expect(minCount(g(r), 3, r.options)).toBe(4);
    r = game(r, { type: "bid", count: 2, face: 1 });
    expect(cur(r)).toBe("p3");
    expect(minCount(g(r), 6, r.options)).toBe(5);
    // Ohne Joker darf man mit Einsen eröffnen
    expect(() => game(start(2, { jokers: false }), { type: "bid", count: 1, face: 1 })).not.toThrow();
  });
});

describe("Bluff: Auflösung", () => {
  it("Bluff! – Ansage stimmt nicht: der Ansager verliert einen Würfel und beginnt", () => {
    let r = cups(start(3), [5, 5, 2, 3, 4], [1, 6, 6, 2, 3], [2, 2, 3, 3, 4]);
    r = game(r, { type: "bid", count: 4, face: 5 }); // Fünfen: 2 + Joker 1 = 3
    r = game(r, { type: "doubt" });
    const rv = g(r).reveal!;
    expect(g(r).phase).toBe("reveal");
    expect(rv).toMatchObject({ kind: "bluff", by: "p2", actual: 3, holds: false, loser: "p1", out: false });
    expect(g(r).count.p1).toBe(4);
    expect(roomGame(r).currentPlayerId(r.game)).toBeNull();
    r = game(r, { type: "next" }, "p3");
    expect(g(r).phase).toBe("bid");
    expect(cur(r)).toBe("p1");
    expect(g(r).cups.p1).toHaveLength(4);
    expect(totalDice(g(r))).toBe(14);
  });
  it("Bluff! – Ansage stimmt: der Zweifler verliert; ohne Joker zählen Einsen nicht", () => {
    let r = cups(start(2), [3, 3, 1, 2, 5], [3, 6, 6, 2, 2]);
    r = game(r, { type: "bid", count: 4, face: 3 });
    r = game(r, { type: "doubt" });
    expect(g(r).reveal).toMatchObject({ actual: 4, holds: true, loser: "p2" });
    let o = cups(start(2, { jokers: false }), [3, 3, 1, 2, 5], [3, 6, 6, 2, 2]);
    o = game(o, { type: "bid", count: 4, face: 3 });
    o = game(o, { type: "doubt" });
    expect(g(o).reveal).toMatchObject({ actual: 3, holds: false, loser: "p1" });
  });
  it("Genau! – stimmt exakt: Würfel zurück (höchstens bis zur Startzahl); sonst verliert der Rufer", () => {
    let r = cups(start(3), [3, 3, 2, 2], [3, 6, 6, 2, 2], [4, 4, 4, 4, 4]);
    r = game(r, { type: "bid", count: 3, face: 3 });
    r = game(r, { type: "exact" });
    expect(g(r).reveal).toMatchObject({ kind: "exact", actual: 3, loser: null, gainer: null });
    expect(g(r).starter).toBe("p2");
    let x = cups(start(3), [3, 3, 2, 2, 2], [3, 6, 6, 2], [4, 4, 4, 4, 4]);
    x = game(x, { type: "bid", count: 3, face: 3 });
    x = game(x, { type: "exact" });
    expect(g(x).reveal?.gainer).toBe("p2");
    expect(g(x).count.p2).toBe(5);
    let y = cups(start(3), [3, 3, 2, 2, 2], [3, 6, 6, 2, 2], [4, 4, 4, 4, 3]);
    y = game(y, { type: "bid", count: 3, face: 3 });
    y = game(y, { type: "exact" });
    expect(g(y).reveal).toMatchObject({ actual: 4, loser: "p2" });
    expect(() => game(game(start(2, { exact: false }), { type: "bid", count: 1, face: 2 }), { type: "exact" })).toThrow(/ausgeschaltet/);
  });
  it("Ohne Würfel raus, der Nachbar beginnt; der Letzte gewinnt nach dem Aufdecken", () => {
    let r = cups(start(3, { startDice: 1 }), [2], [3], [4]);
    r = game(r, { type: "bid", count: 2, face: 6 });
    r = game(r, { type: "doubt" });
    expect(g(r).reveal).toMatchObject({ loser: "p1", out: true, final: false });
    expect(g(r).starter).toBe("p2");
    r = game(r, { type: "next" });
    expect(cur(r)).toBe("p2");
    r = cups(r, [], [5], [6]);
    r = game(r, { type: "bid", count: 1, face: 5 });
    r = game(r, { type: "doubt" });
    expect(g(r).reveal).toMatchObject({ loser: "p3", final: true });
    expect(roomGame(r).isOver(r.game)).toBe(false);
    r = game(r, { type: "next" });
    expect(roomGame(r).isOver(r.game)).toBe(true);
    expect(g(r).winnerId).toBe("p2");
    const res = bluff.results!(g(r), { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 });
    expect(res.filter((x) => x.won).map((x) => x.id)).toEqual(["p2"]);
  });
  it("Echte Würfel: der Rufer tippt ein, wie viele liegen", () => {
    let r = start(2, { mode: "table" });
    expect(g(r).cups.p1).toEqual([]);
    r = game(r, { type: "bid", count: 3, face: 4 });
    expect(() => game(r, { type: "doubt" })).toThrow(/Wie viele/);
    r = game(r, { type: "doubt", actual: 2 });
    expect(g(r).reveal).toMatchObject({ actual: 2, loser: "p1" });
  });
});

describe("Bluff: Geheimnisse, nichts hängt", () => {
  it("Jeder sieht nur seinen Becher, der Fernseher keinen – beim Aufdecken alle", () => {
    let r = cups(start(3), [5, 5, 2, 3, 4], [1, 6, 6, 2, 3], [2, 2, 3, 3, 4]);
    expect(Object.keys(g(viewRoom(r, "p2")).cups)).toEqual(["p2"]);
    expect(g(viewRoom(r, WATCH_ID)).cups).toEqual({});
    const tv = bluffTable(viewRoom(r, WATCH_ID))!;
    expect(tv.boards?.p1.cells.every((c) => c === "?")).toBe(true);
    r = game(r, { type: "bid", count: 2, face: 5 });
    r = game(r, { type: "doubt" });
    expect(g(viewRoom(r, WATCH_ID)).reveal?.cups.p1).toEqual([5, 5, 2, 3, 4]);
    expect(bluffTable(viewRoom(r, WATCH_ID))!.boards?.p1.cells).toHaveLength(5);
  });
  it("Überspringen: alle würfeln neu, der Nächste beginnt; Aussteiger mitten in der Runde", () => {
    let r = start(3);
    r = game(r, { type: "bid", count: 2, face: 3 });
    expect(skipLabel(r)).toMatch(/Ben überspringen/);
    r = act(r, { type: "skip" });
    expect(cur(r)).toBe("p3");
    expect(g(r).bids).toEqual([]);
    r = game(r, { type: "bid", count: 2, face: 3 });
    r = act(r, { type: "removePlayer", id: "p3" });
    expect(g(r).bids).toEqual([]);
    expect(cur(r)).toBe("p1");
    r = act(r, { type: "removePlayer", id: "p2" });
    expect(roomGame(r).isOver(r.game)).toBe(true);
  });
  it("Wahrscheinlichkeit und Vorschlag: sichere Ansage erhöhen, unglaubwürdige anzweifeln", () => {
    expect(atLeast(0, 5, 1 / 3)).toBe(1);
    expect(atLeast(6, 5, 1 / 3)).toBe(0);
    expect(atLeast(1, 1, 1 / 6)).toBeCloseTo(1 / 6);
    let r = cups(start(2), [5, 5, 5, 1, 2], [2, 3, 4, 6, 6]);
    expect(bidChance(g(r), "p1", { count: 4, face: 5 }, r.options)).toBe(1);
    const plan = suggest(g(r), "p1", r.options);
    expect(plan.type).toBe("bid");
    r = game(r, { type: "bid", count: 9, face: 4 });
    expect(suggest(g(r), "p2", r.options).type).toBe("doubt");
  });
  it("Vorlesen: Ansage, Bluff!, was liegt, wer verliert", () => {
    let r = cups(start(3), [5, 5, 2, 3, 4], [1, 6, 6, 2, 3], [2, 2, 3, 3, 4]);
    expect(narration(null, g(r), name(r), true).join(" ")).toContain("Anna sagt zuerst an.");
    const a = game(r, { type: "bid", count: 4, face: 5 });
    expect(narration(g(r), g(a), name(r), true).join(" ")).toBe("Anna: mindestens vier Fünfen.");
    r = game(a, { type: "doubt" });
    const said = narration(g(a), g(r), name(r), true).join(" ");
    expect(said).toContain("Ben ruft: Bluff!");
    expect(said).toContain("Es liegen drei Fünfen mit Jokern.");
    expect(said).toContain("Anna verliert einen Würfel.");
    const n = applyRoomAction(r, { type: "game", action: { type: "next" } }, null);
    expect(narration(g(r), g(n), name(r), true).join(" ")).toContain("Neue Runde. Anna sagt zuerst an.");
  });
});
