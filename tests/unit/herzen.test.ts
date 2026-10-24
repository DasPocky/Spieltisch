import { describe, expect, it } from "vitest";
import type { Card } from "@shared/cards/deck";
import { cardPoints, deckFor, dirFor, herzen, passTarget, suggestCard, suggestPass, trickWinner, whyNot, type HzState } from "@shared/games/herzen/logic";
import { applyRoomAction, roomGame, skipLabel, viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";
import { narration } from "../../src/games/herzen/narration";

const g = (r: RoomState) => r.game as HzState;
function start(n = 4, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil", "Fritz"].slice(0, n)), { type: "selectGame", gameId: "herzen" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Hände fest vorgeben und sofort spielen */
function fix(r: RoomState, hands: Record<string, Card[]>, extra: Partial<HzState> = {}): RoomState {
  const s = g(r);
  const ids = Object.keys(hands);
  const curId = ids.find((id) => hands[id].includes("kreuz-2")) ?? ids[0];
  return { ...r, game: { ...s, hands, counts: Object.fromEntries(ids.map((id) => [id, hands[id].length])), phase: "play", curId, trick: [], trickNo: 0, heartsBroken: false,
    passing: Object.fromEntries(ids.map((id) => [id, null])), passIn: {}, received: {}, taken: Object.fromEntries(ids.map((id) => [id, 0])), tricks: Object.fromEntries(ids.map((id) => [id, 0])), ...extra } };
}
const play = (r: RoomState, card: Card) => game(r, { type: "play", card });

describe("Herzen", () => {
  it("Blatt: gleich viele Karten, Kreuz-2 und alle 26 Strafpunkte bleiben", () => {
    for (const n of [3, 4, 5, 6]) {
      const d = deckFor(n);
      expect(d.length % n).toBe(0);
      expect(d).toContain("kreuz-2");
      expect(d.reduce((t, c) => t + cardPoints(c), 0)).toBe(26);
    }
    expect(deckFor(4)).toHaveLength(52);
    const s = g(start(3));
    expect(Object.values(s.hands).map((h) => h.length)).toEqual([17, 17, 17]);
  });

  it("Weitergeben im Wechsel: links, rechts, gegenüber, keine (ungerade ohne gegenüber)", () => {
    expect([1, 2, 3, 4, 5].map((r) => dirFor(r, 4, {}))).toEqual(["left", "right", "across", "none", "left"]);
    expect([1, 2, 3, 4].map((r) => dirFor(r, 3, {}))).toEqual(["left", "right", "none", "left"]);
    expect(dirFor(3, 4, { pass: "left" })).toBe("left");
    expect(dirFor(1, 4, { pass: "none" })).toBe("none");
    const ps = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
    expect(passTarget(ps, "a", "left")).toBe("b");
    expect(passTarget(ps, "a", "right")).toBe("d");
    expect(passTarget(ps, "a", "across")).toBe("c");
  });

  it("Weitergeben: genau drei eigene Karten, erst wenn alle fertig sind, wird getauscht – fremde Wahl bleibt geheim", () => {
    let r = start(4);
    expect(g(r).phase).toBe("pass");
    const hand = (id: string) => g(r).hands[id];
    expect(() => game(r, { type: "pass", player: "p1", cards: hand("p1").slice(0, 2) })).toThrow(/drei/);
    expect(() => game(r, { type: "pass", player: "p1", cards: hand("p2").slice(0, 3) })).toThrow(/nicht/);
    expect(() => game(r, { type: "pass", cards: hand("p2").slice(0, 3) }, "p1")).toThrow(/nicht/);
    const give: Record<string, Card[]> = {};
    for (const id of ["p1", "p2", "p3"]) { give[id] = hand(id).slice(0, 3); r = game(r, { type: "pass", cards: give[id] }, id); }
    expect(() => game(r, { type: "pass", cards: give.p1 }, "p1")).toThrow(/schon/);
    // p2 sieht nur, dass p1 fertig ist – nicht welche Karten
    const v = viewRoom(r, "p2").game as HzState;
    expect(v.passIn.p1).toBe(true);
    expect(v.passing.p1).toBeNull();
    expect(Object.keys(v.hands)).toEqual(["p2"]);
    give.p4 = hand("p4").slice(-3);
    r = game(r, { type: "pass", cards: give.p4 }, "p4");
    const s = g(r);
    expect(s.phase).toBe("play");
    // links: p1 → p2, p4 → p1
    for (const c of give.p1) expect(s.hands.p2).toContain(c);
    expect(s.received.p1.sort()).toEqual(give.p4.slice().sort());
    expect(s.hands[s.curId!]).toContain("kreuz-2");
    expect(Object.values(s.hands).every((h) => h.length === 13)).toBe(true);
    expect((viewRoom(r, "p3").game as HzState).received).toEqual({ p3: s.received.p3 });
  });

  it("Kreuz-2 spielt aus, Farbe bedienen, im ersten Stich keine Punkte", () => {
    let r = fix(start(4), {
      p1: ["kreuz-2", "herz-5", "pik-3"], p2: ["kreuz-A", "herz-K", "karo-4"], p3: ["pik-D", "herz-2", "karo-9"], p4: ["kreuz-5", "herz-9", "pik-4"],
    });
    expect(() => play(r, "herz-5")).toThrow(/Kreuz-Zwei/);
    r = play(r, "kreuz-2");
    expect(() => play(r, "karo-4")).toThrow(/bedienen/);
    r = play(r, "kreuz-A");
    // p3 hat kein Kreuz: Pik-Dame und Herz sind im ersten Stich verboten, Karo geht
    expect(() => play(r, "pik-D")).toThrow(/ersten Stich/);
    expect(() => play(r, "herz-2")).toThrow(/ersten Stich/);
    r = play(r, "karo-9");
    r = play(r, "kreuz-5");
    expect(g(r).curId).toBe("p2");
    expect(g(r).lastTrick?.winner).toBe("p2");
    expect(g(r).trickNo).toBe(1);
  });

  it("Herz erst nach „Herz gebrochen“ – außer man hat nur noch Herz", () => {
    let r = fix(start(4), {
      p1: ["kreuz-2", "herz-5", "karo-3"], p2: ["kreuz-A", "herz-K", "karo-4"], p3: ["kreuz-3", "herz-2", "karo-9"], p4: ["kreuz-5", "herz-9", "pik-4"],
    });
    for (const c of ["kreuz-2", "kreuz-A", "kreuz-3", "kreuz-5"] as Card[]) r = play(r, c);
    expect(() => play(r, "herz-K")).toThrow(/gebrochen/);
    r = play(r, "karo-4");
    r = play(r, "karo-9");
    r = play(r, "pik-4");
    expect(g(r).heartsBroken).toBe(false);
    r = play(r, "karo-3");
    expect(g(r).curId).toBe("p3");
    // p3 führt mit Karo-9 – hat jetzt nur noch Herz: darf ausspielen
    expect(whyNot(g(r), g(r).hands.p3, "herz-2", {})).toBeNull();
    const only = fix(start(4), { p1: ["herz-3"], p2: ["herz-4"], p3: ["herz-5"], p4: ["herz-6"] }, { trickNo: 3, curId: "p1" });
    expect(whyNot(g(only), ["herz-3"], "herz-3", {})).toBeNull();
    expect(whyNot(g(only), ["herz-3", "karo-2"], "herz-3", {})).toMatch(/gebrochen/);
    const broken = fix(start(4), { p1: ["herz-3", "karo-2"], p2: ["herz-4"], p3: ["herz-5"], p4: ["herz-6"] }, { trickNo: 3, curId: "p1", heartsBroken: true });
    expect(whyNot(g(broken), ["herz-3", "karo-2"], "herz-3", {})).toBeNull();
  });

  it("Abwerfen bricht Herz, Strafpunkte gehen an den Stichgewinner", () => {
    let r = fix(start(4), {
      p1: ["kreuz-2", "karo-3"], p2: ["kreuz-A", "karo-4"], p3: ["karo-9", "herz-2"], p4: ["karo-5", "pik-D"],
    }, { trickNo: 1 });
    r = play(r, "kreuz-2");
    r = play(r, "kreuz-A");
    r = play(r, "herz-2");
    expect(g(r).heartsBroken).toBe(true);
    r = play(r, "pik-D");
    expect(g(r).taken.p2).toBe(14);
    expect(trickWinner([{ id: "a", card: "karo-2" }, { id: "b", card: "kreuz-A" }, { id: "c", card: "karo-K" }])).toBe("c");
  });

  it("Mond schießen: 0 für den Schützen, 26 für alle anderen – abschaltbar", () => {
    const hands: Record<string, Card[]> = { p1: ["kreuz-2"], p2: ["kreuz-3"], p3: ["kreuz-4"], p4: ["kreuz-5"] };
    const almost = { trickNo: 12, taken: { p1: 0, p2: 0, p3: 0, p4: 26 } };
    let r = fix(start(4), hands, almost);
    for (const c of ["kreuz-2", "kreuz-3", "kreuz-4", "kreuz-5"] as Card[]) r = play(r, c);
    let s = g(r);
    expect(s.phase).toBe("roundEnd");
    expect(s.history[0].moon).toBe("p4");
    expect(s.scores).toEqual({ p1: 26, p2: 26, p3: 26, p4: 0 });
    expect(narration(null, s, (id: string | null) => id ?? "")).toEqual([]);
    r = fix(start(4, { moon: false }), hands, almost);
    for (const c of ["kreuz-2", "kreuz-3", "kreuz-4", "kreuz-5"] as Card[]) r = play(r, c);
    s = g(r);
    expect(s.history[0].moon).toBeNull();
    expect(s.scores.p4).toBe(26);
  });

  it("Ende bei 100 Punkten (kurz: 50) – es gewinnt, wer am wenigsten hat", () => {
    const hands: Record<string, Card[]> = { p1: ["kreuz-2"], p2: ["kreuz-3"], p3: ["herz-4"], p4: ["kreuz-5"] };
    let r = fix(start(4), hands, { trickNo: 12, scores: { p1: 90, p2: 40, p3: 30, p4: 10 }, taken: { p1: 0, p2: 0, p3: 3, p4: 12 }, heartsBroken: true });
    for (const c of ["kreuz-2", "kreuz-3", "herz-4", "kreuz-5"] as Card[]) r = play(r, c);
    // p4 nimmt den letzten Stich: 12 + 1 = 13 Punkte, kein Mond → p4 hat 23, p1 bleibt unter 100
    expect(g(r).phase).toBe("roundEnd");
    r = game(r, { type: "nextRound" });
    expect(g(r).round).toBe(2);
    expect(g(r).dir).toBe("right");
    r = fix(r, hands, { trickNo: 12, scores: { p1: 99, p2: 40, p3: 30, p4: 10 }, taken: { p1: 0, p2: 0, p3: 0, p4: 0 }, heartsBroken: true });
    r = play(r, "kreuz-2"); r = play(r, "kreuz-3"); r = play(r, "herz-4"); r = play(r, "kreuz-5");
    // p4 nimmt mit der Kreuz-5: 1 Punkt
    expect(g(r).scores.p4).toBe(11);
    expect(g(r).phase).toBe("roundEnd");
    const res = herzen.results!({ ...g(r), phase: "over" }, { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.find((x) => x.won)?.id).toBe("p4");
    // kurz: 50
    expect(g(start(4, { target: "50" })).target).toBe(50);
    let k = fix(start(4, { target: "50" }), hands, { trickNo: 12, scores: { p1: 0, p2: 0, p3: 0, p4: 49 }, taken: { p1: 0, p2: 0, p3: 0, p4: 0 }, heartsBroken: true });
    for (const c of ["kreuz-2", "kreuz-3", "herz-4", "kreuz-5"] as Card[]) k = play(k, c);
    expect(roomGame(k).isOver(k.game)).toBe(true);
  });

  it("Nichts hängt: Host gibt für Fehlende weiter und spielt für Abwesende; Aussteiger → neu geben bzw. Ende", () => {
    let r = start(4);
    r = game(r, { type: "pass", cards: g(r).hands.p2.slice(0, 3) }, "p2");
    expect(skipLabel(r)).toMatch(/Anna, Cem, Dora/);
    r = applyRoomAction(r, { type: "skip" }, null);
    expect(g(r).phase).toBe("play");
    const cur = g(r).curId!;
    r = applyRoomAction(r, { type: "skip" }, null);
    expect(g(r).trick[0]).toEqual({ id: cur, card: "kreuz-2" });
    // Einer geht: zu dritt neu geben
    r = act(r, { type: "removePlayer", id: "p4" });
    expect(Object.values(g(r).hands).map((h) => h.length)).toEqual([17, 17, 17]);
    r = act(r, { type: "removePlayer", id: "p3" });
    expect(roomGame(r).isOver(r.game)).toBe(true);
  });

  it("Vorschläge: Pik-Dame weitergeben, unter dem Stich bleiben, Dame abwerfen", () => {
    expect(suggestPass(["pik-D", "kreuz-2", "herz-A", "karo-3", "pik-2"])).toContain("pik-D");
    const s = g(fix(start(4), { p1: ["kreuz-2"], p2: ["kreuz-K", "kreuz-3", "kreuz-A"], p3: ["pik-D", "karo-2"], p4: ["kreuz-4"] }, { trickNo: 2, heartsBroken: true }));
    const after = { ...s, trick: [{ id: "p1", card: "kreuz-9" as Card }] };
    expect(suggestCard(after, ["kreuz-K", "kreuz-3", "kreuz-A"], {})).toBe("kreuz-3");
    expect(suggestCard(after, ["pik-D", "karo-2"], {})).toBe("pik-D");
  });
});
