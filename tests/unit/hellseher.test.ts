import { describe, expect, it } from "vitest";
import {
  buildDeck, canPlay, estimateBid, forbiddenBid, hellseher, leadSuit, points, roundsFor, trickWinner, type HsCard, type HsState, type Play,
} from "@shared/games/hellseher/logic";
import { applyRoomAction, viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as HsState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil", "Fritz"].slice(0, n)), { type: "selectGame", gameId: "hellseher" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Hände fest vorgeben, Trumpf setzen, Ansagephase beginnen */
function fix(r: RoomState, hands: Record<string, HsCard[]>, trump: HsState["trump"], extra: Partial<HsState> = {}): RoomState {
  const s = g(r);
  const round = Object.values(hands)[0].length;
  const ids = Object.keys(hands);
  return {
    ...r,
    game: {
      ...s, round, hands, counts: Object.fromEntries(ids.map((id) => [id, hands[id].length])), trump, trumpCard: trump ? `${trump}-1` : null,
      phase: "bid", curId: s.curId ?? ids[0], bids: Object.fromEntries(ids.map((id) => [id, null])), bidIn: Object.fromEntries(ids.map((id) => [id, false])),
      tricks: Object.fromEntries(ids.map((id) => [id, 0])), trick: [], lastTrick: null, ...extra,
    },
  };
}
const P = (id: string, card: HsCard): Play => ({ id, card });

describe("Hellseher", () => {
  it("60 Karten: 4 Farben 1–13, 4 Zauberer, 4 Narren", () => {
    const d = buildDeck();
    expect(d).toHaveLength(60);
    expect(new Set(d).size).toBe(60);
    expect(d.filter((c) => c.startsWith("z-"))).toHaveLength(4);
    expect(d.filter((c) => c.startsWith("n-"))).toHaveLength(4);
    expect(d).toContain("y-13");
  });

  it("Rundenzahl: 60 / Spieler, kürzer per Einstellung", () => {
    expect([3, 4, 5, 6].map((n) => roundsFor(n, {}))).toEqual([20, 15, 12, 10]);
    expect(roundsFor(3, { length: "10" })).toBe(10);
    expect(roundsFor(6, { length: "10" })).toBe(10);
    expect(roundsFor(4, { length: "half" })).toBe(8);
  });

  it("Runde 1: eine Karte je Spieler, Trumpfkarte, der Erste sagt an (der Letzte gibt)", () => {
    const r = start(4);
    const s = g(r);
    expect(Object.values(s.hands).map((h) => h.length)).toEqual([1, 1, 1, 1]);
    expect(s.deck.length).toBe(60 - 4 - 1);
    expect(s.dealerId).toBe("p4");
    expect(s.phase === "bid" || s.phase === "trump").toBe(true);
    if (s.phase === "bid") expect(s.curId).toBe("p1");
    else expect(s.curId).toBe("p4");
  });

  it("Stichgewinner: erster Zauberer, sonst höchster Trumpf, sonst höchste angespielte Farbe, nur Narren: erster Narr", () => {
    expect(trickWinner([P("a", "r-5"), P("b", "z-1"), P("c", "z-2")], "b")).toBe("b");
    expect(trickWinner([P("a", "r-13"), P("b", "b-2"), P("c", "b-9")], "b")).toBe("c");
    expect(trickWinner([P("a", "r-5"), P("b", "r-12"), P("c", "g-13")], "b")).toBe("b");
    expect(trickWinner([P("a", "n-1"), P("b", "n-2"), P("c", "n-3")], "b")).toBe("a");
    // Narr ausgespielt: die erste Farbkarte danach zählt als ausgespielt
    expect(trickWinner([P("a", "n-1"), P("b", "g-3"), P("c", "r-13")], null)).toBe("b");
    expect(trickWinner([P("a", "n-1"), P("b", "g-3"), P("c", "g-7")], null)).toBe("c");
  });

  it("Bedienen: Farbe ist Pflicht, Zauberer/Narr immer erlaubt, nach Zauberer frei", () => {
    const hand = ["r-3", "b-9", "z-1", "n-1"];
    expect(canPlay([P("a", "r-10")], hand, "b-9")).toBe(false);
    expect(canPlay([P("a", "r-10")], hand, "r-3")).toBe(true);
    expect(canPlay([P("a", "r-10")], hand, "z-1")).toBe(true);
    expect(canPlay([P("a", "r-10")], hand, "n-1")).toBe(true);
    expect(canPlay([P("a", "g-10")], hand, "b-9")).toBe(true);
    expect(canPlay([P("a", "z-2")], hand, "b-9")).toBe(true);
    expect(leadSuit([P("a", "n-2"), P("b", "y-4")])).toBe("y");
    expect(leadSuit([P("a", "n-2"), P("b", "z-4"), P("c", "y-4")])).toBeNull();
  });

  it("Punkte: 20 + 10 je Stich, sonst −10 je Stich Abweichung", () => {
    expect(points(0, 0)).toBe(20);
    expect(points(3, 3)).toBe(50);
    expect(points(2, 0)).toBe(-20);
    expect(points(1, 4)).toBe(-30);
  });

  it("Ganze Runde in der App: ansagen, Stiche, Wertung, nächster Geber", () => {
    let r = fix(start(3), { p1: ["r-5", "b-2"], p2: ["r-9", "g-1"], p3: ["n-1", "z-1"] }, "b", { curId: "p1", dealerId: "p3" });
    r = game(r, { type: "bid", bid: 1 });
    expect(() => game(r, { type: "play", card: "r-5" })).toThrow(/nicht gespielt/);
    r = game(r, { type: "bid", bid: 0 });
    r = game(r, { type: "bid", bid: 1 });
    expect(g(r).phase).toBe("play");
    expect(g(r).curId).toBe("p1");
    r = game(r, { type: "play", card: "r-5" });
    expect(() => game(r, { type: "play", card: "g-1" })).toThrow(/Rot bedienen/);
    r = game(r, { type: "play", card: "r-9" });
    r = game(r, { type: "play", card: "n-1" });
    expect(g(r).lastTrick?.winner).toBe("p2");
    expect(g(r).curId).toBe("p2");
    r = game(r, { type: "play", card: "g-1" });
    r = game(r, { type: "play", card: "z-1" });
    r = game(r, { type: "play", card: "b-2" });
    expect(g(r).phase).toBe("roundEnd");
    // p1: 1 angesagt, 0 gemacht; p2: 0 angesagt, 1 gemacht; p3: 1/1
    expect(g(r).scores).toEqual({ p1: -10, p2: -10, p3: 30 });
    r = game(r, { type: "nextRound" });
    expect(g(r).round).toBe(3);
    expect(g(r).dealerId).toBe("p1");
    expect(g(r).hands.p2).toHaveLength(3);
  });

  it("Hausregel: Ansagen dürfen nicht aufgehen – nur für den Letzten", () => {
    let r = fix(start(3, { noEven: true }), { p1: ["r-5", "b-2"], p2: ["r-9", "g-1"], p3: ["n-1", "z-1"] }, "b", { curId: "p1", dealerId: "p3" });
    r = game(r, { type: "bid", bid: 1 });
    expect(forbiddenBid(g(r), r.players, r.options, "p2")).toBeNull();
    r = game(r, { type: "bid", bid: 0 });
    expect(forbiddenBid(g(r), r.players, r.options, "p3")).toBe(1);
    expect(() => game(r, { type: "bid", bid: 1 })).toThrow(/nicht aufgehen/);
    r = game(r, { type: "bid", bid: 2 });
    expect(g(r).phase).toBe("play");
  });

  it("Zauberer als Trumpfkarte: der Geber wählt, Narr: kein Trumpf", () => {
    let r = fix(start(3), { p1: ["r-5"], p2: ["r-9"], p3: ["n-1"] }, null, { phase: "trump", curId: "p3", dealerId: "p3", trumpCard: "z-3" });
    expect(hellseher.currentPlayerId(g(r))).toBe("p3");
    expect(() => game(r, { type: "bid", bid: 1 })).toThrow();
    r = game(r, { type: "trump", suit: "g" });
    expect(g(r).trump).toBe("g");
    expect(g(r).phase).toBe("bid");
    expect(g(r).curId).toBe("p1");
  });

  it("Verdeckt ansagen: gleichzeitig, fremde Ansagen bleiben bis zum Schluss geheim", () => {
    let r = start(3, { secret: true });
    r = fix(r, { p1: ["r-5"], p2: ["r-9"], p3: ["n-1"] }, "b", { curId: null, dealerId: "p3" });
    expect(hellseher.currentPlayerId(g(r))).toBeNull();
    r = applyRoomAction(r, { type: "game", action: { type: "secretBid", bid: 1 } }, "p2");
    expect(() => applyRoomAction(r, { type: "game", action: { type: "secretBid", player: "p3", bid: 0 } }, "p1")).toThrow(/für dich/);
    const v = viewRoom(r, "p1").game as HsState;
    expect(v.bids.p2).toBeNull();
    expect(v.bidIn.p2).toBe(true);
    expect(v.hands.p2).toBeUndefined();
    expect(v.deck).toEqual([]);
    r = applyRoomAction(r, { type: "game", action: { type: "secretBid", bid: 0 } }, "p1");
    r = applyRoomAction(r, { type: "game", action: { type: "secretBid", bid: 0 } }, "p3");
    expect(g(r).phase).toBe("play");
    expect((viewRoom(r, "p1").game as HsState).bids.p2).toBe(1);
  });

  it("Online: nur wer dran ist, spielt; fremde Hände sind unsichtbar", () => {
    let r = fix(start(3), { p1: ["r-5"], p2: ["r-9"], p3: ["n-1"] }, "b", { curId: "p1", dealerId: "p3" });
    expect(() => applyRoomAction(r, { type: "game", action: { type: "bid", bid: 1 } }, "p2")).toThrow();
    r = applyRoomAction(r, { type: "game", action: { type: "bid", bid: 1 } }, "p1");
    expect(Object.keys((viewRoom(r, "p2").game as HsState).hands)).toEqual(["p2"]);
  });

  it("Überspringen hängt nie: Ansage 0, Karte spielen", () => {
    let r = fix(start(3), { p1: ["r-5"], p2: ["r-9"], p3: ["n-1"] }, "b", { curId: "p1", dealerId: "p3" });
    for (let i = 0; i < 3; i++) r = act(r, { type: "skip" });
    expect(g(r).phase).toBe("play");
    for (let i = 0; i < 3; i++) r = act(r, { type: "skip" });
    expect(g(r).phase).toBe("roundEnd");
  });

  it("Spieler geht: Runde wird mit den Übrigen neu gegeben", () => {
    let r = start(4);
    r = act(r, { type: "removePlayer", id: "p2" });
    const s = g(r);
    expect(Object.keys(s.hands).sort()).toEqual(["p1", "p3", "p4"]);
    expect(s.scores.p2).toBeUndefined();
    expect(s.totalRounds).toBe(15);
  });

  it("Echte Karten: Ansagen, Stiche, Summe muss stimmen, Punkte und Geber", () => {
    let r = start(3, { mode: "table", noEven: true });
    expect(g(r).phase).toBe("tableBid");
    expect(g(r).dealerId).toBe("p3");
    r = game(r, { type: "tBid", player: "p1", bid: 1 });
    r = game(r, { type: "tBid", player: "p2", bid: 0 });
    r = game(r, { type: "tBid", player: "p3", bid: 0 });
    // 1 Karte, Summe 1 – geht auf, mit Hausregel verboten
    expect(() => game(r, { type: "tBidsDone" })).toThrow(/gehen auf/);
    r = game(r, { type: "tBid", player: "p3", bid: 1 });
    r = game(r, { type: "tBidsDone" });
    r = game(r, { type: "tTricks", player: "p1", n: 1 });
    r = game(r, { type: "tTricks", player: "p2", n: 0 });
    r = game(r, { type: "tTricks", player: "p3", n: 1 });
    expect(() => game(r, { type: "tFinish" })).toThrow(/eingetragen sind 2/);
    r = game(r, { type: "tTricks", player: "p3", n: 0 });
    r = game(r, { type: "tFinish" });
    expect(g(r).scores).toEqual({ p1: 30, p2: 20, p3: -10 });
    expect(g(r).round).toBe(2);
    expect(g(r).dealerId).toBe("p1");
    expect(g(r).phase).toBe("tableBid");
  });

  it("Echte Karten online: jeder trägt nur seine Zahlen ein, verdeckte Ansage bleibt geheim", () => {
    let r = start(3, { mode: "table", secret: true });
    r = applyRoomAction(r, { type: "game", action: { type: "tBid", bid: 1 } }, "p2");
    expect(() => applyRoomAction(r, { type: "game", action: { type: "tBid", player: "p3", bid: 1 } }, "p2")).toThrow(/eigenen/);
    expect((viewRoom(r, "p3").game as HsState).bids.p2).toBeNull();
    expect((viewRoom(r, "p3").game as HsState).bidIn.p2).toBe(true);
  });

  it("Partie endet nach der letzten Runde, Ergebnis für die Statistik", () => {
    let r = start(3, { mode: "table", length: "half" });
    for (let round = 1; round <= 10; round++) {
      for (const p of ["p1", "p2", "p3"]) r = game(r, { type: "tBid", player: p, bid: p === "p1" ? round : 0 });
      r = game(r, { type: "tBidsDone" });
      for (const p of ["p1", "p2", "p3"]) r = game(r, { type: "tTricks", player: p, n: p === "p1" ? round : 0 });
      r = game(r, { type: "tFinish" });
    }
    expect(hellseher.isOver(g(r))).toBe(true);
    const res = hellseher.results!(g(r), { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.find((x) => x.id === "p1")).toEqual({ id: "p1", won: true, score: 10 * 20 + 10 * 55 });
  });

  it("Spielhilfe schätzt nur aus der eigenen Hand", () => {
    expect(estimateBid(["z-1", "z-2", "n-1"], "r", 4)).toBe(2);
    expect(estimateBid(["r-13", "r-12", "b-2"], "r", 4)).toBe(2);
  });
});
