import { describe, expect, it } from "vitest";
import {
  bestClaim, cardsOf, DECK_SIZE, judgedTime, klingel, MAX_LAG, MIN_RT, newDeck, readyFruit, TURN_MS, WINDOW_MS,
  type KlAction, type KlState,
} from "@shared/games/klingel/logic";
import { botActions, botWait, REACT, ringPlan } from "@shared/games/klingel/bot";
import { botDelay, botPolls } from "@shared/platform/botSkill";
import { viewRoom } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import type { GameContext, Options } from "@shared/platform/types";
import { act, roomWith } from "./helpers";
import { narration } from "../../src/games/klingel/narration";
import { klingelTable } from "../../src/games/klingel/table";

const PLAYERS = [{ id: "a", name: "Anna" }, { id: "b", name: "Ben" }, { id: "c", name: "Cem" }];
const ctx = (now: number, actorId: string | null = "a", options: Options = {}, players = PLAYERS): GameContext =>
  ({ players, hostId: "a", actorId, options, now, round: 0 });
const start = (options: Options = {}, now = 1000, local = false) => klingel.setup(ctx(now, local ? null : "a", options));
const apply = (s: KlState, a: KlAction, now: number, actor: string | null = "a") => klingel.apply(s, a, ctx(now, actor));

/** Lage bauen: offene oberste Karten je Spieler, verdeckte Stapel gleichmäßig aus dem Rest */
function layout(tops: Record<string, string>, now = 1000, local = false): KlState {
  const s = structuredClone(start({}, now, local));
  const deck = newDeck();
  for (const c of Object.values(tops)) deck.splice(deck.indexOf(c), 1);
  for (const id of s.order) { s.open[id] = tops[id] ? [tops[id]] : []; s.stock[id] = []; }
  deck.forEach((c, i) => s.stock[s.order[i % s.order.length]].push(c));
  s.shownAt = now;
  s.at = now;
  return s;
}
const total = (s: KlState) => s.order.reduce((t, id) => t + cardsOf(s, id), 0);

describe("Klingel: Aufbau und Aufdecken", () => {
  it("56 Karten, gleichmäßig verteilt, der Startspieler deckt auf", () => {
    const s = start();
    expect(newDeck()).toHaveLength(DECK_SIZE);
    expect(DECK_SIZE).toBe(56);
    expect(total(s)).toBe(56);
    const sizes = s.order.map((id) => s.stock[id].length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(s.curId).toBe("a");
    expect(klingel.currentPlayerId(s)).toBe("a");
  });
  it("Aufdecken legt die oberste Karte offen, dann ist der Nächste dran", () => {
    const s0 = start();
    const top = s0.stock.a.at(-1)!;
    const s1 = apply(s0, { type: "flip" }, 2000);
    expect(s1.open.a).toEqual([top]);
    expect(s1.curId).toBe("b");
    expect(s1.seq).toBe(s0.seq + 1);
    expect(s1.shownAt).toBe(2000);
    expect(total(s1)).toBe(56);
  });
  it("genau fünf Früchte einer Sorte – nur die obersten Karten zählen", () => {
    expect(readyFruit(layout({ a: "banane-3", b: "banane-2", c: "erdbeere-4" }))).toBe("banane");
    expect(readyFruit(layout({ a: "banane-3", b: "banane-3", c: "erdbeere-4" }))).toBeNull();
    expect(readyFruit(layout({ a: "pflaume-5", b: "erdbeere-1" }))).toBe("pflaume");
    const s = layout({ a: "banane-3", b: "banane-2" });
    s.open.a = ["banane-2", "erdbeere-1"];
    expect(readyFruit(s)).toBeNull();
  });
  it("ohne Takt: nach der Wartezeit deckt die App selbst auf, vorher passiert nichts", () => {
    const s = start({}, 1000);
    expect(s.nextAt).toBe(1000 + TURN_MS);
    expect(apply(s, { type: "tick" }, 3000)).toBe(s);
    const t = apply(s, { type: "tick" }, 1000 + TURN_MS);
    expect(t.open.a).toHaveLength(1);
    expect(t.curId).toBe("b");
  });
  it("im Takt: Aufdecken nach dem Takt, nach einer Klingel mit Pause", () => {
    const s = start({ auto: true, pace: "schnell" }, 1000);
    const t = apply(s, { type: "tick" }, s.nextAt!);
    expect(t.open.a).toHaveLength(1);
    expect(t.nextAt).toBe(s.nextAt! + 1300);
  });
});

describe("Klingel: richtig und falsch klingeln", () => {
  it("lokal: richtig klingeln holt alle offenen Karten, der Gewinner deckt als Nächstes auf", () => {
    const s = layout({ a: "banane-3", b: "banane-2", c: "erdbeere-4" }, 1000, true);
    s.curId = "a";
    const t = apply(s, { type: "ring", seq: s.seq, rt: 500, player: "c" }, 1500, null);
    expect(t.ring).toBeNull();
    expect(t.last).toMatchObject({ by: "c", ok: true, cards: 3, fruit: "banane" });
    expect(s.order.every((id) => t.open[id].length === 0)).toBe(true);
    expect(t.stock.c.length).toBe(s.stock.c.length + 3);
    expect(t.curId).toBe("c");
    expect(total(t)).toBe(56);
  });
  it("falsch klingeln: an jeden Mitspieler eine Karte, zweimal auf derselben Lage geht nicht", () => {
    const s = layout({ a: "banane-3", b: "banane-3" });
    const t = apply(s, { type: "ring", seq: s.seq, rt: 400 }, 1600, "c");
    expect(t.last).toMatchObject({ by: "c", ok: false, cards: 2, to: ["a", "b"] });
    expect(t.stock.c.length).toBe(s.stock.c.length - 2);
    expect(t.stock.a.length).toBe(s.stock.a.length + 1);
    expect(total(t)).toBe(56);
    expect(() => apply(t, { type: "ring", seq: t.seq, rt: 400 }, 1700, "c")).toThrow(/schon falsch/);
  });
  it("wer keine Karten mehr hat, ist raus", () => {
    const s = layout({ a: "banane-3", b: "banane-3" });
    // Cem hat nur noch eine verdeckte Karte und klingelt falsch
    s.stock.a.push(...s.stock.c.slice(1));
    s.stock.c = s.stock.c.slice(0, 1);
    const t = apply(s, { type: "ring", seq: s.seq, rt: 400 }, 1600, "c");
    expect(t.last).toMatchObject({ by: "c", ok: false, cards: 1, out: ["c"] });
    expect(t.out).toEqual(["c"]);
    expect(total(t)).toBe(56);
    expect(t.phase).toBe("play");
  });
  it("Klingeln zu einer alten Lage zählt nicht", () => {
    const s = layout({ a: "banane-3", b: "banane-2" });
    expect(apply(s, { type: "ring", seq: s.seq - 1, rt: 300 }, 1500, "b")).toBe(s);
  });
  it("wer raus ist, kann nicht klingeln; unbekannte Spieler auch nicht", () => {
    const s = layout({ a: "banane-3", b: "banane-2" });
    s.out = ["c"];
    expect(() => apply(s, { type: "ring", seq: s.seq }, 1500, "c")).toThrow(/raus/);
    expect(() => apply(s, { type: "ring", seq: s.seq }, 1500, "x")).toThrow(/spielst nicht mit/);
    expect(() => klingel.apply(s, { type: "ring", seq: s.seq } as KlAction, ctx(1500, null))).toThrow(/spielst nicht mit/);
  });
});

describe("Klingel: Fairness beim Klingeln (online)", () => {
  it("Reaktionszeit: gemessen am Handy, aber nie unter MIN_RT, nie über der Serverzeit, höchstens MAX_LAG darunter", () => {
    expect(judgedTime(500, 650)).toBe(500);
    expect(judgedTime(20, 650)).toBe(650 - MAX_LAG);
    expect(judgedTime(20, 200)).toBe(MIN_RT);
    expect(judgedTime(5000, 650)).toBe(650);
    expect(judgedTime(-3, 90)).toBe(MIN_RT);
    expect(judgedTime(Number.NaN, 700)).toBe(700);
    expect(judgedTime("schnell", 700)).toBe(700);
  });
  it("Sammelfenster: wer später ankommt, aber schneller reagiert hat, gewinnt", () => {
    const s = layout({ a: "banane-3", b: "banane-2", c: "erdbeere-1" }, 1000);
    // Ben ist nah am Server (kommt zuerst an), Cem weit weg, hat aber schneller getippt
    const t1 = apply(s, { type: "ring", seq: s.seq, rt: 620 }, 1650, "b");
    expect(t1.ring?.until).toBe(1650 + WINDOW_MS);
    expect(t1.last).toBeNull();
    expect(() => apply(t1, { type: "flip" }, 1700, "a")).toThrow(/Klingel abwarten/);
    const t2 = apply(t1, { type: "ring", seq: s.seq, rt: 480 }, 1740, "c");
    expect(t2.ring?.claims.map((c) => c.id)).toEqual(["b", "c"]);
    // Fenster zu: Ticks davor ändern nichts, danach gewinnt Cem
    expect(apply(t2, { type: "tick" }, 1700, "a")).toBe(t2);
    const t3 = apply(t2, { type: "tick" }, 1650 + WINDOW_MS, "a");
    expect(t3.last).toMatchObject({ by: "c", ok: true, rt: 480, also: ["b"] });
    expect(t3.curId).toBe("c");
  });
  it("Schummeln lohnt nicht: eine unmöglich kleine Zeit, die spät ankommt, zählt höchstens MAX_LAG unter der Serverzeit", () => {
    const s = layout({ a: "banane-3", b: "banane-2", c: "erdbeere-1" }, 1000);
    const t1 = apply(s, { type: "ring", seq: s.seq, rt: 450 }, 1500, "b");
    const t2 = apply(t1, { type: "ring", seq: s.seq, rt: 1 }, 1640, "c");
    expect(t2.ring?.claims.find((c) => c.id === "c")?.rt).toBe(640 - MAX_LAG);
    const t3 = apply(t2, { type: "tick" }, 1700, "a");
    // 450 (Ben) gegen 240 (Cem, gekappt): mit der größten erlaubten Laufzeit wäre Cem schneller – mehr als MAX_LAG bringt Schummeln nie
    expect(t3.last?.by).toBe("c");
    // Und wer erst nach dem Fenster kommt, ist zu spät – das Fenster ist dann schon ausgewertet
    const t4 = apply(t1, { type: "ring", seq: s.seq, rt: 1 }, 1500 + WINDOW_MS + 5, "c");
    expect(t4.last?.by).toBe("b");
  });
  it("haben alle geklingelt, wird sofort ausgewertet; doppeltes Tippen zählt einmal", () => {
    const players = PLAYERS.slice(0, 2);
    let s = klingel.setup(ctx(1000, "a", {}, players));
    s = structuredClone(s);
    s.open = { a: ["birne-4"], b: ["birne-1"] };
    s.stock = { a: newDeck().slice(0, 27), b: newDeck().slice(27, 54) };
    const c2 = (now: number, actor: string) => ctx(now, actor, {}, players);
    const t1 = klingel.apply(s, { type: "ring", seq: s.seq, rt: 700 }, c2(1700, "a"));
    expect(klingel.apply(t1, { type: "ring", seq: s.seq, rt: 100 }, c2(1710, "a"))).toBe(t1);
    const t2 = klingel.apply(t1, { type: "ring", seq: s.seq, rt: 600 }, c2(1720, "b"));
    expect(t2.ring).toBeNull();
    expect(t2.last?.by).toBe("b");
  });
  it("gleiche Zeit und gleicher Eingang: das Los entscheidet (beide gewinnen mal)", () => {
    const wins = new Set<string>();
    for (let i = 0; i < 60; i++) wins.add(bestClaim([{ id: "a", rt: 300, at: 5 }, { id: "b", rt: 300, at: 5 }])!.id);
    expect(wins).toEqual(new Set(["a", "b"]));
    expect(bestClaim([{ id: "a", rt: 300, at: 9 }, { id: "b", rt: 300, at: 5 }])!.id).toBe("b");
    expect(bestClaim([])).toBeNull();
  });
});

describe("Klingel: Ende, Überspringen, Aussteigen", () => {
  it("Zeitlimit: danach gewinnt, wer die meisten Karten hat", () => {
    const s = start({ limit: "5" }, 1000);
    expect(s.limitAt).toBe(1000 + 5 * 60_000);
    const t = apply(s, { type: "tick" }, s.limitAt!);
    expect(t.phase).toBe("over");
    expect(t.timeUp).toBe(true);
    const best = Math.max(...s.order.map((id) => cardsOf(s, id)));
    expect(t.winners.every((id) => cardsOf(t, id) === best)).toBe(true);
    expect(klingel.results!(t, ctx(0))).toHaveLength(3);
  });
  it("ohne Zeitlimit kein Ende nach Zeit", () => {
    expect(start({ limit: "0" }).limitAt).toBeNull();
  });
  it("der Host überspringt: wertet die Klingel aus bzw. deckt für den auf, der dran ist", () => {
    const s = start();
    expect(klingel.skipLabel!(s, ctx(0))).toBe("Für Anna aufdecken");
    const t = klingel.skipTurn!(s, ctx(2000));
    expect(t.open.a).toHaveLength(1);
    const r = layout({ a: "banane-3", b: "banane-2" });
    const r1 = apply(r, { type: "ring", seq: r.seq, rt: 500 }, 1600, "b");
    expect(klingel.skipLabel!(r1, ctx(0))).toBe("Klingel auswerten");
    expect(klingel.skipTurn!(r1, ctx(1610)).last?.by).toBe("b");
  });
  it("wer aussteigt, wird übersprungen; bleibt einer übrig, gewinnt er", () => {
    const s = start();
    const t = klingel.onPlayerRemoved!(s, "a", ctx(2000));
    expect(t.curId).toBe("b");
    const u = klingel.onPlayerRemoved!(t, "b", ctx(2100));
    expect(u.phase).toBe("over");
    expect(u.winners).toEqual(["c"]);
  });
  it("hat niemand mehr verdeckte Karten, dreht jeder seinen offenen Stapel um", () => {
    const s = structuredClone(start());
    for (const id of s.order) { s.open[id] = [...s.open[id], ...s.stock[id]]; s.stock[id] = []; }
    s.stock.a = [s.open.a.shift()!];
    const t = apply(s, { type: "flip" }, 2000);
    expect(s.order.every((id) => t.stock[id].length > 0 || cardsOf(t, id) === 0)).toBe(true);
    expect(total(t)).toBe(56);
    expect(t.log.at(-1)).toMatch(/umdrehen|drehen/);
  });
});

describe("Klingel: Sicht, Tisch, Bots, Ansagen", () => {
  it("verdeckte Stapel sieht niemand, nur ihre Größe", () => {
    let r = roomWith(["Anna", "Ben", "Cem"], "klingel");
    r = act(r, { type: "start" }, "p1");
    for (const viewer of ["p1", WATCH_ID]) {
      const v = viewRoom(r, viewer).game as KlState;
      expect(Object.values(v.stock).flat().every((c) => c === "?")).toBe(true);
      expect(v.stock.p1.length).toBe((r.game as KlState).stock.p1.length);
    }
    const m = klingelTable(viewRoom(r, WATCH_ID))!;
    expect(Object.keys(m.bell!.tops)).toEqual(["p1", "p2", "p3"]);
    expect(m.turn).toBe("p1");
  });
  it("Bots: reagieren je Stufe verschieden schnell, klingeln erst nach ihrer Zeit", () => {
    const s = layout({ a: "banane-3", b: "banane-2" }, 1000);
    const fast = ringPlan(s, "c", "schwer")!;
    expect(fast).toBeGreaterThanOrEqual(REACT.schwer[0]);
    expect(fast).toBeLessThanOrEqual(REACT.schwer[1]);
    expect(botActions(s, "c", "schwer", 1000 + fast - 1).some((a) => a.type === "ring")).toBe(false);
    expect(botActions(s, "c", "schwer", 1000 + fast)).toContainEqual({ type: "ring", seq: s.seq, rt: fast });
    expect(REACT.leicht[0]).toBeGreaterThan(REACT.schwer[1]);
    expect(botWait(s, ["c"], { c: "schwer" }, 1000)).toBeLessThanOrEqual(fast);
  });
  it("Bots klingeln manchmal falsch – aber selten", () => {
    let fouls = 0;
    for (let i = 0; i < 2000; i++) {
      const s = layout({ a: "banane-3", b: "banane-3" });
      s.seq = i;
      if (ringPlan(s, "c", "mittel") !== null) fouls++;
    }
    expect(fouls).toBeGreaterThan(20);
    expect(fouls).toBeLessThan(140);
  });
  it("Server schaut für Bots nach, solange gespielt wird", () => {
    let r = roomWith(["Anna", "Ben"], "klingel");
    r = { ...r, bots: ["p2"] };
    r = act(r, { type: "start" }, "p1");
    expect(botPolls(r)).toBe(true);
    expect(botDelay(r)).toBeGreaterThan(0);
  });
  it("Ansagen: Regeln zum Start, wer klingelt, wer gewinnt", () => {
    const name = (id: string | null) => PLAYERS.find((p) => p.id === id)?.name ?? "?";
    const s = start({ limit: "10" });
    const intro = narration(null, s, name).join(" ");
    expect(intro).toContain("genau fünf Früchte");
    expect(intro).toContain("Nach 10 Minuten gewinnt");
    expect(intro).toContain("Anna fängt an.");
    const r = layout({ a: "banane-3", b: "banane-2" }, 1000, true);
    const t = apply(r, { type: "ring", seq: r.seq, rt: 500, player: "b" }, 1500, null);
    expect(narration(r, t, name).join(" ")).toContain("Ben war am schnellsten – fünf Bananen! 2 Karten für Ben.");
    const w = apply(t, { type: "ring", seq: t.seq, rt: 500, player: "a" }, 1600, null);
    expect(narration(t, w, name).join(" ")).toContain("Falsch geklingelt, Anna!");
  });
});
