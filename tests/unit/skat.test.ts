import { describe, expect, it } from "vitest";
import {
  BIDS, canPlay, deck, declareWhyNot, gameValueOf, maxBid, settle, settleRamsch, skat, sortHand, spitzen, suggestCard, trickWinner, trumpsOf, viewFor,
  type Game, type Play, type SkState, type TrickRec,
} from "@shared/games/skat/logic";
import type { Card } from "@shared/cards/deck";
import { roomGame, viewRoom } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const ctx = (options: Record<string, unknown> = {}, actorId: string | null = null, ids = ["a", "b", "c"]) => ({
  players: ids.map((id) => ({ id, name: id.toUpperCase() })), hostId: "a", actorId, options: options as never, now: 1000, round: 0,
});
const P = (id: string, card: string): Play => ({ id, card: card as Card });
const AUG: Record<string, number> = { A: 11, "10": 10, K: 4, D: 3, B: 2, "9": 0, "8": 0, "7": 0 };
const T = (winner: string, cards: [string, string][]): TrickRec => {
  const plays = cards.map(([id, c]) => P(id, c));
  return { plays, winner, augen: plays.reduce((t, p) => t + AUG[p.card.split("-")[1]], 0) };
};
const G = (kind: Game["kind"], extra: Partial<Game> = {}): Game => ({ kind, hand: false, schneider: false, schwarz: false, ouvert: false, ...extra });

describe("Skat: Karten, Reizwerte, Spitzen", () => {
  it("32 Karten, 120 Augen", () => {
    expect(deck()).toHaveLength(32);
    expect(deck().reduce((t, c) => t + AUG[c.split("-")[1]], 0)).toBe(120);
  });

  it("Reizwerte: 18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60 …", () => {
    expect(BIDS.slice(0, 20)).toEqual([18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60]);
    expect(BIDS.at(-1)).toBe(264);
  });

  it("Trumpf: Buben (Kreuz, Pik, Herz, Karo), dann A, 10, K, D, 9, 8, 7 – Grand nur Buben, Null ohne Trumpf", () => {
    expect(trumpsOf("herz")).toEqual(["kreuz-B", "pik-B", "herz-B", "karo-B", "herz-A", "herz-10", "herz-K", "herz-D", "herz-9", "herz-8", "herz-7"]);
    expect(trumpsOf("grand")).toEqual(["kreuz-B", "pik-B", "herz-B", "karo-B"]);
    expect(trumpsOf("null")).toEqual([]);
    expect(sortHand(["herz-7", "kreuz-A", "pik-B", "herz-A", "kreuz-10", "kreuz-K"] as Card[], "herz")).toEqual(["pik-B", "herz-A", "herz-7", "kreuz-A", "kreuz-10", "kreuz-K"]);
  });

  it("Spitzen: mit und ohne – über die zwölf Karten", () => {
    expect(spitzen(["kreuz-B", "pik-B", "karo-B", "herz-A"] as Card[], "herz")).toBe(2);
    expect(spitzen(["kreuz-B", "pik-B", "herz-B", "karo-B", "herz-A", "herz-10", "herz-K"] as Card[], "herz")).toBe(7);
    expect(spitzen(["herz-B", "herz-A"] as Card[], "herz")).toBe(-2);
    expect(spitzen(["herz-A", "herz-7"] as Card[], "herz")).toBe(-4);
    expect(spitzen(["herz-A", "herz-7"] as Card[], "grand")).toBe(-4);
    expect(spitzen(["kreuz-B", "pik-B", "herz-B", "karo-B"] as Card[], "grand")).toBe(4);
  });

  it("Spielwert: (Spitzen + 1 + Hand + Schneider + Schwarz + ouvert) × Grundwert; Null fest", () => {
    expect(gameValueOf(G("herz"), 1)).toBe(20);
    expect(gameValueOf(G("kreuz"), -3)).toBe(48);
    expect(gameValueOf(G("grand", { hand: true }), 2)).toBe(96);
    expect(gameValueOf(G("pik", { hand: true, schneider: true, schwarz: true, ouvert: true }), 1)).toBe(11 * 8);
    expect([gameValueOf(G("null"), 0), gameValueOf(G("null", { hand: true }), 0), gameValueOf(G("null", { ouvert: true }), 0), gameValueOf(G("null", { hand: true, ouvert: true }), 0)]).toEqual([23, 35, 46, 59]);
  });
});

describe("Skat: Stiche", () => {
  it("Stichsieger: Bube sticht Farbe, Kreuz-Bube vor Pik-Bube, 10 zwischen Ass und König, Abwurf zählt nicht", () => {
    expect(trickWinner([P("a", "herz-A"), P("b", "herz-10"), P("c", "karo-B")], "herz")).toBe("c");
    expect(trickWinner([P("a", "pik-B"), P("b", "kreuz-B"), P("c", "herz-A")], "grand")).toBe("b");
    expect(trickWinner([P("a", "kreuz-K"), P("b", "kreuz-10"), P("c", "pik-A")], "grand")).toBe("b");
    expect(trickWinner([P("a", "kreuz-K"), P("b", "herz-7"), P("c", "kreuz-D")], "herz")).toBe("b");
    expect(trickWinner([P("a", "kreuz-K"), P("b", "herz-7"), P("c", "kreuz-D")], "grand")).toBe("a");
  });

  it("Null: kein Trumpf, 10 zwischen 9 und Bube; Bube muss Farbe bedienen", () => {
    expect(trickWinner([P("a", "herz-10"), P("b", "herz-9"), P("c", "herz-B")], "null")).toBe("c");
    expect(trickWinner([P("a", "kreuz-B"), P("b", "kreuz-A"), P("c", "pik-A")], "null")).toBe("b");
    const s = { trick: [P("a", "kreuz-7")], game: G("null"), ramsch: false };
    expect(canPlay(s, ["kreuz-B", "herz-A"] as Card[], "herz-A" as Card)).toBe(false);
    // im Farbspiel ist der Kreuz-Bube Trumpf und bedient Kreuz nicht
    expect(canPlay({ ...s, game: G("herz") }, ["kreuz-B", "herz-A"] as Card[], "herz-A" as Card)).toBe(true);
  });
});

/** Fertig gespielte Runde mit festen Stichen */
function finished(game: Game, tricks: TrickRec[], skatCards: string[], bid = 18, hands: Record<string, string[]> = {}) {
  return { round: 1, declarer: "a", bid, game, tricks, skat: skatCards as Card[], hands: hands as Record<string, Card[]>, seats: ["a", "b", "c"] };
}

describe("Skat: Abrechnung", () => {
  // a spielt Herz mit Kreuz-Bube und Pik-Bube (mit 2), macht 7 Stiche
  const tricks: TrickRec[] = [
    T("a", [["a", "kreuz-B"], ["b", "herz-7"], ["c", "herz-8"]]),
    T("a", [["a", "pik-B"], ["b", "herz-9"], ["c", "karo-7"]]),
    T("a", [["a", "kreuz-A"], ["b", "kreuz-7"], ["c", "kreuz-8"]]),
    T("a", [["a", "pik-A"], ["b", "pik-7"], ["c", "pik-8"]]),
    T("a", [["a", "karo-A"], ["b", "karo-8"], ["c", "karo-9"]]),
    T("a", [["a", "herz-A"], ["b", "herz-D"], ["c", "karo-K"]]),
    T("a", [["a", "herz-10"], ["b", "kreuz-9"], ["c", "pik-9"]]),
    T("b", [["a", "herz-K"], ["b", "herz-B"], ["c", "kreuz-10"]]),
    T("c", [["a", "kreuz-K"], ["b", "kreuz-D"], ["c", "karo-B"]]),
    T("b", [["a", "pik-K"], ["b", "pik-10"], ["c", "pik-D"]]),
  ];
  const skatCards = ["karo-10", "karo-D"];

  it("gewonnen: mit 2, Spiel 3 × 10 = 30; Augen mit Skat", () => {
    const r = settle(finished(G("herz"), tricks, skatCards));
    expect(r.spitzen).toBe(2);
    expect(r.augen).toBe(120 - (tricks[7].augen + tricks[8].augen + tricks[9].augen));
    expect(r.won).toBe(true);
    expect(r.value).toBe(30);
    expect(r.points).toEqual({ a: 30, b: 0, c: 0 });
  });

  it("überreizt: bei 33 verloren mit dem nächsten Vielfachen (40), doppelt minus", () => {
    const r = settle(finished(G("herz"), tricks, skatCards, 33));
    expect(r.overbid).toBe(true);
    expect(r.won).toBe(false);
    expect(r.value).toBe(40);
    expect(r.points.a).toBe(-80);
    expect(settle(finished(G("herz"), tricks, skatCards, 33), false).points.a).toBe(-40);
  });

  it("Schneider zählt mit und kann ein Überreizen retten; angesagt nicht geschafft → verloren", () => {
    const allA = tricks.map((t) => ({ ...t, winner: "a" }));
    const r = settle(finished(G("herz"), allA, skatCards, 50));
    // mit 2, Spiel 3, Schneider 4, Schwarz 5 → 50
    expect(r.value).toBe(50);
    expect(r.won).toBe(true);
    const ann = settle(finished(G("herz", { hand: true, schneider: true, schwarz: true }), tricks, skatCards, 18));
    expect(ann.won).toBe(false);
    // mit 2, Spiel, Hand, Schneider, angesagt, Schwarz, angesagt = 8 × 10
    expect(ann.value).toBe(80);
    expect(ann.points.a).toBe(-160);
  });

  it("verloren mit 60 Augen, Schneider gegen den Alleinspieler zählt", () => {
    const lost = tricks.map((t, i) => ({ ...t, winner: i < 2 ? "a" : "b" }));
    const r = settle(finished(G("grand"), lost, ["karo-7", "herz-7"]));
    expect(r.augen).toBeLessThanOrEqual(30);
    expect(r.won).toBe(false);
    // mit 2, Spiel, Schneider = 4 × 24
    expect(r.value).toBe(96);
  });

  it("Null: verloren mit dem ersten Stich, Wert fest", () => {
    const r = settle(finished(G("null", { hand: true }), [T("a", [["a", "herz-A"], ["b", "herz-7"], ["c", "herz-8"]])], ["karo-7", "herz-9"], 18));
    expect(r.won).toBe(false);
    expect(r.points.a).toBe(-70);
    const w = settle(finished(G("null"), tricks.map((t) => ({ ...t, winner: "b" })), ["karo-7", "herz-9"], 23));
    expect(w.won).toBe(true);
    expect(w.points.a).toBe(23);
    expect(declareWhyNot({ tookSkat: true, bid: 24 }, { kind: "null" })).toMatch(/nur 23/);
    expect(declareWhyNot({ tookSkat: true, bid: 24 }, { kind: "null", ouvert: true })).toBeNull();
    expect(declareWhyNot({ tookSkat: true, bid: 18 }, { kind: "herz", schneider: true })).toMatch(/Handspiel/);
  });

  it("Ramsch: die meisten Augen verlieren, Skat an den letzten Stich, Jungfrau verdoppelt, Durchmarsch", () => {
    const base = { round: 1, seats: ["a", "b", "c"], active: ["a", "b", "c"], skat: ["karo-10", "karo-D"] as Card[] };
    const ts = tricks.map((t, i) => ({ ...t, winner: i < 5 ? "a" : "b" }));
    const r = settleRamsch({ ...base, tricks: ts });
    // c macht keinen Stich: Jungfrau
    expect(r.virgins).toEqual(["c"]);
    const aug = r.augenBy;
    expect(aug.a + aug.b + aug.c).toBe(120);
    expect(r.losers).toHaveLength(1);
    expect(r.points[r.losers[0]]).toBe(-aug[r.losers[0]] * 2);
    expect(settleRamsch({ ...base, tricks: ts }, false).points[r.losers[0]]).toBe(-aug[r.losers[0]]);
    const sweep = settleRamsch({ ...base, tricks: tricks.map((t) => ({ ...t, winner: "c" })) });
    expect(sweep.sweep).toBe("c");
    expect(sweep.points).toEqual({ a: 0, b: 0, c: 120 });
  });
});

describe("Skat: Ablauf", () => {
  it("Reizen: Mittelhand sagt Vorhand, Hinterhand sagt dem Gewinner – dann Skat, Drücken, Ansage", () => {
    let s = skat.setup(ctx());
    // Geber c: Vorhand a, Mittelhand b, Hinterhand c
    expect(s.dealerId).toBe("c");
    expect(s.active).toEqual(["a", "b", "c"]);
    expect(s.curId).toBe("b");
    expect(Object.values(s.hands).every((h) => h.length === 10)).toBe(true);
    expect(s.skat).toHaveLength(2);
    s = skat.apply(s, { type: "bid", value: 18 }, ctx());
    expect(s.curId).toBe("a");
    s = skat.apply(s, { type: "hold" }, ctx());
    expect(s.curId).toBe("b");
    expect(() => skat.apply(s, { type: "bid", value: 18 }, ctx())).toThrow();
    s = skat.apply(s, { type: "bid", value: 20 }, ctx());
    s = skat.apply(s, { type: "pass" }, ctx());
    // a passt: b gewinnt Stufe 1, jetzt sagt c dem b
    expect(s.curId).toBe("c");
    expect(s.bidding?.listener).toBe("b");
    s = skat.apply(s, { type: "bid", value: 22 }, ctx());
    s = skat.apply(s, { type: "pass" }, ctx());
    expect(s.phase).toBe("skat");
    expect(s.declarer).toBe("c");
    expect(s.bid).toBe(22);
    s = skat.apply(s, { type: "skat", take: true }, ctx());
    expect(s.hands.c).toHaveLength(12);
    expect(() => skat.apply(s, { type: "discard", cards: [s.hands.c[0]] }, ctx())).toThrow();
    s = skat.apply(s, { type: "discard", cards: s.hands.c.slice(-2) }, ctx());
    expect(s.hands.c).toHaveLength(10);
    expect(() => skat.apply(s, { type: "declare", kind: "pik", ouvert: true }, ctx())).toThrow(/Handspiel/);
    s = skat.apply(s, { type: "declare", kind: "grand" }, ctx());
    expect(s.phase).toBe("play");
    expect(s.curId).toBe("a");
  });

  it("niemand reizt: Vorhand darf 18 spielen; passen alle – eingepasst oder Ramsch", () => {
    let s = skat.setup(ctx());
    s = skat.apply(s, { type: "pass" }, ctx());
    s = skat.apply(s, { type: "pass" }, ctx());
    expect(s.bidding?.stage).toBe(3);
    expect(s.curId).toBe("a");
    const eighteen = skat.apply(s, { type: "bid", value: 18 }, ctx());
    expect(eighteen.declarer).toBe("a");
    expect(eighteen.bid).toBe(18);
    const out = skat.apply(s, { type: "pass" }, ctx());
    expect(out.phase).toBe("roundEnd");
    expect(out.history[0].kind).toBe("eingepasst");
    const ramsch = skat.apply(s, { type: "pass" }, ctx({ ramsch: true }));
    expect(ramsch.phase).toBe("play");
    expect(ramsch.ramsch).toBe(true);
    expect(ramsch.curId).toBe("a");
  });

  it("Hand, ouvert: Hand des Alleinspielers für alle offen, Skat bleibt geheim; Null-Spieler verliert beim ersten Stich", () => {
    let s = skat.setup(ctx());
    s = skat.apply(s, { type: "bid", value: 18 }, ctx());
    s = skat.apply(s, { type: "pass" }, ctx());
    s = skat.apply(s, { type: "pass" }, ctx());
    expect(s.declarer).toBe("b");
    expect(viewFor(s, "b").skat).toEqual([]);
    s = skat.apply(s, { type: "skat", take: false }, ctx());
    s = skat.apply(s, { type: "declare", kind: "null", ouvert: true }, ctx());
    expect(s.game).toMatchObject({ kind: "null", hand: true, ouvert: true });
    expect(Object.keys(viewFor(s, "a").hands).sort()).toEqual(["a", "b"]);
    expect(viewFor(s, "b").skat).toEqual([]);
    expect(viewFor(s, "c").skat).toEqual([]);
    for (let i = 0; i < 40 && s.phase === "play"; i++) {
      const id = s.curId!;
      s = skat.apply(s, { type: "play", card: s.hands[id].find((c) => canPlay(s, s.hands[id], c))! }, ctx());
    }
    const rec = s.history[0];
    expect(rec.kind).toBe("null");
    expect(rec.value).toBe(59);
    if (!rec.won) expect(s.tricks.at(-1)!.winner).toBe("b");
    else expect(s.tricks).toHaveLength(10);
  });

  it("zu viert sitzt der Geber aus; fehlende Plätze spielen Bots; Aussteiger wird Bot", () => {
    let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"], "skat"), { type: "selectGame", gameId: "skat" }, "p1");
    r = act(r, { type: "start" }, "p1");
    const s = r.game as SkState;
    expect(s.seats).toHaveLength(4);
    expect(s.active).not.toContain(s.dealerId);
    expect(s.hands[s.dealerId]).toHaveLength(0);
    let one = act(roomWith(["Anna"], "skat"), { type: "selectGame", gameId: "skat" }, "p1");
    one = act(one, { type: "start" }, "p1");
    const o = one.game as SkState;
    expect(o.seats).toHaveLength(3);
    expect(o.ghosts).toHaveLength(2);
    expect(o.curId).toBe("p1");
    expect(Object.keys((viewRoom(one, "p1").game as SkState).hands)).toEqual(["p1"]);
    // p1 spielt mit zwei Bots eine Runde zu Ende
    for (let i = 0; i < 100 && (one.game as SkState).phase !== "roundEnd"; i++) {
      const g = one.game as SkState;
      const v = viewRoom(one, "p1").game as SkState;
      if (g.phase === "bid") one = game(one, { type: "pass" }, "p1");
      else if (g.phase === "skat") one = game(one, { type: "skat", take: true }, "p1");
      else if (g.phase === "discard") one = game(one, { type: "discard", cards: v.hands.p1.slice(0, 2) }, "p1");
      else if (g.phase === "declare") one = game(one, { type: "declare", kind: "grand" }, "p1");
      else one = game(one, { type: "play", card: suggestCard(v, "p1")! }, "p1");
    }
    expect((one.game as SkState).phase).toBe("roundEnd");
    expect(roomGame(one).isOver(one.game)).toBe(false);
    r = act(r, { type: "removePlayer", id: (r.game as SkState).curId! }, "p1");
    expect((r.game as SkState).ghosts).toHaveLength(1);
  });

  it("Zugzeit: online läuft eine Frist, ist sie um, entscheidet die App; Host kann passen lassen", () => {
    let r = act(roomWith(["Anna", "Ben", "Cem"], "skat"), { type: "setOption", key: "think", value: "30" });
    r = act(r, { type: "start" }, "p1");
    const s = r.game as SkState;
    expect(s.deadline).not.toBeNull();
    const c = { ...ctx({ think: "30" }, "p2"), players: r.players };
    expect(skat.apply(s, { type: "timeUp" }, { ...c, now: s.deadline! - 5000 })).toBe(s);
    const t = skat.apply(s, { type: "timeUp" }, { ...c, now: s.deadline! + 10 });
    expect(t.said[s.curId!]).toMatch(/^(passe|18)$/);
    const k = skat.skipTurn!(s, c);
    expect(k.said[s.curId!]).toBe("passe");
  });

  it("Bots reizen nach Handstärke: starke Hand reizt, schwache passt", () => {
    expect(maxBid(["kreuz-B", "pik-B", "herz-B", "herz-A", "herz-10", "herz-K", "herz-9", "kreuz-A", "kreuz-10", "pik-A"] as Card[])).toBeGreaterThanOrEqual(40);
    expect(maxBid(["karo-7", "karo-8", "herz-8", "herz-K", "pik-9", "pik-D", "kreuz-8", "kreuz-K", "pik-K", "herz-D"] as Card[])).toBe(0);
  });
});
