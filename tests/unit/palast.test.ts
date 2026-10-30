import { describe, expect, it } from "vitest";
import type { Card } from "@shared/cards/deck";
import { cardsText, fits, legalMoves, palast, STALL_LIMIT, standings, suggestMove, suggestUp, topRun, type PalastState } from "@shared/games/palast/logic";
import { applyRoomAction, roomGame, skipLabel, viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { act, game, roomWith } from "./helpers";
import { narration } from "../../src/games/palast/narration";
import { palastTable } from "../../src/games/palast/table";

const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil", "Fritz", "Gabi", "Hans"];
const g = (r: RoomState) => r.game as PalastState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(NAMES.slice(0, n)), { type: "selectGame", gameId: "palast" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
interface Fix { hands?: Record<string, Card[]>; up?: Record<string, Card[]>; down?: Record<string, (Card | null)[]>; pile?: Card[]; discard?: Card[]; curId?: string }
/** Lage fest vorgeben (Spielphase, p1 am Zug); fehlende Karten bleiben leer */
function fix(r: RoomState, f: Fix): RoomState {
  const ids = r.players.map((p) => p.id);
  const per = <T,>(m: Record<string, T[]> | undefined) => Object.fromEntries(ids.map((id) => [id, m?.[id] ?? []]));
  const hands = per(f.hands), up = per(f.up), down = per(f.down);
  const s: PalastState = {
    ...g(r), phase: "play", hands, up, down, pile: f.pile ?? [], discard: f.discard ?? [], burned: [], curId: f.curId ?? "p1", out: [], guard: null, last: null,
    counts: Object.fromEntries(ids.map((id) => [id, hands[id].length])), downLeft: Object.fromEntries(ids.map((id) => [id, down[id].map((c) => c !== null)])), pileCount: (f.pile ?? []).length,
    ready: Object.fromEntries(ids.map((id) => [id, true])),
  };
  return { ...r, game: s };
}
const play = (r: RoomState, cards: Card[]) => game(r, { type: "play", cards });

describe("Palast", () => {
  it("Geben: je 3 verdeckt, 3 offen, 3 auf der Hand – ab 6 Spielern zwei Blätter", () => {
    const s = g(start(4));
    expect(s.phase).toBe("swap");
    for (const id of ["p1", "p2", "p3", "p4"]) {
      expect(s.hands[id]).toHaveLength(3);
      expect(s.up[id]).toHaveLength(3);
      expect(s.down[id]).toHaveLength(3);
    }
    expect(s.pile).toHaveLength(52 - 36);
    const six = g(start(6));
    expect(six.decks).toBe(2);
    expect(six.pile).toHaveLength(104 - 54);
  });

  it("Tauschen: nur eigene Hand- und offene Karten, erst wenn alle fertig sind, geht es los", () => {
    let r = start(3);
    const s = g(r);
    const newUp = [s.hands.p1[0], s.up.p1[1], s.up.p1[2]];
    r = game(r, { type: "arrange", up: newUp }, "p1");
    expect(g(r).up.p1.slice().sort()).toEqual(newUp.slice().sort());
    expect(g(r).hands.p1).toContain(s.up.p1[0]);
    expect(() => game(r, { type: "arrange", up: s.hands.p2 }, "p1")).toThrow(/nicht/);
    expect(() => game(r, { type: "arrange", up: newUp, player: "p2" }, "p1")).toThrow(/eigenen/);
    expect(() => game(r, { type: "arrange", up: newUp.slice(0, 2) }, "p1")).toThrow(/drei/);
    for (const id of ["p1", "p2"]) r = game(r, { type: "ready" }, id);
    expect(() => game(r, { type: "arrange", up: newUp }, "p1")).toThrow(/fertig/);
    expect(g(r).phase).toBe("swap");
    r = game(r, { type: "ready" }, "p3");
    expect(g(r).phase).toBe("play");
    // Wer nach dem Geber sitzt, beginnt
    expect(g(r).curId).toBe(roomGame(r).currentPlayerId(r.game));
    expect(() => game(r, { type: "arrange", up: newUp }, "p1")).toThrow(/vor dem Start/);
  });

  it("Paket „Schnell“: ohne Tauschen sofort los", () => {
    const s = g(start(3, { swap: false }));
    expect(s.phase).toBe("play");
    expect(s.curId).not.toBeNull();
  });

  it("Gleich hoch oder höher, mehrere gleiche zusammen; nachziehen auf drei", () => {
    let r = fix(start(2), { hands: { p1: ["herz-5", "pik-5", "kreuz-9"], p2: ["herz-4", "karo-K", "pik-3"] }, discard: ["karo-5"], pile: ["kreuz-A", "herz-B", "karo-3"] });
    expect(() => play(r, ["herz-5", "kreuz-9"])).toThrow(/gleiche/);
    expect(() => play(r, ["herz-6"])).toThrow(/nicht/);
    r = play(r, ["herz-5", "pik-5"]);
    expect(g(r).discard).toEqual(["karo-5", "herz-5", "pik-5"]);
    expect(g(r).hands.p1).toHaveLength(3);
    expect(g(r).pile).toHaveLength(1);
    expect(g(r).curId).toBe("p2");
    expect(() => play(r, ["herz-4"])).toThrow(/Fünf oder höher/);
    // Ben kann den König legen – aufnehmen geht nur, wenn nichts passt
    expect(() => game(r, { type: "take" })).toThrow(/nur, wenn nichts passt/);
  });

  it("Wer nicht kann, nimmt den ganzen Stapel auf", () => {
    let r = fix(start(2), { hands: { p1: ["herz-4", "pik-3"], p2: ["karo-K"] }, discard: ["karo-5", "herz-9"] });
    expect(legalMoves(g(r), "p1", {})).toEqual([{ type: "take" }]);
    r = game(r, { type: "take" });
    expect(g(r).hands.p1).toHaveLength(4);
    expect(g(r).discard).toEqual([]);
    expect(g(r).curId).toBe("p2");
    expect(g(r).last).toMatchObject({ kind: "take", took: 2 });
  });

  it("2 ist Neustart, 10 verbrennt (gleicher Spieler nochmal), vier gleiche verbrennen", () => {
    let r = fix(start(2), { hands: { p1: ["herz-2", "pik-10", "kreuz-4", "herz-4", "karo-9"], p2: ["karo-3", "herz-4", "pik-4"] }, discard: ["karo-A"] });
    expect(fits(g(r), "2", {})).toBe(true);
    expect(fits(g(r), "10", {})).toBe(true);
    expect(fits(g(r), "K", {})).toBe(false);
    r = play(r, ["herz-2"]);
    expect(g(r).curId).toBe("p2");
    expect(fits(g(r), "3", {})).toBe(true);
    r = play(r, ["herz-4", "pik-4"]);
    r = play(r, ["kreuz-4", "herz-4"]);
    // vier Vieren hintereinander: verbrannt, p1 legt noch einmal
    expect(g(r).discard).toEqual([]);
    expect(g(r).burned).toHaveLength(6);
    expect(g(r).last?.burn).toBe("four");
    expect(g(r).curId).toBe("p1");
    r = play(r, ["pik-10"]);
    expect(g(r).last?.burn).toBe("ten");
    expect(g(r).curId).toBe("p1");
    expect(topRun(["herz-4", "pik-5", "kreuz-5"])).toBe(2);
    expect([cardsText(["herz-B"]), cardsText(["pik-K"]), cardsText(["pik-A"]), cardsText(["karo-7", "herz-7"])]).toEqual(["einen Buben", "einen König", "ein Ass", "2× Sieben"]);
  });

  it("Hausregel „Vier gleiche“ aus: kein Verbrennen", () => {
    let r = fix(start(2, { four: false }), { hands: { p1: ["herz-4", "pik-4", "karo-9"], p2: ["karo-4", "kreuz-4", "karo-8"] }, discard: [] });
    r = play(r, ["herz-4", "pik-4"]);
    r = play(r, ["karo-4", "kreuz-4"]);
    expect(g(r).discard).toHaveLength(4);
    expect(g(r).curId).toBe("p1");
  });

  it("Sieben: der Nächste legt 7 oder niedriger – im Paket „Ohne Sieben“ normal", () => {
    let r = fix(start(2), { hands: { p1: ["herz-7", "pik-B"], p2: ["karo-K", "kreuz-6"] }, discard: ["karo-5"] });
    r = play(r, ["herz-7"]);
    expect(() => play(r, ["karo-K"])).toThrow(/Sieben nur 7 oder niedriger/);
    r = play(r, ["kreuz-6"]);
    expect(g(r).curId).toBe("p1");
    let o = fix(start(2, { seven: false }), { hands: { p1: ["herz-7", "pik-B"], p2: ["karo-K", "kreuz-6"] }, discard: [] });
    o = play(o, ["herz-7"]);
    expect(() => play(o, ["kreuz-6"])).toThrow(/Sieben oder höher/);
    o = play(o, ["karo-K"]);
    expect(g(o).curId).toBe("p1");
  });

  it("Tischkarten: erst offene, dann blind die verdeckten; passt die aufgedeckte nicht, Stapel aufnehmen", () => {
    let r = fix(start(2), { hands: { p2: ["karo-3"] }, up: { p1: ["herz-9", "pik-9", "kreuz-K"] }, down: { p1: ["herz-3", "pik-A", null] }, discard: ["karo-8"] });
    expect(() => game(r, { type: "blind", i: 0 })).toThrow(/Erst Hand/);
    r = play(r, ["herz-9", "pik-9"]);
    expect(g(r).up.p1).toEqual(["kreuz-K"]);
    expect(g(r).curId).toBe("p2");
    r = game(r, { type: "take" });
    r = play(r, ["kreuz-K"]);
    // offene sind weg: jetzt blind
    expect(() => play(r, ["karo-3"])).toThrow();
    r = game(r, { type: "take" }, null);
    expect(g(r).curId).toBe("p1");
    // die Ablage ist leer (Ben hat aufgenommen) – eine Drei passt blind
    expect(() => game(r, { type: "blind", i: 2 })).toThrow(/keine Karte/);
    r = game(r, { type: "blind", i: 0 });
    expect(g(r).discard).toEqual(["herz-3"]);
    expect(g(r).downLeft.p1).toEqual([false, true, false]);
    // Ben legt einen König, das Ass passt blind; dann ist Anna fertig
    r = play(r, ["kreuz-K"]);
    r = game(r, { type: "blind", i: 1 });
    expect(g(r).phase).toBe("over");
    expect(g(r).out).toEqual(["p1"]);
    expect(g(r).guard).toBe("p2");
    expect(standings(g(r), r.players).map((x) => x.id)).toEqual(["p1", "p2"]);
    const res = roomGame(r).results!(r.game, { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 });
    expect(res.find((x) => x.won)?.id).toBe("p1");
  });

  it("Blind daneben: Karte und Ablage auf die Hand", () => {
    let r = fix(start(2), { hands: { p2: ["karo-3"] }, down: { p1: ["herz-4", "pik-A", "kreuz-K"] }, discard: ["karo-8", "herz-9"] });
    r = game(r, { type: "blind", i: 0 });
    expect(g(r).hands.p1.slice().sort()).toEqual(["herz-4", "herz-9", "karo-8"]);
    expect(g(r).last).toMatchObject({ kind: "blindFail", took: 3 });
    expect(g(r).curId).toBe("p2");
  });

  it("Drei Spieler: wer fertig ist, wird übersprungen; der Letzte hält die Palastwache", () => {
    let r = fix(start(3), { hands: { p1: ["herz-5"], p2: ["karo-6", "pik-6"], p3: ["kreuz-7", "karo-2"] }, discard: [] });
    r = play(r, ["herz-5"]);
    expect(g(r).out).toEqual(["p1"]);
    expect(g(r).curId).toBe("p2");
    r = play(r, ["karo-6"]);
    r = play(r, ["kreuz-7"]);
    expect(g(r).curId).toBe("p2");
    r = play(r, ["pik-6"]);
    expect(g(r).phase).toBe("over");
    expect(standings(g(r), r.players).map((x) => [x.id, x.place, x.guard])).toEqual([["p1", 1, false], ["p2", 2, false], ["p3", 3, true]]);
  });

  it("Mit einer 10 fertig werden: der Nächste ist dran", () => {
    let r = fix(start(3), { hands: { p1: ["herz-10"], p2: ["karo-6"], p3: ["kreuz-7"] }, discard: ["pik-K"] });
    r = play(r, ["herz-10"]);
    expect(g(r).out).toEqual(["p1"]);
    expect(g(r).curId).toBe("p2");
  });

  it("Nichts hängt: wandert die Ablage zu lange ohne Fortschritt (Sieben reihum aufgenommen), wird sie verbrannt", () => {
    let r = fix(start(3), {
      hands: { p1: ["pik-7"], p2: ["karo-7"], p3: ["karo-K", "pik-K"] },
      up: { p1: ["kreuz-B", "karo-D"], p2: ["kreuz-8", "herz-9", "karo-B"] }, down: { p1: ["herz-3", "herz-4", "herz-5"], p2: ["pik-3", "pik-4", "pik-5"], p3: [] },
      curId: "p2",
    });
    let i = 0;
    for (; i < 3 * STALL_LIMIT && !g(r).burned.length; i++) r = game(r, suggestMove(g(r), g(r).curId!, {})!);
    expect(g(r).burned).toHaveLength(1);
    expect(g(r).last?.burn).toBe("stall");
    expect(i).toBeLessThanOrEqual(STALL_LIMIT + 1);
    expect(g(r).log).toContain("Die Ablage ist lange genug gewandert – sie wird verbrannt");
  });

  it("Geheim: nur die eigene Hand, verdeckte Karten und Stapel kennt niemand – auch der Fernseher nicht", () => {
    const r = start(4);
    const v = viewRoom(r, "p2").game as PalastState;
    expect(Object.keys(v.hands)).toEqual(["p2"]);
    expect(v.down).toEqual({});
    expect(v.pile).toEqual([]);
    expect(v.pileCount).toBe(16);
    expect(v.downLeft.p1).toEqual([true, true, true]);
    expect(v.up.p1).toHaveLength(3);
    const tv = viewRoom(r, WATCH_ID).game as PalastState;
    expect(tv.hands).toEqual({});
    expect(tv.down).toEqual({});
    const m = palastTable({ ...r, game: tv });
    expect(m?.counts.p1).toBe(3);
    expect(m?.boards?.p1.cells).toHaveLength(3);
  });

  it("Nichts hängt: Host meldet beim Tauschen für alle fertig und zieht für Abwesende", () => {
    let r = start(3);
    r = game(r, { type: "ready" }, "p1");
    expect(skipLabel(r)).toMatch(/Für Ben, Cem fertig melden/);
    r = applyRoomAction(r, { type: "skip" }, null);
    expect(g(r).phase).toBe("play");
    const cur = g(r).curId!;
    expect(skipLabel(r)).toMatch(/ziehen/);
    r = applyRoomAction(r, { type: "skip" }, null);
    expect(g(r).curId).not.toBe(cur);
    expect(g(r).n).toBe(1);
  });

  it("Aussteiger direkt über die Logik", () => {
    const r = fix(start(3), { hands: { p1: ["herz-5"], p2: ["karo-6"], p3: ["kreuz-7"] }, discard: [] });
    const ctx = { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 };
    let s = palast.onPlayerRemoved!(g(r), "p1", ctx);
    expect(s.curId).toBe("p2");
    expect(s.burned).toEqual(["herz-5"]);
    expect(s.phase).toBe("play");
    s = palast.onPlayerRemoved!(s, "p2", { ...ctx, players: r.players.filter((p) => p.id !== "p1") });
    expect(s.phase).toBe("over");
  });

  it("Vorschläge: starke Karten offen, niedrig legen, 2 und 10 aufheben", () => {
    expect(suggestUp(["herz-3", "pik-A", "karo-10"], ["kreuz-4", "herz-2", "pik-6"]).slice().sort()).toEqual(["herz-2", "karo-10", "pik-A"].sort());
    const r = fix(start(2), { hands: { p1: ["herz-2", "pik-10", "kreuz-6", "herz-6", "karo-K"] }, discard: ["karo-5"] });
    expect(suggestMove(g(r), "p1", {})).toEqual({ type: "play", cards: ["kreuz-6", "herz-6"] });
    const only = fix(start(2), { hands: { p1: ["herz-2", "pik-10", "kreuz-4"] }, discard: ["karo-A"] });
    expect(suggestMove(g(only), "p1", {})).toEqual({ type: "play", cards: ["herz-2"] });
    const none = fix(start(2), { hands: { p1: ["kreuz-4"] }, discard: ["karo-A"] });
    expect(suggestMove(g(none), "p1", {})).toEqual({ type: "take" });
  });

  it("Vorlesen: Tauschen, Beginn, Legen, Verbrennen, Aufnehmen, Sieger und Palastwache", () => {
    const name = (id: string | null) => ({ p1: "Anna", p2: "Ben", p3: "Cem" } as Record<string, string>)[id ?? ""] ?? "?";
    const r0 = start(3);
    expect(narration(null, g(r0), name).join(" ")).toMatch(/Tauscht jetzt/);
    let r = fix(start(2), { hands: { p1: ["herz-10", "pik-4"], p2: ["karo-3"] }, discard: ["karo-5"] });
    const a = g(r);
    r = play(r, ["herz-10"]);
    expect(narration(a, g(r), name).join(" ")).toBe("Anna legt eine Zehn. Die Zehn verbrennt den Stapel! Anna legt noch einmal.");
    const b = g(r);
    r = play(r, ["pik-4"]);
    expect(narration(b, g(r), name).join(" ")).toMatch(/Anna legt eine Vier\. Anna ist fertig – Platz 1\. Anna gewinnt\. Ben hält die Palastwache\./);
    let t = fix(start(2), { hands: { p1: ["pik-4"], p2: ["karo-3"] }, discard: ["karo-7", "herz-9"] });
    const c = g(t);
    t = game(t, { type: "take" });
    expect(narration(c, g(t), name)).toContain("Anna kann nicht und nimmt 2 Karten auf.");
    let sv = fix(start(2), { hands: { p1: ["herz-7", "pik-4"], p2: ["karo-3"] }, discard: [] });
    const d = g(sv);
    sv = play(sv, ["herz-7"]);
    expect(narration(d, g(sv), name)).toContain("Jetzt nur sieben oder niedriger.");
  });
});
