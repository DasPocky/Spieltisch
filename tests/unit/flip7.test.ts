import { describe, expect, it } from "vitest";
import { bustOdds, buildDeck, flip7, linePoints, numValue, type F7Card, type F7State, type Line } from "@shared/games/flip7/logic";
import { playerLimits, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as F7State;
function start(n = 3, options: Record<string, unknown> = {}) {
  let r = roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n), "flip7");
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value: value as never });
  return act(r, { type: "start" });
}
/** Stapel so legen, dass als Nächstes `cards` gezogen werden (erste zuerst) */
function stack(r: RoomState, cards: F7Card[], lines?: Record<string, Partial<Line>>): RoomState {
  const s = g(r);
  const newLines = { ...s.lines };
  for (const [id, l] of Object.entries(lines ?? {})) newLines[id] = { nums: [], mods: [], second: false, status: "active", flip7: false, ...l };
  return { ...r, game: { ...s, deck: [...s.deck, ...cards.slice().reverse()], lines: newLines, pending: null, queued: [], dealQueue: [] } };
}
const line = (l: Partial<Line>): Line => ({ nums: [], mods: [], second: false, status: "active", flip7: false, ...l });

describe("Flip 7", () => {
  it("Kartenstapel: klassisch 94, Voll fies bis 13", () => {
    expect(buildDeck("classic")).toHaveLength(94);
    expect(buildDeck("fies").filter((c) => c === "n:13")).toHaveLength(13);
    expect(buildDeck("fies")).not.toContain("a:second");
  });

  it("3–18 Spieler", () => {
    const r = roomWith(["A", "B"], "flip7");
    expect(playerLimits(r)).toEqual({ min: 3, max: 18 });
    expect(() => act(r, { type: "start" })).toThrow(/mindestens 3/);
  });

  it("Punkte: Summe, ×2 vor Plus, Flip-7-Bonus, Niete = 0", () => {
    expect(linePoints(line({ nums: ["n:5", "n:12"], mods: ["m:x2", "m:+4"] }))).toBe(38);
    expect(linePoints(line({ nums: ["n:1", "n:2", "n:3", "n:4", "n:5", "n:6", "n:7"], flip7: true }))).toBe(28 + 15);
    expect(linePoints(line({ nums: ["n:9"], status: "bust" }))).toBe(0);
    expect(linePoints(line({ nums: ["n:9", "n:4"], mods: ["m:/2", "m:-8"] }))).toBe(0);
  });

  it("Austeilen: jeder bekommt eine Karte, dann ist jemand dran", () => {
    const s = g(start(3));
    const dealt = Object.values(s.lines).reduce((n, l) => n + l.nums.length + l.mods.length + (l.second ? 1 : 0), 0);
    // Ist die erste Karte eine Aktion, liegt noch nichts – dann wartet ein Ziel
    expect(dealt >= 1 || !!s.pending).toBe(true);
    expect(s.curId || s.pending).toBeTruthy();
  });

  it("Doppelte Zahl: raus; zweite Chance rettet", () => {
    let r = start(3);
    r = stack(r, ["n:5"], { p1: { nums: ["n:5"] }, p2: { nums: ["n:3"] }, p3: { nums: ["n:2"] } });
    r = { ...r, game: { ...g(r), curId: "p1" } };
    r = game(r, { type: "hit" });
    expect(g(r).lines.p1.status).toBe("bust");
    let q = start(3);
    q = stack(q, ["n:5"], { p1: { nums: ["n:5"], second: true }, p2: { nums: ["n:3"] }, p3: { nums: ["n:2"] } });
    q = { ...q, game: { ...g(q), curId: "p1" } };
    q = game(q, { type: "hit" });
    expect(g(q).lines.p1.status).toBe("active");
    expect(g(q).lines.p1.second).toBe(false);
  });

  it("Flip 7 beendet die Runde sofort mit +15", () => {
    let r = start(3);
    r = stack(r, ["n:7"], { p1: { nums: ["n:1", "n:2", "n:3", "n:4", "n:5", "n:6"] }, p2: { nums: ["n:9"] }, p3: { nums: ["n:8"] } });
    r = { ...r, game: { ...g(r), curId: "p1" } };
    r = game(r, { type: "hit" });
    expect(g(r).lastRound!.flip7).toBe("p1");
    expect(g(r).scores.p1).toBe(21 + 7 + 15);
    expect(g(r).round).toBe(2);
  });

  it("Einfrieren und Flip 3 mit Ziel", () => {
    let r = start(3);
    r = stack(r, ["a:freeze"], { p1: { nums: ["n:4"] }, p2: { nums: ["n:6"] }, p3: { nums: ["n:2"] } });
    r = { ...r, game: { ...g(r), curId: "p1" } };
    r = game(r, { type: "hit" });
    expect(g(r).pending).toMatchObject({ kind: "target", by: "p1" });
    r = game(r, { type: "target", target: "p2" });
    expect(g(r).lines.p2.status).toBe("frozen");

    let q = start(3);
    q = stack(q, ["a:flip3", "n:10", "n:11", "n:12"], { p1: { nums: ["n:4"] }, p2: { nums: ["n:6"] }, p3: { nums: ["n:2"] } });
    q = { ...q, game: { ...g(q), curId: "p1" } };
    q = game(game(q, { type: "hit" }), { type: "target", target: "p3" });
    expect(g(q).lines.p3.nums).toEqual(["n:2", "n:10", "n:11", "n:12"]);
  });

  it("Flip 7 mitten in Flip 3: zurückgelegte Aktion geht nicht verloren", () => {
    const count = (st: F7State) => st.deck.length + st.discard.length + (st.pending ? 1 : 0) + st.queued.length
      + Object.values(st.lines).reduce((t, l) => t + l.nums.length + l.mods.length + (l.second ? 1 : 0), 0);
    let q = start(3);
    const five: F7Card[] = ["n:1", "n:2", "n:3", "n:4", "n:5"];
    // Stapel aus dem vollen Deck bauen – ohne die Karten, die gleich auf dem Tisch liegen
    const deck = buildDeck("classic");
    for (const c of [...five, "a:flip3", "n:10", "a:freeze", "n:11"] as F7Card[]) deck.splice(deck.indexOf(c), 1);
    q = { ...q, game: { ...g(q), deck, discard: [] } };
    const total = 94;
    q = stack(q, ["a:flip3", "n:10", "a:freeze", "n:11"], { p1: {}, p2: {}, p3: { nums: five } });
    q = { ...q, game: { ...g(q), curId: "p1" } };
    expect(count(g(q))).toBe(total);
    q = game(game(q, { type: "hit" }), { type: "target", target: "p3" });
    expect(g(q).lastRound?.flip7).toBe("p3");
    expect(count(g(q))).toBe(total);
  });

  it("Spielende ab Spielziel, höchste Summe gewinnt", () => {
    let r = start(3, { target: 100 });
    r = stack(r, [], { p1: { nums: ["n:12"] }, p2: { nums: ["n:6"] }, p3: { nums: ["n:2"], status: "stayed" } });
    r = { ...r, game: { ...g(r), curId: "p1", scores: { p1: 95, p2: 10, p3: 0 } } };
    r = game(game(r, { type: "stay" }), { type: "stay" });
    expect(g(r).winners).toEqual(["p1"]);
  });

  it("Voll fies: Klauen, Minus verschenken, Glücks-13, Unglücks-7", () => {
    let r = start(3, { variant: "fies" });
    r = stack(r, ["a:steal"], { p1: { nums: ["n:4"] }, p2: { nums: ["n:9"] }, p3: { nums: ["n:2"] } });
    r = { ...r, game: { ...g(r), curId: "p1" } };
    r = game(game(r, { type: "hit" }), { type: "pick", owner: "p2", index: 0 });
    expect(g(r).lines.p1.nums).toContain("n:9");
    expect(g(r).lines.p2.nums).toEqual([]);

    let q = start(3, { variant: "fies" });
    q = stack(q, ["m:-6"], { p1: { nums: ["n:4"] }, p2: { nums: ["n:9"] }, p3: { nums: ["n:2"] } });
    q = { ...q, game: { ...g(q), curId: "p1" } };
    q = game(game(q, { type: "hit" }), { type: "target", target: "p3" });
    expect(g(q).lines.p3.mods).toContain("m:-6");

    let l = start(3, { variant: "fies" });
    l = stack(l, ["n:13"], { p1: { nums: ["n:13L"] }, p2: { nums: ["n:9"] }, p3: { nums: ["n:2"] } });
    l = { ...l, game: { ...g(l), curId: "p1" } };
    l = game(l, { type: "hit" });
    expect(g(l).lines.p1.status).toBe("active");

    let u = start(3, { variant: "fies" });
    u = stack(u, ["n:7U"], { p1: { nums: ["n:4", "n:10"], mods: ["m:x2"] }, p2: { nums: ["n:9"] }, p3: { nums: ["n:2"] } });
    u = { ...u, game: { ...g(u), curId: "p1" } };
    u = game(u, { type: "hit" });
    expect(g(u).lines.p1.nums).toEqual(["n:7U"]);
    expect(g(u).lines.p1.mods).toEqual([]);
  });

  it("Risiko-Hilfe: zählt die Karten im verdeckten Stapel richtig, ohne den Stapel zu kennen", () => {
    for (const variant of ["classic", "fies"]) {
      let r = start(3, { variant });
      let checked = 0;
      for (let i = 0; i < 150 && !g(r).winners.length; i++) {
        const s = g(r);
        const id = s.pending ? s.pending.by : s.curId;
        if (!id) break;
        if (!s.pending) {
          const odds = bustOdds(flip7.view!(s, id) as F7State, id);
          const l = s.lines[id];
          if (odds) {
            checked++;
            // Gegenprobe mit dem echten Stapel (der Server kennt ihn)
            const pool = s.deck.length ? s.deck : s.discard;
            expect(odds.total).toBe(pool.length);
            const one13 = l.nums.filter((c) => numValue(c) === 13).length === 1;
            expect(odds.bust).toBe(pool.filter((c) => c.startsWith("n:") && c !== "n:7U" && l.nums.some((x) => numValue(x) === numValue(c))
              && !(numValue(c) === 13 && one13 && (c === "n:13L" || l.nums.includes("n:13L")))).length);
          }
          r = game(r, { type: i % 4 === 3 ? "stay" : "hit" });
        } else if (s.pending.kind === "target") {
          // erstes erlaubtes Ziel
          const prev = r;
          for (const t of Object.keys(s.lines)) { try { r = game(prev, { type: "target", target: t }); break; } catch { /* nächstes */ } }
        } else if (s.pending.kind === "pickCard") {
          const by = s.pending.by, steal = s.pending.card === "a:steal";
          const owner = Object.keys(s.lines).find((x) => (!steal || x !== by) && s.lines[x].nums.length + s.lines[x].mods.length)!;
          r = game(r, { type: "pick", owner, index: 0 });
        } else {
          const [a, b] = Object.keys(s.lines).filter((x) => s.lines[x].nums.length);
          r = game(r, { type: "swap", a: { owner: a, index: 0 }, b: { owner: b, index: 0 } });
        }
      }
      expect(checked).toBeGreaterThan(5);
    }
  });

  it("Risiko-Hilfe: mit zweiter Chance oder ohne Zahlen keine Anzeige", () => {
    const r = start();
    const s = g(r);
    const id = Object.keys(s.lines)[0];
    expect(bustOdds({ ...s, lines: { ...s.lines, [id]: line({ nums: [], second: false }) } }, id)).toBeNull();
    expect(bustOdds({ ...s, lines: { ...s.lines, [id]: line({ nums: ["n:5"], second: true }) } }, id)).toBeNull();
  });
});
