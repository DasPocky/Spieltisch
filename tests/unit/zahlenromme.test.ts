import { describe, expect, it } from "vitest";
import {
  analyze, bestMelds, checkTable, FIRST, fullSet, handPoints, layOff, normalize, sortTiles, suggestPlay, zahlenromme,
  type Tile, type ZrState,
} from "@shared/games/zahlenromme/logic";
import { applyRoomAction, roomGame, skipLabel, viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { act, game, roomWith } from "./helpers";
import { narration } from "../../src/games/zahlenromme/narration";
import { zahlenrommeTable } from "../../src/games/zahlenromme/table";

const NAMES = ["Anna", "Ben", "Cem", "Dora"];
const g = (r: RoomState) => r.game as ZrState;
function start(n = 2, options: Record<string, string | number | boolean> = {}, online = false) {
  let r = act(roomWith(NAMES.slice(0, n)), { type: "selectGame", gameId: "zahlenromme" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" }, online ? "p1" : null);
}
interface Fix { hands?: Record<string, Tile[]>; table?: Tile[][]; pool?: Tile[]; melded?: Record<string, boolean>; curId?: string }
/** Lage fest vorgeben (p1 am Zug); fehlende Steine liegen nirgends */
function fix(r: RoomState, f: Fix): RoomState {
  const ids = r.players.map((p) => p.id);
  const hands = Object.fromEntries(ids.map((id) => [id, f.hands?.[id] ?? []]));
  const s: ZrState = {
    ...g(r), phase: "play", hands, table: f.table ?? [], pool: f.pool ?? ["s1a", "s2a", "s3a"], curId: f.curId ?? "p1",
    melded: Object.fromEntries(ids.map((id) => [id, f.melded?.[id] ?? false])), counts: Object.fromEntries(ids.map((id) => [id, hands[id].length])),
    poolCount: (f.pool ?? ["s1a", "s2a", "s3a"]).length, passes: 0, last: null, deadline: null,
  };
  return { ...r, game: s };
}
const commit = (r: RoomState, table: Tile[][]) => game(r, { type: "commit", table });

describe("Zahlen-Rommé: Kombinationen", () => {
  it("Reihen: mindestens drei aufeinanderfolgende einer Farbe, keine 1 nach der 13", () => {
    expect(analyze(["r3a", "r4a", "r5a"])?.kind).toBe("run");
    expect(analyze(["r5a", "r3a", "r4b"])?.tiles).toEqual(["r3a", "r4b", "r5a"]);
    expect(analyze(["r3a", "r4a"])).toBeNull();
    expect(analyze(["r3a", "r4a", "b5a"])).toBeNull();
    expect(analyze(["r3a", "r4a", "r6a"])).toBeNull();
    expect(analyze(["r12a", "r13a", "r1a"])).toBeNull();
    expect(analyze(["r3a", "r3b", "r4a"])).toBeNull();
    expect(analyze(fullSet(false).filter((t) => t.startsWith("r") && t.endsWith("a")))?.points).toBe(91);
  });

  it("Gruppen: drei oder vier gleiche Zahlen in verschiedenen Farben", () => {
    expect(analyze(["r7a", "b7a", "g7a"])?.kind).toBe("set");
    expect(analyze(["r7a", "b7a", "g7a", "s7a"])?.points).toBe(28);
    expect(analyze(["r7a", "r7b", "g7a"])).toBeNull();
    expect(analyze(["r7a", "b7a", "g7a", "s7a", "J1"])).toBeNull();
    expect(analyze(["r7a", "b8a", "g7a"])).toBeNull();
  });

  it("Joker vertritt jeden Stein: füllt Lücken, verlängert oben, sonst unten; als Gruppe die fehlende Farbe", () => {
    expect(analyze(["r3a", "J1", "r5a"])?.values).toEqual([3, 4, 5]);
    expect(analyze(["r5a", "r6a", "J1"])?.values).toEqual([5, 6, 7]);
    expect(analyze(["r12a", "r13a", "J1"])?.values).toEqual([11, 12, 13]);
    // so gelegt, bleibt der Joker vorn
    expect(analyze(["J1", "r5a", "r6a"])?.values).toEqual([4, 5, 6]);
    expect(analyze(["r9a", "b9a", "J2"])).toMatchObject({ kind: "set", points: 27 });
    expect(analyze(["r1a", "J1", "J2"])?.points).toBeGreaterThanOrEqual(6);
    expect(analyze(["r3a", "J1", "J2", "r7a"])).toBeNull();
    expect(normalize(["J1", "r3a", "r5a"])).toEqual(["r3a", "J1", "r5a"]);
  });

  it("Bank sortieren nach Farbe oder Zahl, Joker zuletzt", () => {
    const ts = ["s2a", "J1", "r9a", "r2a", "b2b"];
    expect(sortTiles(ts, "color")).toEqual(["r2a", "r9a", "b2b", "s2a", "J1"]);
    expect(sortTiles(ts, "num")).toEqual(["r2a", "b2b", "s2a", "r9a", "J1"]);
  });

  it("106 Steine (ohne Joker 104), jeder 14 auf der Bank", () => {
    expect(fullSet(true)).toHaveLength(106);
    expect(new Set(fullSet(true)).size).toBe(106);
    const s = g(start(4));
    for (const id of ["p1", "p2", "p3", "p4"]) expect(s.hands[id]).toHaveLength(14);
    expect(s.pool).toHaveLength(106 - 56);
    const nj = g(start(2, { joker: false }));
    expect(nj.pool.length + 28).toBe(104);
    expect([...nj.pool, ...Object.values(nj.hands).flat()].some((t) => t.startsWith("J"))).toBe(false);
  });
});

describe("Zahlen-Rommé: Züge prüfen", () => {
  it("Erstes Auslegen: mindestens 30 Punkte nur aus eigenen Steinen, Joker zählt als vertretener Wert", () => {
    let r = fix(start(2), { hands: { p1: ["r10a", "r11a", "r12a", "b1a", "b2a", "b3a", "J1", "s5a"], p2: ["g1a"] } });
    expect(() => commit(r, [["b1a", "b2a", "b3a"]])).toThrow(/30 Punkte \(jetzt 6\)/);
    // 9 + 10 + 11 (Joker als 9) = 30 – reicht
    const c = checkTable(g(r), "p1", [["J1", "r10a", "r11a"]]);
    expect(c).toMatchObject({ ok: true, points: 30 });
    r = commit(r, [["r10a", "r11a", "r12a"], ["b1a", "b2a", "b3a"]]);
    expect(g(r).melded.p1).toBe(true);
    expect(g(r).hands.p1.slice().sort()).toEqual(["J1", "s5a"]);
    expect(g(r).curId).toBe("p2");
    expect(g(r).last).toMatchObject({ kind: "commit", laid: 6, first: 39 });
  });

  it("Erstes Auslegen: den Tisch noch nicht umbauen, nicht an fremde Kombinationen anlegen", () => {
    const table = [["g4a", "g5a", "g6a"]];
    const r = fix(start(2), { table, hands: { p1: ["g7a", "r10a", "r11a", "r12a", "b10a", "s10a"] } });
    expect(() => commit(r, [["g4a", "g5a", "g6a", "g7a"], ["r10a", "r11a", "r12a"]])).toThrow(/noch nicht umbauen/);
    expect(() => commit(r, [["r10a", "r11a", "r12a"]])).toThrow(/nicht auf die Bank/);
    const ok = commit(r, [["g4a", "g5a", "g6a"], ["r10a", "r11a", "r12a"]]);
    expect(g(ok).table).toHaveLength(2);
  });

  it("Danach: Tisch umbauen – anlegen, teilen, verschieben, Joker austauschen und gleich wieder nutzen", () => {
    const table = [["r3a", "r4a", "r5a", "r6a", "r7a"], ["b8a", "g8a", "J1"]];
    const base = fix(start(2), { table, hands: { p1: ["r5b", "s8a", "s1a", "s2a", "s3a"] }, melded: { p1: true } });
    // Reihe teilen: 3-4-5 und 5-6-7
    let r = commit(base, [["r3a", "r4a", "r5a"], ["r5b", "r6a", "r7a"], ["b8a", "g8a", "J1"]]);
    expect(g(r).hands.p1).toHaveLength(4);
    // Joker gegen die echte 8 tauschen und gleich in einer neuen Reihe nutzen
    r = commit(base, [table[0], ["b8a", "g8a", "s8a"], ["s1a", "s2a", "J1"]]);
    expect(g(r).table).toContainEqual(["s1a", "s2a", "J1"]);
    expect(g(r).hands.p1.sort()).toEqual(["r5b", "s3a"].sort());
    // der Joker darf nicht auf die Bank
    expect(() => commit(base, [table[0], ["b8a", "g8a", "s8a"]])).toThrow(/nicht auf die Bank/);
  });

  it("Umbau ungültig: rot markiert, abgelehnt – nichts ändert sich; ohne eigenen Stein auch nicht", () => {
    const table = [["r3a", "r4a", "r5a"]];
    const r = fix(start(2), { table, hands: { p1: ["r6a", "b9a"] }, melded: { p1: true } });
    const c = checkTable(g(r), "p1", [["r3a", "r4a"], ["r5a", "r6a"]]);
    expect(c.ok).toBe(false);
    expect(c.bad).toEqual([0, 1]);
    expect(() => commit(r, [["r3a", "r4a"], ["r5a", "r6a"]])).toThrow(/ungültig/);
    expect(() => commit(r, table)).toThrow(/mindestens einen eigenen Stein/);
    expect(() => commit(r, [["r3a", "r4a", "r5a", "b9b"]])).toThrow(/nicht/);
    expect(() => commit(r, [["r3a", "r4a", "r5a", "r5a"]])).toThrow(/Ungültig/);
    expect(() => game(r, { type: "commit", table: "kaputt" })).toThrow(/Ungültig/);
    expect(() => commit(r, [["r3a", "r4a", "r5a", "r6a"]], )).not.toThrow();
  });

  it("Ziehen: ein Stein aus dem Pool, dann der Nächste; Pool leer: passen, alle passen → Runde vorbei", () => {
    let r = fix(start(2), { hands: { p1: ["r1a"], p2: ["b5a", "b6a"] }, pool: ["g9a"] });
    r = game(r, { type: "draw" });
    expect(g(r).hands.p1).toContain("g9a");
    expect(g(r).curId).toBe("p2");
    r = game(r, { type: "draw" });
    expect(g(r).last?.kind).toBe("pass");
    r = game(r, { type: "draw" });
    expect(g(r).phase).toBe("round");
    const res = g(r).rounds[0];
    // p1 hat 1 + 9 = 10, p2 11: p1 gewinnt mit 11 − 10
    expect(res).toMatchObject({ blocked: true, winner: "p1", points: { p1: 1, p2: -11 } });
  });
});

describe("Zahlen-Rommé: Wertung und Runden", () => {
  it("Wer keine Steine mehr hat, gewinnt die Runde: Verlierer minus ihre Summe (Joker 30), Gewinner plus die Summe", () => {
    let r = fix(start(3), { hands: { p1: ["r1a", "r2a", "r3a"], p2: ["b5a", "J1"], p3: ["g13a", "g12a"] }, melded: { p1: true } });
    r = commit(r, [["r1a", "r2a", "r3a"]]);
    const s = g(r);
    expect(s.phase).toBe("round");
    expect(s.rounds[0].points).toEqual({ p1: 35 + 25, p2: -35, p3: -25 });
    expect(s.scores).toEqual({ p1: 60, p2: -35, p3: -25 });
    expect(handPoints(["J1", "b5a"])).toBe(35);
    expect(skipLabel(r)).toBe("Nächste Runde starten");
    // nächste Runde: neu geben, der Nächste beginnt
    const before = s.starterId;
    r = game(r, { type: "next" });
    expect(g(r).round).toBe(2);
    expect(g(r).starterId).not.toBe(before);
    expect(g(r).hands.p1).toHaveLength(14);
    expect(g(r).table).toEqual([]);
    expect(g(r).scores.p1).toBe(60);
  });

  it("Partie bis: eine Runde (Paket „Kurz“) oder 200 Punkte", () => {
    let r = fix(start(2, { end: "1" }), { hands: { p1: ["r1a", "r2a", "r3a"], p2: ["b5a"] }, melded: { p1: true } });
    r = commit(r, [["r1a", "r2a", "r3a"]]);
    expect(g(r).phase).toBe("over");
    expect(roomGame(r).results!(g(r), { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 })).toEqual([
      { id: "p1", won: true, score: 5 }, { id: "p2", won: false, score: -5 },
    ]);
    let p = fix(start(2, { end: "p200" }), { hands: { p1: ["r1a", "r2a", "r3a"], p2: ["J1", "J2", "s13a", "s12a", "b13a", "b12a", "g13a", "g12a", "r13a", "r12a", "s11a", "b11a", "g11a", "r11a"] }, melded: { p1: true } });
    p = commit(p, [["r1a", "r2a", "r3a"]]);
    expect(g(p).scores.p1).toBeGreaterThanOrEqual(200);
    expect(g(p).phase).toBe("over");
  });

  it("Zeit um: der Entwurf zählt nicht, ein Stein wird gezogen – nur wenn die Zeit wirklich um ist", () => {
    let r = start(2, { think: "60" }, true);
    expect(g(r).deadline).not.toBeNull();
    const cur = g(r).curId!;
    const same = applyRoomAction(r, { type: "game", action: { type: "timeUp" } }, cur === "p1" ? "p2" : "p1");
    expect(g(same).n).toBe(g(r).n);
    r = { ...r, game: { ...g(r), deadline: Date.now() - 2000 } };
    r = applyRoomAction(r, { type: "game", action: { type: "timeUp" } }, "p2");
    expect(g(r).last).toMatchObject({ id: cur, kind: "time" });
    expect(g(r).curId).not.toBe(cur);
    // an einem Handy für alle ohne Zugzeit
    expect(g(start(2, { think: "60" })).deadline).toBeNull();
    expect(g(start(2, { think: "off" }, true)).deadline).toBeNull();
  });
});

describe("Zahlen-Rommé: Vorschläge", () => {
  it("findet das erste Auslegen mit genug Punkten (auch mit Joker) – sonst ziehen", () => {
    const hand = ["r10a", "r11a", "J1", "b2a", "g2a", "s2a", "s7a"];
    const best = bestMelds(hand, true);
    expect(best.points).toBeGreaterThanOrEqual(FIRST);
    const r = fix(start(2), { hands: { p1: hand } });
    const sug = suggestPlay(g(r), "p1")!;
    expect(checkTable(g(r), "p1", sug.table).ok).toBe(true);
    const poor = fix(start(2), { hands: { p1: ["r1a", "r2a", "r3a", "b9a"] } });
    expect(suggestPlay(g(poor), "p1")).toBeNull();
  });

  it("legt danach aus und an (teilt auch eine lange Reihe)", () => {
    const table = [["r3a", "r4a", "r5a", "r6a", "r7a"], ["b8a", "g8a", "s8a"]];
    const r = fix(start(2), { table, hands: { p1: ["r5b", "r8a", "b1a", "b2a", "b3a", "g11a"] }, melded: { p1: true } });
    const sug = suggestPlay(g(r), "p1")!;
    expect(checkTable(g(r), "p1", sug.table).ok).toBe(true);
    expect(sug.laid).toBe(5);
    const lo = layOff([["r3a", "r4a", "r5a", "r6a", "r7a"]], ["r5b"]);
    expect(lo.hand).toEqual([]);
    expect(lo.table).toHaveLength(2);
  });

  it("ist schnell, auch mit großer Bank", () => {
    const hand = fullSet(true).filter((_, i) => i % 3 === 0).slice(0, 34);
    const t = Date.now();
    for (let i = 0; i < 5; i++) bestMelds(hand, i % 2 === 0);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe("Zahlen-Rommé: Sicht, Aussteiger, nichts hängt", () => {
  it("online sieht jeder nur seine Bank, den Pool niemand, der Fernseher keine Bank", () => {
    const r = start(3, {}, true);
    const v = viewRoom(r, "p1").game as ZrState;
    expect(v.hands.p1).toHaveLength(14);
    expect(v.hands.p2).toBeUndefined();
    expect(v.pool).toEqual([]);
    expect(v.poolCount).toBe(106 - 42);
    const tv = viewRoom(r, WATCH_ID).game as ZrState;
    expect(Object.keys(tv.hands)).toEqual([]);
    const model = zahlenrommeTable({ ...r, game: tv });
    expect(model?.tiles?.groups).toEqual([]);
    expect(JSON.stringify(model)).not.toMatch(/"r\d+[ab]"/);
  });

  it("Host zieht für Abwesende; Aussteiger: Steine zurück in den Pool, allein endet die Partie", () => {
    let r = start(3, {}, true);
    const cur = g(r).curId!;
    expect(skipLabel(r)).toMatch(/einen Stein ziehen/);
    r = act(r, { type: "skip" }, "p1");
    expect(g(r).counts[cur]).toBe(15);
    // Aussteiger direkt über die Logik: der Nächste ist dran, seine Steine kommen zurück in den Pool
    const next = g(r).curId!;
    const pool = g(r).pool.length;
    const ctx = { players: r.players, hostId: "p1", actorId: null, options: r.options, now: 0 };
    let s = zahlenromme.onPlayerRemoved!(g(r), next, ctx);
    expect(s.pool.length).toBe(pool + 14);
    expect(s.curId).not.toBe(next);
    expect(s.hands[next]).toBeUndefined();
    expect(s.phase).toBe("play");
    const rest = r.players.filter((p) => p.id !== next);
    s = zahlenromme.onPlayerRemoved!(s, rest[0].id, { ...ctx, players: rest });
    expect(s.phase).toBe("over");
  });

  it("Vorlesen: Beginn, erstes Auslegen mit Punkten, Ziehen, Rundensieg", () => {
    const r0 = fix(start(2), { hands: { p1: ["r10a", "r11a", "r12a", "b13a"], p2: ["b1a"] } });
    const name = (id: string | null) => (id === "p1" ? "Anna" : "Ben");
    expect(narration(null, g(r0), name).join(" ")).toMatch(/Anna beginnt/);
    const r1 = commit(r0, [["r10a", "r11a", "r12a"]]);
    expect(narration(g(r0), g(r1), name).join(" ")).toMatch(/Anna legt zum ersten Mal aus – 33 Punkte/);
    const r2 = game(r1, { type: "draw" });
    expect(narration(g(r1), g(r2), name).join(" ")).toMatch(/Ben zieht/);
    const r3 = { ...r2, game: { ...g(r2), melded: { p1: true, p2: true }, hands: { p1: ["r13a"], p2: ["b1a", "g9a"] } } };
    const r4 = commit(r3, [["r10a", "r11a", "r12a", "r13a"]]);
    expect(narration(g(r3), g(r4), name).join(" ")).toMatch(/Anna gewinnt Runde 1/);
  });

  it("Regel-Pakete: Ohne Joker und Kurz", () => {
    expect(zahlenromme.presets?.map((p) => p.id)).toEqual(["ohneJoker", "kurz"]);
  });
});
