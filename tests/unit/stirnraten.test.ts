import { describe, expect, it } from "vitest";
import { CATEGORIES, CAT_BY_ID, catsUpTo, wordText } from "@shared/games/stirnraten/cards";
import { choosable, makeTeams, stirnraten, type StirnAction, type StirnState } from "@shared/games/stirnraten/logic";
import { WATCH_ID } from "@shared/platform/protocol";
import type { GameContext, Options } from "@shared/platform/types";

const PLAYERS = ["Anna", "Ben", "Cem", "Dora", "Emil"].map((name, i) => ({ id: `p${i + 1}`, name }));
const ctx = (o: Options = {}, now = 1_000_000, actorId: string | null = null, n = 3): GameContext => ({ players: PLAYERS.slice(0, n), hostId: "p1", actorId, options: o, now });
const run = (s: StirnState, a: StirnAction, c: GameContext) => stirnraten.apply(s, a, c);

describe("Stirnraten", () => {
  it("Begriffe: über 3000 in 50+ Kategorien, eindeutige Kennungen, keine leeren oder doppelten Begriffe je Kategorie", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(50);
    expect(CATEGORIES.reduce((t, c) => t + c.words.length, 0)).toBeGreaterThanOrEqual(3000);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) {
      expect(c.words.length, c.name).toBeGreaterThanOrEqual(40);
      expect(new Set(c.words).size, c.name).toBe(c.words.length);
      expect(c.words.every((w) => w.trim() === w && w.length > 0 && !w.includes(":")), c.name).toBe(true);
    }
    // Stufen bauen aufeinander auf
    expect(catsUpTo("kinder").every((c) => c.level === "kinder")).toBe(true);
    expect(catsUpTo("ab18").length).toBe(CATEGORIES.length);
  });

  it("Kategorien mit fester Darstellung nur, wenn die Art eingeschaltet ist", () => {
    const list = choosable({ level: "familie" }, []);
    expect(list).not.toContain("f-pantomime");
    expect(list).toContain("f-tiere");
    expect(choosable({ level: "familie", style_pantomime: true }, [])).toContain("f-pantomime");
    expect(choosable({ level: "kinder" }, ["Opa"])[0]).toBe("eigene");
  });

  it("Klassisch: Kategorie wählen, starten, kippen, Zeit um, korrigieren, Punkt für den Ratenden", () => {
    const o = { seconds: 60, rounds: 1 };
    let s = stirnraten.setup(ctx(o));
    expect(s.phase).toBe("pick");
    expect(s.guesser).toBe("p1");
    expect(s.turns).toBe(3);
    s = run(s, { type: "pick", cat: "f-tiere" }, ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    expect(s.phase).toBe("play");
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].w.startsWith("f-tiere:")).toBe(true);
    const t0 = s.startedAt!;
    s = run(s, { type: "mark", i: 0, r: "hit" }, ctx(o, t0 + 5000));
    // Doppelte Meldung derselben Karte zählt nicht
    expect(run(s, { type: "mark", i: 0, r: "hit" }, ctx(o, t0 + 5100))).toBe(s);
    s = run(s, { type: "mark", i: 1, r: "pass" }, ctx(o, t0 + 8000));
    s = run(s, { type: "mark", i: 2, r: "hit" }, ctx(o, t0 + 9000));
    // Zu früh: Zeit noch nicht um
    expect(run(s, { type: "timeUp" }, ctx(o, t0 + 30_000))).toBe(s);
    s = run(s, { type: "timeUp" }, ctx(o, t0 + 60_000));
    expect(s.phase).toBe("review");
    expect(s.cards.map((c) => c.r)).toEqual(["hit", "pass", "hit"]);
    s = run(s, { type: "fix", i: 1, r: "hit" }, ctx(o));
    s = run(s, { type: "confirm" }, ctx(o));
    expect(s.scores.p1).toBe(3);
    expect(s.guesser).toBe("p2");
    expect(s.used.length).toBe(3);
  });

  it("online: Nur der Ratende (oder Host) steuert; Fernseher und Zuschauer sehen den Begriff nicht, niemand den Stapel", () => {
    const o = { rounds: 1, catMode: "random" };
    let s = stirnraten.setup(ctx(o));
    expect(s.phase).toBe("ready");
    expect(() => run(s, { type: "start" }, ctx(o, 1, "p2"))).toThrow();
    s = run(s, { type: "start" }, ctx(o, 1, "p1"));
    const tv = stirnraten.view!(s, WATCH_ID);
    expect(tv.cards.at(-1)!.w).toBe("");
    expect(tv.deck).toEqual([]);
    const mate = stirnraten.view!(s, "p2");
    expect(mate.cards.at(-1)!.w).toBe(s.cards.at(-1)!.w);
    expect(mate.deck).toEqual([]);
  });

  it("Teams: abwechselnd verteilt, Punkte ans Team; offene Karte kann ein anderes Team holen", () => {
    expect(makeTeams(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "c", "e"], ["b", "d"]]);
    const o = { variant: "teams", teams: 2, rounds: 1, open: true, catMode: "mix" };
    let s = stirnraten.setup(ctx(o, 0, null, 4));
    expect(s.teams).toEqual([["p1", "p3"], ["p2", "p4"]]);
    expect(s.turns).toBe(2);
    s = run(s, { type: "start" }, ctx(o, 0, null, 4));
    for (let i = 0; i < 4; i++) s = run(s, { type: "mark", i, r: "hit" }, ctx(o, 1000 + i, null, 4));
    s = run(s, { type: "stop" }, ctx(o, 2000, "p3", 4));
    expect(s.phase).toBe("review");
    // Jede 4. Karte ist offen
    expect(s.cards[3].open).toBe(true);
    expect(() => run(s, { type: "fix", i: 0, team: 1 }, ctx(o, 0, null, 4))).toThrow();
    s = run(s, { type: "fix", i: 3, team: 1 }, ctx(o, 0, null, 4));
    s = run(s, { type: "confirm" }, ctx(o, 0, null, 4));
    expect(s.teamScores).toEqual([3, 1]);
    expect(s.team).toBe(1);
    expect(s.guesser).toBe("p2");
    const res = stirnraten.results!({ ...s, phase: "over" }, ctx(o, 0, null, 4));
    expect(res.find((r) => r.id === "p3")).toEqual({ id: "p3", won: true, score: 3 });
  });

  it("Bombe: Lunte geheim, Weitergeben geht reihum, Knall erst zur geheimen Zeit", () => {
    const o = { variant: "bombe", rounds: 1 };
    let s = stirnraten.setup(ctx(o));
    expect(s.phase).toBe("ready");
    s = run(s, { type: "start" }, ctx(o, 10_000));
    expect(s.phase).toBe("bomb");
    expect(s.boomAt).toBeGreaterThanOrEqual(10_000 + 25_000);
    expect(stirnraten.view!(s, "p2").boomAt).toBeNull();
    const first = s.holder;
    s = run(s, { type: "pass", n: 0 }, ctx(o, 12_000));
    expect(s.holder).not.toBe(first);
    expect(s.passes).toBe(1);
    // Veraltete Meldung (alte Nummer) zählt nicht
    expect(run(s, { type: "pass", n: 0 }, ctx(o, 12_100))).toBe(s);
    expect(run(s, { type: "tick" }, ctx(o, 12_500))).toBe(s);
    const holder = s.holder!;
    s = run(s, { type: "tick" }, ctx(o, s.boomAt!));
    expect(s.phase).toBe("over");
    expect(s.bombs[holder]).toBe(1);
    expect(stirnraten.results!(s, ctx(o)).find((r) => r.id === holder)!.won).toBe(false);
  });

  it("Hochstapler: kennt den Begriff nicht, die anderen wissen nicht, wer es ist; erwischt darf er raten", () => {
    const o = { variant: "hochstapler", rounds: 1 };
    let s = stirnraten.setup(ctx(o, 0, null, 4));
    const imp = s.impostor!;
    const other = s.order.find((id) => id !== imp)!;
    expect(stirnraten.view!(s, imp).word).toBeNull();
    expect(stirnraten.view!(s, other).word).toBe(s.word);
    expect(stirnraten.view!(s, other).impostor).toBeNull();
    expect(stirnraten.view!(s, WATCH_ID).word).toBeNull();
    expect(s.speakOrder[0]).not.toBe(imp);
    for (const id of s.order) s = run(s, { type: "seen", player: id }, ctx(o, 0, null, 4));
    expect(s.phase).toBe("talk");
    for (let i = 0; i < s.order.length * 2; i++) s = run(s, { type: "said" }, ctx(o, 0, null, 4));
    expect(s.phase).toBe("vote");
    // Online: alle stimmen für den Hochstapler (er selbst für jemand anderen)
    for (const id of s.order) s = run(s, { type: "vote", target: id === imp ? other : imp }, ctx(o, 0, id, 4));
    expect(s.phase).toBe("guess");
    expect(s.options).toContain(s.word);
    expect(s.options).toHaveLength(8);
    s = run(s, { type: "guess", word: s.word! }, ctx(o, 0, imp, 4));
    expect(s.phase).toBe("over");
    expect(s.result!.winner).toBe("impostor");
    expect(s.scores[imp]).toBe(1);
    expect(wordText(s.result!.word)).not.toBe("");
  });

  it("Nichts hängt: Ratender geht – nächster Zug; Host überspringt jede Phase", () => {
    const o = { rounds: 1 };
    let s = stirnraten.setup(ctx(o));
    s = run(s, { type: "pick", cat: "k-tiere" }, ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    s = stirnraten.onPlayerRemoved!(s, "p1", ctx(o));
    expect(s.guesser).toBe("p2");
    expect(s.order).not.toContain("p1");
    let guard = 0;
    while (s.phase !== "over" && guard++ < 50) s = stirnraten.skipTurn!(s, ctx(o));
    expect(s.phase).toBe("over");
    // Hochstapler verlässt das Spiel: neue Karten
    const h = { variant: "hochstapler", rounds: 2 };
    let t = stirnraten.setup(ctx(h, 0, null, 4));
    const imp = t.impostor!;
    t = stirnraten.onPlayerRemoved!(t, imp, ctx(h, 0, null, 4));
    expect(t.impostor).not.toBe(imp);
    expect(t.order).toHaveLength(3);
  });

  it("Eigene Begriffe: werden übernommen, doppelte und leere fallen weg", () => {
    const o = { rounds: 1 };
    let s = stirnraten.setup(ctx(o));
    s = run(s, { type: "custom", words: ["Opas Bart", " Opas  Bart ", "", "Unser Hund"] }, ctx(o));
    expect(s.custom).toEqual(["Opas Bart", "Unser Hund"]);
    s = run(s, { type: "pick", cat: "eigene" }, ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    expect(["Opas Bart", "Unser Hund"]).toContain(wordText(s.cards[0].w, s.custom));
    expect(CAT_BY_ID["k-lieder"].style).toBe("summen");
  });
});
