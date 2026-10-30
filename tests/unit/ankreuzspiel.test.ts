import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ankreuzspiel, colorOptions, idxOf, pendingWhite, suggestColor, suggestWhite, totalOf, tri, valueAt, whiteOptions, type AkSheet, type AkState,
} from "@shared/games/ankreuzspiel/logic";
import { applyRoomAction, roomGame, skipLabel, type RoomState } from "@shared/platform/room";
import { act, fixDice, game, roomWith } from "./helpers";
import { narration } from "../../src/games/ankreuzspiel/narration";
import { ankreuzspielTable } from "../../src/games/ankreuzspiel/table";

const g = (r: RoomState) => r.game as AkState;
function start(n = 3, options: Record<string, string | number | boolean> = {}, online = false) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "ankreuzspiel" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  if (online) r = act(r, { type: "setEntry", mode: "turn" });
  return act(r, { type: "start" }, online ? "p1" : null);
}
/** Würfeln mit festen Augen: weiß, weiß, rot, gelb, grün, blau */
function roll(r: RoomState, faces: number[], actor: string | null = null) {
  const spy = fixDice(faces);
  try { return game(r, { type: "roll" }, actor); } finally { spy.mockRestore(); }
}
/** Blatt mit diesen Feldern (je Reihe Indizes) */
const sheet = (rows: number[][], misses = 0, locks = [false, false, false, false]): AkSheet => ({ rows, locks, misses });
const withGame = (r: RoomState, patch: Partial<AkState>): RoomState => ({ ...r, game: { ...g(r), ...patch } });
const white = (r: RoomState, row: number | null, player?: string, actor: string | null = null) => game(r, { type: "white", row, ...(player ? { player } : {}) }, actor);
afterEach(() => vi.restoreAllMocks());

describe("Ankreuzspiel: Blatt und Punkte", () => {
  it("Rot/Gelb 2→12, Grün/Blau 12→2, Punkte nach Dreieckszahlen, −5 je Fehlwurf", () => {
    expect([0, 10].map((i) => valueAt(0, i))).toEqual([2, 12]);
    expect([0, 10].map((i) => valueAt(3, i))).toEqual([12, 2]);
    expect(idxOf(2, 12)).toBe(0);
    expect([1, 2, 3, 4, 5, 12].map(tri)).toEqual([1, 3, 6, 10, 15, 78]);
    // Rot 3 Kreuze (6), Gelb 5 + letztes Feld + Schloss = 7 Kreuze (28), ein Fehlwurf
    expect(totalOf(sheet([[0, 1, 2], [0, 1, 2, 3, 4, 10], [], []], 1, [false, true, false, false]))).toBe(6 + 28 - 5);
  });
});

describe("Ankreuzspiel: Zug", () => {
  it("Weiß für alle, dann Farbe für den Spieler am Zug – von links nach rechts", () => {
    let r = start(3);
    expect(g(r).curId).toBe("p1");
    expect(roomGame(r).currentPlayerId(g(r))).toBe("p1");
    r = roll(r, [3, 4, 2, 5, 6, 1]);
    expect(g(r).phase).toBe("white");
    // ein Handy für alle: reihum ab dem Spieler am Zug
    expect(pendingWhite(g(r))).toEqual(["p1", "p2", "p3"]);
    expect(roomGame(r).currentPlayerId(g(r))).toBe("p1");
    expect(whiteOptions(g(r), "p1").map((m) => m.row)).toEqual([0, 1, 2, 3]);
    r = white(r, 0, "p1"); // Rot 7
    expect(() => white(r, 0, "p1")).toThrow(/schon entschieden/);
    r = white(r, 2, "p2"); // Grün 7
    // noch nichts eingetragen, solange einer überlegt (gleichzeitig)
    expect(g(r).sheets.p1.rows[0]).toEqual([]);
    r = white(r, null, "p3");
    expect(g(r).phase).toBe("color");
    expect(g(r).sheets.p1.rows[0]).toEqual([idxOf(0, 7)]);
    expect(g(r).sheets.p2.rows[2]).toEqual([idxOf(2, 7)]);
    // Farbe: weiß 3/4 + rot 2 → 5 oder 6 liegen links von Rot 7 → nicht erlaubt; gelb 5 → 8 oder 9
    const opts = colorOptions(g(r), "p1");
    expect(opts.filter((m) => m.row === 0)).toEqual([]);
    expect(opts.filter((m) => m.row === 1).map((m) => m.n)).toEqual([8, 9]);
    expect(() => game(r, { type: "color", row: 0, n: 6 })).toThrow(/links nach rechts/);
    expect(() => game(r, { type: "color", row: 1, n: 10 })).toThrow(/weißen und den farbigen/);
    r = game(r, { type: "color", row: 1, n: 9 });
    expect(g(r).sheets.p1.rows[1]).toEqual([idxOf(1, 9)]);
    expect(g(r).sheets.p1.misses).toBe(0);
    expect(g(r).phase).toBe("roll");
    expect(g(r).curId).toBe("p2");
    expect(g(r).last?.marks.map((m) => [m.id, m.row, m.n])).toEqual([["p1", 0, 7], ["p2", 2, 7], ["p1", 1, 9]]);
  });

  it("Fehlwurf nur für den Spieler am Zug, wenn er gar nichts ankreuzt", () => {
    let r = start(2);
    r = roll(r, [1, 1, 1, 1, 1, 1]);
    r = white(r, null, "p1");
    r = white(r, 0, "p2");
    r = game(r, { type: "color", row: null });
    expect(g(r).sheets.p1.misses).toBe(1);
    expect(g(r).sheets.p2.misses).toBe(0);
    expect(g(r).last?.miss).toBe(true);
    // Weiß angekreuzt, Farbe verzichtet: kein Fehlwurf
    r = roll(r, [2, 2, 1, 1, 1, 1]);
    r = white(r, 0, "p2");
    r = white(r, null, "p1");
    r = game(r, { type: "color", row: null });
    expect(g(r).sheets.p2.misses).toBe(0);
  });

  it("Wer nichts ankreuzen kann, verzichtet automatisch – kann keiner etwas, ist der Zug sofort vorbei", () => {
    let r = start(2);
    // alle Reihen bis ans Ende angekreuzt (ohne letztes Feld), weniger als 5 Kreuze: nichts geht mehr
    const full = sheet([[9], [9], [9], [9]]);
    r = withGame(r, { sheets: { p1: full, p2: full } });
    r = roll(r, [6, 6, 6, 6, 6, 6]);
    expect(g(r).phase).toBe("roll");
    expect(g(r).curId).toBe("p2");
    expect(g(r).sheets.p1.misses).toBe(1);
  });

  it("Letztes Feld erst ab 5 Kreuzen – dann Schloss, Reihe für alle zu, ihr Würfel ist raus", () => {
    let r = start(2);
    r = withGame(r, { sheets: { p1: sheet([[0, 1, 2, 3], [], [], []]), p2: sheet([[0, 1, 2, 3, 4], [], [], []]) } });
    r = roll(r, [6, 6, 1, 1, 1, 1]);
    // Weiß 12: in Rot und Gelb das letzte Feld (Rot: erst 4 Kreuze, Gelb: keins), in Grün und Blau das erste
    expect(whiteOptions(g(r), "p1").map((m) => m.row)).toEqual([2, 3]);
    expect(() => white(r, 0, "p1")).toThrow(/ab 5 Kreuzen/);
    r = white(r, 2, "p1");
    r = white(r, 0, "p2");
    const s = g(r);
    expect(s.sheets.p2.locks[0]).toBe(true);
    expect(s.closed[0]).toBe(true);
    expect(totalOf(s.sheets.p2)).toBe(tri(7));
    // Farbe in Rot geht nicht mehr
    expect(colorOptions(s, "p1").some((m) => m.row === 0)).toBe(false);
    r = game(r, { type: "color", row: null });
    expect(g(r).last?.closed).toEqual([0]);
    r = roll(r, [3, 3, 5, 5, 5, 5], null);
    expect(g(r).dice[2]).toBe(0);
  });

  it("Zwei schließen dieselbe Reihe im selben Wurf ab – beide bekommen das Schloss", () => {
    let r = start(2);
    const five = sheet([[0, 1, 2, 3, 4], [], [], []]);
    r = withGame(r, { sheets: { p1: five, p2: five } });
    r = roll(r, [6, 6, 1, 1, 1, 1]);
    r = white(r, 0, "p1");
    r = white(r, 0, "p2");
    expect(g(r).sheets.p1.locks[0] && g(r).sheets.p2.locks[0]).toBe(true);
  });

  it("Ende bei zwei abgeschlossenen Reihen (auch mitten im Zug nach Weiß)", () => {
    let r = start(2);
    r = withGame(r, { closed: [false, true, false, false], sheets: { p1: sheet([[0, 1, 2, 3, 4], [], [], []]), p2: sheet([[], [], [], []]) } });
    r = roll(r, [6, 6, 1, 1, 1, 1]);
    r = white(r, 0, "p1");
    r = white(r, null, "p2");
    expect(g(r).phase).toBe("over");
    expect(g(r).endReason).toBe("closed");
    expect(roomGame(r).isOver(g(r))).toBe(true);
    const res = roomGame(r).results!(g(r), { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.find((x) => x.id === "p1")).toMatchObject({ won: true, score: tri(7) });
  });

  it("Ende beim vierten Fehlwurf; Paket „Kurz“: drei", () => {
    for (const [opts, limit] of [[{}, 4], [{ misses: "3", closeEnd: "1" }, 3]] as const) {
      let r = start(2, opts);
      r = withGame(r, { sheets: { p1: sheet([[], [], [], []], limit - 1), p2: sheet([[], [], [], []]) } });
      r = roll(r, [1, 1, 1, 1, 1, 1]);
      r = white(r, null, "p1");
      r = white(r, null, "p2");
      r = game(r, { type: "color", row: null });
      expect(g(r).phase).toBe("over");
      expect(g(r).endReason).toBe("misses");
    }
  });
});

describe("Ankreuzspiel: online gleichzeitig, nichts hängt", () => {
  it("Jeder kreuzt nur auf dem eigenen Blatt; Bedenkzeit um → wer überlegt, verzichtet", () => {
    let r = start(3, {}, true);
    expect(g(r).local).toBe(false);
    r = roll(r, [3, 4, 2, 5, 6, 1], "p1");
    expect(roomGame(r).currentPlayerId(g(r))).toBe(null);
    expect(g(r).deadline).not.toBeNull();
    expect(() => white(r, 0, "p1", "p2")).toThrow(/eigenen Blatt/);
    r = white(r, 0, undefined, "p2");
    // zu früh: nichts passiert
    expect(g(game(r, { type: "timeUp" }, "p3"))).toBe(g(r));
    r = withGame(r, { deadline: Date.now() - 5000 });
    r = game(r, { type: "timeUp" }, "p3");
    expect(g(r).phase).toBe("color");
    expect(g(r).sheets.p2.rows[0]).toEqual([idxOf(0, 7)]);
    // Farbe darf nur der Spieler am Zug
    expect(() => game(r, { type: "color", row: null }, "p2")).toThrow();
    r = game(r, { type: "color", row: null }, "p1");
    expect(g(r).sheets.p1.misses).toBe(1);
  });

  it("Host überspringt: würfeln, Weiß ohne die Wartenden, keine Farbe", () => {
    let r = start(3, {}, true);
    expect(skipLabel(r)).toMatch(/würfeln/);
    r = act(r, { type: "skip" }, "p1");
    expect(g(r).phase).toBe("white");
    r = white(r, null, undefined, "p1");
    expect(skipLabel(r)).toMatch(/Ohne Ben, Cem weiter/);
    r = act(r, { type: "skip" }, "p1");
    // p1 hat verzichtet – je nach Wurf Farbe oder schon Fehlwurf
    if (g(r).phase === "color") { expect(skipLabel(r)).toMatch(/keine Farbe/); r = act(r, { type: "skip" }, "p1"); }
    expect(g(r).phase).toBe("roll");
    expect(g(r).curId).toBe("p2");
  });

  it("Wer geht: Blatt weg, sein Zug fällt aus, Weiß wartet nicht auf ihn; allein endet die Partie", () => {
    let r = start(3, {}, true);
    r = roll(r, [3, 4, 2, 5, 6, 1], "p1");
    r = white(r, 0, undefined, "p1");
    r = white(r, 0, undefined, "p2");
    r = act(r, { type: "removePlayer", id: "p3" }, "p1");
    expect(g(r).sheets.p3).toBeUndefined();
    expect(g(r).phase).toBe("color");
    // wer dran ist, geht: der Nächste würfelt; allein endet die Partie
    const s0 = g(start(3, {}, true));
    const ctx = { players: [{ id: "p1", name: "Anna" }, { id: "p2", name: "Ben" }, { id: "p3", name: "Cem" }], hostId: "p1", actorId: "p1", options: {}, now: 0 };
    const s1 = ankreuzspiel.onPlayerRemoved!(s0, "p1", ctx);
    expect(s1.curId).toBe("p2");
    expect(s1.sheets.p1).toBeUndefined();
    const s2 = ankreuzspiel.onPlayerRemoved!(s1, "p2", { ...ctx, players: ctx.players.slice(1) });
    expect(s2.phase).toBe("over");
  });
});

describe("Ankreuzspiel: Spielhilfe, Vorlesen, Tisch", () => {
  it("Vorschlag: kein Feld überspringen, Schloss immer, Fehlwurf meiden", () => {
    let r = start(2);
    r = withGame(r, { sheets: { p1: sheet([[3], [], [], []]), p2: sheet([[0, 1, 2, 3, 4], [], [], []]) } });
    r = roll(r, [3, 3, 1, 1, 1, 1]);
    // weiß 6: Rot 6 liegt direkt hinter Rot 5 (Index 3 → 4)
    expect(suggestWhite(g(r), "p1")).toBe(0);
    r = white(r, 0, "p1");
    r = white(r, null, "p2");
    // Farbe: 3+1 = 4 überall weit hinten/vorn – mit Weiß-Kreuz lieber verzichten
    expect(suggestColor(g(r), "p1")).toBeNull();
    let q = start(2);
    q = withGame(q, { sheets: { p1: sheet([[], [], [], []]), p2: sheet([[0, 1, 2, 3, 4], [], [], []]) } });
    q = roll(q, [6, 6, 1, 1, 1, 1]);
    expect(suggestWhite(g(q), "p2")).toBe(0);
  });

  it("Vorlesen: Wurf, Kreuze, Fehlwurf, Schloss, Ende", () => {
    let r = start(2);
    const name = (id: string | null) => ({ p1: "Anna", p2: "Ben" })[id ?? ""] ?? "?";
    expect(narration(null, g(r), name)).toEqual(["Anna beginnt und würfelt."]);
    const b0 = g(r);
    r = roll(r, [3, 4, 2, 5, 6, 1]);
    expect(narration(b0, g(r), name).join(" ")).toContain("Anna würfelt. Weiß 3 und 4, zusammen 7 für alle.");
    r = white(r, null, "p1");
    const b1 = g(r);
    r = white(r, 0, "p2");
    expect(narration(b1, g(r), name).join(" ")).toContain("Anna darf noch eine Farbe nehmen.");
    const b2 = g(r);
    r = game(r, { type: "color", row: null });
    const said = narration(b2, g(r), name).join(" ");
    expect(said).toContain("Angekreuzt: Ben Rot 7.");
    expect(said).toContain("Anna hat einen Fehlwurf.");
    expect(said).toContain("Ben ist dran.");
  });

  it("Tisch: weiße und farbige Würfel, Notiz je Platz", () => {
    let r = start(2);
    r = roll(r, [3, 4, 2, 5, 6, 1]);
    const m = ankreuzspielTable(r)!;
    expect(m.dice?.values).toEqual([3, 4, 2, 5, 6, 1]);
    expect(m.dice?.tints?.length).toBe(6);
    expect(m.dice?.note).toContain("Weiß 7 für alle");
    expect(m.notes?.p1).toBe("0 Punkte · 0 Kreuze · 0 Fehlwürfe");
  });

  it("Ein Handy für alle: Bots kommen auch bei Weiß dran", () => {
    let r = start(2);
    r = roll(r, [3, 4, 2, 5, 6, 1]);
    r = white(r, null);
    expect(roomGame(r).currentPlayerId(g(r))).toBe("p2");
    expect(applyRoomAction(r, { type: "game", action: { type: "white", row: 0 } }, null)).toBeTruthy();
  });
});
