import { describe, expect, it } from "vitest";
import {
  beats, callWhyNot, deckOf, doppelkopf, keyOf, knownParties, needOf, settle, sortHand, trickWinner, trumpsOf, viewFor,
  type DkState, type Play, type TrickRec,
} from "@shared/games/doppelkopf/logic";
import type { Card } from "@shared/cards/deck";
import { roomGame, viewRoom } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const ctx = (options: Record<string, unknown> = {}, actorId: string | null = null) => ({
  players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })), hostId: "a", actorId, options: options as never, now: 1000, round: 0,
});
const P = (id: string, card: string): Play => ({ id, card: card as Card });
const T = (winner: string, cards: [string, string][]): TrickRec => {
  const plays = cards.map(([id, c]) => P(id, c));
  return { plays, winner, augen: plays.reduce((t, p) => t + ({ A: 11, "10": 10, K: 4, D: 3, B: 2, "9": 0 } as Record<string, number>)[p.card.split("-")[1]], 0) };
};

describe("Doppelkopf: Karten und Trumpf", () => {
  it("48 Karten, jede zweimal – ohne Neunen 40, zusammen 240 Augen", () => {
    expect(deckOf(true)).toHaveLength(48);
    expect(deckOf(false)).toHaveLength(40);
    const sum = (cs: string[]) => cs.reduce((t, c) => t + ({ A: 11, "10": 10, K: 4, D: 3, B: 2, "9": 0 } as Record<string, number>)[c.split("-")[1]], 0);
    expect(sum(deckOf(true))).toBe(240);
    expect(sum(deckOf(false))).toBe(240);
  });

  it("Trumpfreihenfolge: Dulle, Damen, Buben, Karo-Ass, -10, -König, -9", () => {
    expect(trumpsOf("normal")).toEqual(["herz-10", "kreuz-D", "pik-D", "herz-D", "karo-D", "kreuz-B", "pik-B", "herz-B", "karo-B", "karo-A", "karo-10", "karo-K", "karo-9"]);
    expect(trumpsOf("dame")).toEqual(["kreuz-D", "pik-D", "herz-D", "karo-D"]);
    expect(trumpsOf("bube")).toEqual(["kreuz-B", "pik-B", "herz-B", "karo-B"]);
    expect(trumpsOf("fleischlos")).toEqual([]);
    expect(trumpsOf("herz").slice(-3)).toEqual(["herz-A", "herz-K", "herz-9"]);
    expect(trumpsOf("kreuz")).toContain("kreuz-10");
    expect(keyOf("herz-10" as Card, "normal")).toBe("trumpf");
    expect(keyOf("herz-A" as Card, "normal")).toBe("herz");
    expect(keyOf("karo-A" as Card, "kreuz")).toBe("karo");
    expect(keyOf("kreuz-D" as Card, "fleischlos")).toBe("kreuz");
  });

  it("Hand: Trümpfe zuerst von hoch nach niedrig, dann Fehlfarben", () => {
    expect(sortHand(["pik-9", "karo-9", "herz-10", "kreuz-A", "pik-D"] as Card[], "normal")).toEqual(["herz-10", "pik-D", "karo-9", "kreuz-A", "pik-9"]);
  });

  it("Stichsieger: Trumpf sticht Fehl, höhere Fehl gewinnt, abgeworfene Farbe nicht – gleiche Karten: die erste", () => {
    expect(trickWinner([P("a", "kreuz-A"), P("b", "kreuz-10"), P("c", "karo-9"), P("d", "kreuz-A")], "normal")).toBe("c");
    expect(trickWinner([P("a", "kreuz-K"), P("b", "kreuz-A"), P("c", "pik-A"), P("d", "kreuz-9")], "normal")).toBe("b");
    // zwei Dullen: die erste sticht
    expect(trickWinner([P("a", "karo-A"), P("b", "herz-10"), P("c", "herz-10"), P("d", "kreuz-D")], "normal")).toBe("b");
    expect(trickWinner([P("a", "kreuz-A"), P("b", "pik-D"), P("c", "pik-D"), P("d", "kreuz-9")], "normal")).toBe("b");
    expect(trickWinner([P("a", "kreuz-A"), P("b", "kreuz-A"), P("c", "kreuz-10"), P("d", "kreuz-9")], "normal")).toBe("a");
    // Damensolo: Bube ist Fehl, Kreuz-Dame Trumpf
    expect(trickWinner([P("a", "kreuz-B"), P("b", "kreuz-A"), P("c", "karo-D"), P("d", "kreuz-K")], "dame")).toBe("c");
    // Fleischlos: Dame folgt nur der Farbe
    expect(trickWinner([P("a", "herz-10"), P("b", "herz-A"), P("c", "kreuz-D"), P("d", "herz-K")], "fleischlos")).toBe("b");
    expect(beats("herz-10" as Card, "kreuz-D" as Card, "trumpf", "normal")).toBe(true);
  });
});

/** Raum mit vier Spielern, Karten fest verteilt */
function fixed(hands: Record<string, string[]>, extra: Partial<DkState> = {}): DkState {
  const s = doppelkopf.setup(ctx());
  return { ...s, hands: hands as Record<string, Card[]>, dealerId: "d", curId: "a", ...extra };
}

describe("Doppelkopf: Vorbehalte und Parteien", () => {
  const hands = {
    a: ["kreuz-D", "kreuz-D", "pik-9", "pik-9", "herz-9", "herz-9", "karo-9", "karo-9", "kreuz-9", "kreuz-9", "pik-K", "pik-K"],
    b: ["herz-10", "herz-10", "pik-D", "pik-D", "herz-D", "herz-D", "karo-D", "karo-D", "kreuz-B", "kreuz-B", "pik-B", "pik-B"],
    c: ["herz-B", "herz-B", "karo-B", "karo-B", "karo-A", "karo-A", "karo-10", "karo-10", "karo-K", "karo-K", "kreuz-A", "kreuz-A"],
    d: ["kreuz-10", "kreuz-10", "kreuz-K", "kreuz-K", "pik-A", "pik-A", "pik-10", "pik-10", "herz-A", "herz-A", "herz-K", "herz-K"],
  };

  it("Hochzeit: der erste fremde Stich macht den Partner, dann sind alle Parteien klar", () => {
    let s = fixed(hands);
    s = doppelkopf.apply(s, { type: "reserve", what: "hochzeit" }, ctx());
    for (let i = 0; i < 3; i++) s = doppelkopf.apply(s, { type: "reserve", what: "gesund" }, ctx());
    expect(s.contract).toBe("hochzeit");
    expect(s.soloist).toBe("a");
    expect(s.revealed.a).toBe("re");
    expect(() => doppelkopf.apply(s, { type: "call", level: 1, player: "b" }, ctx())).toThrow(/Hochzeit/);
    // a spielt Pik aus, b sticht mit der Dulle → b heiratet mit
    s = doppelkopf.apply(s, { type: "play", card: "pik-9" as Card }, ctx());
    s = doppelkopf.apply(s, { type: "play", card: "herz-10" as Card }, ctx());
    s = doppelkopf.apply(s, { type: "play", card: "herz-B" as Card }, ctx());
    s = doppelkopf.apply(s, { type: "play", card: "pik-A" as Card }, ctx());
    expect(s.tricks[0].winner).toBe("b");
    expect(s.wedding).toMatchObject({ partner: "b", decided: true });
    expect(s.re.sort()).toEqual(["a", "b"]);
    expect(s.clearAt).toBe(1);
    expect(knownParties(viewFor(s, "c"), "c")).toEqual({ a: "re", b: "re", c: "kontra", d: "kontra" });
    // Ansage-Frist verschiebt sich um den Klärungsstich: c hat noch 11 Karten → Kontra geht
    expect(callWhyNot(s, "c", 1, {})).toBeNull();
  });

  it("Hochzeit ohne Partner: nach drei eigenen Stichen allein, als Solo gewertet", () => {
    let s = fixed({ ...hands, a: ["kreuz-D", "kreuz-D", "herz-10", "herz-10", "pik-D", "pik-D", "herz-D", "herz-D", "kreuz-9", "kreuz-9", "pik-K", "pik-K"], b: ["karo-D", "karo-D", "kreuz-B", "kreuz-B", "pik-B", "pik-B", "pik-9", "pik-9", "herz-9", "herz-9", "karo-9", "karo-9"] });
    s = doppelkopf.apply(s, { type: "reserve", what: "hochzeit" }, ctx());
    for (let i = 0; i < 3; i++) s = doppelkopf.apply(s, { type: "reserve", what: "gesund" }, ctx());
    for (const card of ["herz-10", "herz-10", "kreuz-D"]) {
      s = doppelkopf.apply(s, { type: "play", card: card as Card }, ctx());
      for (let k = 0; k < 3; k++) {
        const cur = s.curId!;
        const c = s.hands[cur].find((x) => trumpsOf("hochzeit").includes(x)) ?? s.hands[cur][0];
        s = doppelkopf.apply(s, { type: "play", card: c }, ctx());
      }
    }
    expect(s.tricks.every((t) => t.winner === "a")).toBe(true);
    expect(s.wedding).toMatchObject({ partner: null, decided: true });
    expect(s.re).toEqual(["a"]);
  });

  it("Solo schlägt Hochzeit, das erste Solo gilt; ohne Kreuz-Damen keine Hochzeit", () => {
    let s = fixed(hands);
    expect(() => doppelkopf.apply({ ...s, curId: "b" }, { type: "reserve", what: "hochzeit" }, ctx())).toThrow(/beiden Kreuz-Damen/);
    s = doppelkopf.apply(s, { type: "reserve", what: "hochzeit" }, ctx());
    s = doppelkopf.apply(s, { type: "reserve", what: "dame" }, ctx());
    s = doppelkopf.apply(s, { type: "reserve", what: "bube" }, ctx());
    expect(s.said.c).toBe("vorbehalt");
    // geheim: welcher Vorbehalt, sieht nur der Spieler selbst
    expect(viewFor(s, "a").reserves.b).toBeNull();
    s = doppelkopf.apply(s, { type: "reserve", what: "gesund" }, ctx());
    expect(s.contract).toBe("dame");
    expect(s.soloist).toBe("b");
    expect(s.re).toEqual(["b"]);
    expect(() => doppelkopf.apply(fixed(hands), { type: "reserve", what: "kreuz" }, ctx({ solos: false }))).toThrow(/Soli/);
  });

  it("Normalspiel: Re hat die Kreuz-Damen; geheim, bis eine fällt oder angesagt wird", () => {
    const h = { ...hands, a: hands.b, b: hands.a.map((c, i) => (i === 1 ? "pik-A" : c)), d: hands.d.map((c, i) => (i === 0 ? "kreuz-D" : c)) };
    let s = fixed(h);
    for (let i = 0; i < 4; i++) s = doppelkopf.apply(s, { type: "reserve", what: "gesund" }, ctx());
    expect(s.contract).toBe("normal");
    expect(s.re.sort()).toEqual(["b", "d"]);
    expect(viewFor(s, "a").re).toEqual([]);
    expect(knownParties(viewFor(s, "b"), "b")).toEqual({ b: "re" });
    expect(knownParties(viewFor(s, "a"), "a")).toEqual({ a: "kontra" });
    s = doppelkopf.apply(s, { type: "call", level: 1, player: "d" }, ctx());
    expect(s.calls.re).toBe(1);
    expect(knownParties(viewFor(s, "b"), "b")).toEqual({ a: "kontra", b: "re", c: "kontra", d: "re" });
    expect(() => doppelkopf.apply(s, { type: "call", level: 1, player: "b" }, ctx())).toThrow(/schon angesagt/);
    s = doppelkopf.apply(s, { type: "call", level: 2, player: "b" }, ctx());
    expect(s.calls.re).toBe(2);
    expect(() => doppelkopf.apply(s, { type: "call", level: 2, player: "a" }, ctx({ absagen: false }))).toThrow(/Absagen/);
  });

  it("Ansage-Frist: Re bis vor der zweiten eigenen Karte, keine 90 eine Karte später", () => {
    const s = fixed(hands, { phase: "play", contract: "normal", re: ["a"] });
    const with11 = { ...s, hands: { ...s.hands, a: s.hands.a.slice(1) } };
    const with10 = { ...s, hands: { ...s.hands, a: s.hands.a.slice(2) } };
    expect(callWhyNot(with11, "a", 1, {})).toBeNull();
    expect(callWhyNot(with10, "a", 1, {})).toMatch(/zu spät/);
    expect(callWhyNot(with10, "a", 2, {})).toBeNull();
    expect(callWhyNot({ ...s, hands: { ...s.hands, a: s.hands.a.slice(3) } }, "a", 2, {})).toMatch(/zu spät/);
  });
});

describe("Doppelkopf: Abrechnung", () => {
  const base = { seats: ["a", "b", "c", "d"], round: 1, contract: "normal" as const, soloist: null, silent: false, wedding: null };
  /** Stiche so, dass Re (a, b) genau `reAugen` hat (Sammelstiche – Sonderpunkte dabei aus) */
  const tricks = (reAugen: number): TrickRec[] => [{ plays: [], winner: "a", augen: reAugen }, { plays: [], winner: "c", augen: 240 - reAugen }];

  it("Grenzen: Re mit 121, Kontra mit 120; nur Kontra angesagt → Re schon mit 120", () => {
    expect(needOf({ re: 0, kontra: 0 }, "re")).toEqual({ augen: 121 });
    expect(needOf({ re: 0, kontra: 0 }, "kontra")).toEqual({ augen: 120 });
    expect(needOf({ re: 0, kontra: 1 }, "re")).toEqual({ augen: 120 });
    expect(needOf({ re: 0, kontra: 1 }, "kontra")).toEqual({ augen: 121 });
    expect(needOf({ re: 2, kontra: 0 }, "re")).toEqual({ augen: 151 });
    expect(needOf({ re: 2, kontra: 0 }, "kontra")).toEqual({ augen: 90 });
    expect(needOf({ re: 5, kontra: 0 }, "kontra")).toEqual({ one: true });
    expect(settle({ ...base, re: ["a", "b"], tricks: tricks(121), calls: { re: 0, kontra: 0 } }).winner).toBe("re");
    expect(settle({ ...base, re: ["a", "b"], tricks: tricks(120), calls: { re: 0, kontra: 0 } }).winner).toBe("kontra");
    expect(settle({ ...base, re: ["a", "b"], tricks: tricks(120), calls: { re: 0, kontra: 1 } }).winner).toBe("re");
  });

  it("Wertung: gewonnen, keine 90, Ansagen je 2, Absage, gegen die Alten", () => {
    const r = settle({ ...base, re: ["a", "b"], tricks: tricks(160), calls: { re: 2, kontra: 1 } }, false);
    expect(r.winner).toBe("re");
    expect(r.lines.map((l) => l.label)).toEqual(["Gewonnen", "Re angesagt", "Kontra angesagt", "Keine 90", "Keine 90 abgesagt"]);
    expect(r.value).toBe(1 + 2 + 2 + 1 + 1);
    expect(r.points).toEqual({ a: 7, b: 7, c: -7, d: -7 });
    const k = settle({ ...base, re: ["a", "b"], tricks: tricks(100), calls: { re: 0, kontra: 0 } }, false);
    expect(k.lines.map((l) => l.label)).toEqual(["Gewonnen", "Gegen die Alten"]);
    expect(k.points).toEqual({ a: -2, b: -2, c: 2, d: 2 });
    // Re sagt keine 90 ab und schafft nur 140: Kontra gewinnt mit 100
    expect(settle({ ...base, re: ["a", "b"], tricks: tricks(140), calls: { re: 2, kontra: 0 } }).winner).toBe("kontra");
  });

  it("Sonderpunkte: Doppelkopf, Fuchs gefangen, Karlchen – und Solo zählt dreifach ohne Sonderpunkte", () => {
    const ts: TrickRec[] = [
      T("c", [["a", "karo-A"], ["b", "karo-9"], ["c", "herz-10"], ["d", "kreuz-9"]]),
      T("a", [["a", "kreuz-A"], ["b", "kreuz-A"], ["c", "kreuz-10"], ["d", "kreuz-10"]]),
      { plays: [], winner: "a", augen: 240 - 21 - 42 - 4 - 2 },
      T("b", [["a", "karo-9"], ["b", "kreuz-B"], ["c", "pik-9"], ["d", "karo-B"]]),
    ];
    const r = settle({ ...base, re: ["a", "b"], tricks: ts, calls: { re: 0, kontra: 0 } });
    expect(r.winner).toBe("re");
    expect(r.lines.filter((l) => l.party === "kontra").map((l) => l.label)).toEqual(["Fuchs gefangen"]);
    expect(r.lines.filter((l) => l.party === "re").map((l) => l.label)).toEqual(expect.arrayContaining(["Gewonnen", "Doppelkopf", "Karlchen"]));
    expect(r.value).toBe(r.lines.filter((l) => l.party === "re").length - 1);
    const solo = settle({ ...base, contract: "dame", soloist: "a", re: ["a"], tricks: ts, calls: { re: 1, kontra: 0 } });
    expect(solo.lines.some((l) => ["Doppelkopf", "Fuchs gefangen", "Karlchen"].includes(l.label))).toBe(false);
    expect(solo.points.a).toBe(solo.value * 3);
    expect(solo.points.b).toBe(-solo.value);
    expect(Object.values(solo.points).reduce((t, x) => t + x, 0)).toBe(0);
  });
});

describe("Doppelkopf: Raum", () => {
  it("fehlende Plätze spielen Bots, Hände geheim, Aussteiger wird zum Bot", () => {
    let r = act(roomWith(["Anna", "Ben"], "doppelkopf"), { type: "selectGame", gameId: "doppelkopf" }, "p1");
    r = act(r, { type: "start" }, "p1");
    const s = r.game as DkState;
    expect(s.seats).toHaveLength(4);
    expect(s.ghosts).toHaveLength(2);
    expect(Object.values(s.hands).every((h) => h.length === 12)).toBe(true);
    const v = viewRoom(r, "p1").game as DkState;
    expect(Object.keys(v.hands)).toEqual(["p1"]);
    // bis ein Mensch dran ist, haben die Bots schon gesagt
    expect(s.ghosts.includes(s.curId!)).toBe(false);
    r = act(r, { type: "removePlayer", id: "p2" }, "p1");
    const after = r.game as DkState;
    expect(after.ghosts).toContain("p2");
    expect(after.curId).toBe("p1");
    // p1 spielt allein weiter bis zum Ende der Runde
    for (let i = 0; i < 100 && (r.game as DkState).phase !== "roundEnd"; i++) {
      const g = r.game as DkState;
      if (g.phase === "reserve") r = game(r, { type: "reserve", what: "gesund" }, "p1");
      else r = game(r, { type: "play", card: g.hands.p1.find((c) => doppelkopfCanPlay(g, c))! }, "p1");
    }
    const end = r.game as DkState;
    expect(end.phase).toBe("roundEnd");
    expect(Object.values(end.history[0].points).reduce((t, x) => t + x, 0)).toBe(0);
    expect(roomGame(r).isOver(r.game)).toBe(false);
  });

  it("Zugzeit: online läuft eine Frist, ist sie um, spielt die App", () => {
    let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"], "doppelkopf"), { type: "setOption", key: "think", value: "30" });
    r = act(r, { type: "start" }, "p1");
    const s = r.game as DkState;
    expect(s.deadline).not.toBeNull();
    const t = doppelkopf.apply(s, { type: "timeUp" }, { ...ctx({ think: "30" }, "p2"), players: r.players, now: s.deadline! + 10 });
    expect(t.said[s.curId!]).toBe("gesund");
    // zu früh: nichts passiert
    expect(doppelkopf.apply(s, { type: "timeUp" }, { ...ctx({ think: "30" }, "p2"), players: r.players, now: s.deadline! - 5000 })).toBe(s);
  });
});

function doppelkopfCanPlay(s: DkState, c: Card) {
  const lead = s.trick[0]?.card;
  if (!lead) return true;
  const k = keyOf(lead, s.contract);
  return keyOf(c, s.contract) === k || !s.hands[s.curId!].some((x) => keyOf(x, s.contract) === k);
}

describe("Doppelkopf: Ansagen aus der eigenen Sicht", () => {
  it("die nächste Ansage stimmt auch mit gefilterter Sicht (Re-Liste leer)", async () => {
    const { nextCall } = await import("@shared/games/doppelkopf/logic");
    let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"], "doppelkopf"), { type: "start" }, "p1");
    for (let i = 0; i < 4; i++) r = game(r, { type: "reserve", what: "gesund" }, (r.game as DkState).curId!);
    const s = r.game as DkState;
    if (s.contract !== "normal" || s.silent) return;
    const re = s.re[0];
    expect(nextCall(viewRoom(r, re).game as DkState, re, r.options)).toBe(1);
    r = game(r, { type: "call", level: 1 }, re);
    expect(nextCall(viewRoom(r, re).game as DkState, re, r.options)).toBe(2);
    const ko = s.seats.find((id) => !s.re.includes(id))!;
    expect(nextCall(viewRoom(r, ko).game as DkState, ko, r.options)).toBe(1);
  });
});
