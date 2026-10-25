import { describe, expect, it } from "vitest";
import { erklaerspiel, seesWord, type ErkAction, type ErkState } from "@shared/games/erklaerspiel/logic";
import { activeCats, ALL_EXPLAINABLE, THEMES } from "@shared/games/erklaerspiel/themes";
import { CATEGORIES } from "@shared/games/stirnraten/cards";
import { currentPreset, presetValues } from "@shared/platform/presets";
import { kindOfGame } from "@shared/platform/cardsets";
import { WATCH_ID } from "@shared/platform/protocol";
import { GameError, type GameContext, type Options } from "@shared/platform/types";

const PLAYERS = ["Anna", "Ben", "Cem", "Dora", "Emil", "Fritz"].map((name, i) => ({ id: `p${i + 1}`, name }));
const T0 = 1_000_000;
const ctx = (o: Options = {}, now = T0, actorId: string | null = null, n = 4, extra: Partial<GameContext> = {}): GameContext =>
  ({ players: PLAYERS.slice(0, n), hostId: "p1", actorId, options: o, now, ...extra });
const run = (s: ErkState, a: ErkAction, c: GameContext) => erklaerspiel.apply(s, a, c);
const markN = (s: ErkState, rs: ("hit" | "pass")[], o: Options = {}, now = T0 + 1000) => rs.reduce((x, r) => run(x, { type: "mark", i: x.cards.length - 1, r }, ctx(o, now)), s);

describe("Erklärspiel", () => {
  it("Teams abwechselnd, Reihenfolge der Teams und Erklärer wechselt", () => {
    const o = { rounds: 2 };
    let s = erklaerspiel.setup(ctx(o, T0, null, 5));
    expect(s.teams).toEqual([["p1", "p3", "p5"], ["p2", "p4"]]);
    expect(s.turns).toBe(4);
    const seen: [number | null, string | null][] = [];
    for (let k = 0; k < 4; k++) {
      seen.push([s.team, s.explainer]);
      s = run(s, { type: "start" }, ctx(o));
      s = run(s, { type: "stop" }, ctx(o));
      s = run(s, { type: "confirm" }, ctx(o));
    }
    expect(seen).toEqual([[0, "p1"], [1, "p2"], [0, "p3"], [1, "p4"]]);
    expect(s.phase).toBe("over");
    // „Nochmal“: das andere Team beginnt
    expect(erklaerspiel.setup(ctx(o, T0, null, 4, { round: 1 })).team).toBe(1);
    // höchstens so viele Teams, dass jedes zwei hat
    expect(erklaerspiel.setup(ctx({ teams: 4 }, T0, null, 6)).teams.length).toBe(3);
  });

  it("Treffer, Überspringen (mit Minuspunkt), Rücknahme durch Gegner, Bestätigen", () => {
    const o = { minus: true };
    let s = erklaerspiel.setup(ctx(o));
    // Nur der Erklärer (oder Host) startet und tippt
    expect(() => run(s, { type: "start" }, ctx(o, T0, "p3"))).toThrow(GameError);
    s = run(s, { type: "start" }, ctx(o, T0, "p1"));
    expect(s.phase).toBe("play");
    expect(() => run(s, { type: "mark", i: 0, r: "hit" }, ctx(o, T0 + 500, "p3"))).toThrow(GameError);
    s = markN(s, ["hit", "hit", "pass", "hit"], o);
    // doppelte Meldung wird ignoriert
    expect(run(s, { type: "mark", i: 0, r: "hit" }, ctx(o, T0 + 1500, "p1"))).toBe(s);
    s = run(s, { type: "stop" }, ctx(o, T0 + 2000, "p1"));
    expect(s.phase).toBe("review");
    expect(s.cards.map((c) => c.r)).toEqual(["hit", "hit", "pass", "hit"]);
    // Teamkollege darf nichts zurücknehmen und nicht bestätigen, der Gegner schon
    expect(() => run(s, { type: "fix", i: 0 }, ctx(o, T0, "p3"))).toThrow(GameError);
    expect(() => run(s, { type: "confirm" }, ctx(o, T0, "p3"))).toThrow(GameError);
    // Gegner darf nicht nachtragen
    expect(() => run(s, { type: "fix", i: 2 }, ctx(o, T0, "p2"))).toThrow(GameError);
    s = run(s, { type: "fix", i: 0 }, ctx(o, T0, "p2"));
    expect(s.cards[0].r).toBe("pass");
    s = run(s, { type: "confirm" }, ctx(o, T0, "p4"));
    // 2 Treffer − 2 übersprungen
    expect(s.teamScores).toEqual([0, 0]);
    expect(s.last).toMatchObject({ hits: 2, passes: 2, points: 0 });
    expect(s.team).toBe(1);
    expect(s.explainer).toBe("p2");
  });

  it("Ohne Hausregel kostet Überspringen nichts; Begriffe wiederholen sich nicht", () => {
    let s = erklaerspiel.setup(ctx());
    s = run(s, { type: "start" }, ctx());
    s = markN(s, ["hit", "pass", "hit"]);
    const words = s.cards.map((c) => c.w);
    s = run(s, { type: "stop" }, ctx());
    s = run(s, { type: "confirm" }, ctx());
    expect(s.teamScores[0]).toBe(2);
    s = run(s, { type: "start" }, ctx());
    expect(words).not.toContain(s.cards[0].w);
  });

  it("Zeit läuft ab: zu früh zählt nicht, danach endet der Zug, die offene Karte zählt nicht", () => {
    const o = { seconds: 30 };
    let s = erklaerspiel.setup(ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    s = markN(s, ["hit"], o);
    expect(run(s, { type: "timeUp" }, ctx(o, T0 + 10_000, "p3"))).toBe(s);
    const late = run(s, { type: "mark", i: 1, r: "hit" }, ctx(o, T0 + 40_000, "p1"));
    expect(late.phase).toBe("review");
    expect(late.cards).toHaveLength(1);
    s = run(s, { type: "timeUp" }, ctx(o, T0 + 30_000, "p4"));
    expect(s.phase).toBe("review");
    expect(s.cards).toHaveLength(1);
  });

  it("Geheim: Begriff nur für den Erklärer und (Kontrolle) die Gegner – nie Team, Fernseher, Zuschauer", () => {
    let s = erklaerspiel.setup(ctx());
    s = run(s, { type: "start" }, ctx());
    const w = s.cards[0].w;
    expect(erklaerspiel.view!(s, "p1").cards[0].w).toBe(w);
    expect(erklaerspiel.view!(s, "p2").cards[0].w).toBe(w);
    expect(erklaerspiel.view!(s, "p3").cards[0].w).toBeUndefined();
    expect(erklaerspiel.view!(s, WATCH_ID).cards[0].w).toBeUndefined();
    expect(erklaerspiel.view!(s, "fremd").cards[0].w).toBeUndefined();
    expect(erklaerspiel.view!(s, "p1").pile).toEqual([]);
    expect(JSON.stringify(erklaerspiel.view!(s, WATCH_ID))).not.toContain(w);
    // Kontrolle aus: nur der Erklärer
    let t = erklaerspiel.setup(ctx({ control: false }));
    t = run(t, { type: "start" }, ctx({ control: false }));
    expect(seesWord(t, "p2")).toBe(false);
    // Nach dem Zug sehen alle die Liste
    s = run(s, { type: "stop" }, ctx());
    expect(erklaerspiel.view!(s, WATCH_ID).cards.map((c) => c.w)).toEqual([w].slice(0, s.cards.length));
  });

  it("Drei Runden: dieselben Begriffe, Übersprungene kommen zurück, Ende nach der Pantomime", () => {
    const o = { variant: "drei", words: 10 };
    let s = erklaerspiel.setup(ctx(o));
    expect(s.poolSize).toBe(10);
    expect(s.left).toBe(10);
    const pool = [...s.pool].sort();
    const styles: string[] = [];
    for (let k = 0; k < 40 && s.phase !== "over"; k++) {
      if (s.turn === s.stageTurn) styles.push(String(s.stage));
      s = run(s, { type: "start" }, ctx(o));
      // ein Begriff übersprungen, einer erraten – der übersprungene kommt wieder
      s = markN(s, ["pass", "hit"], o);
      s = run(s, { type: "stop" }, ctx(o));
      expect(s.cards.every((c) => pool.includes(c.w))).toBe(true);
      s = run(s, { type: "confirm" }, ctx(o));
      if (s.phase !== "over") expect([...s.pile].every((w) => pool.includes(w))).toBe(true);
    }
    expect(s.phase).toBe("over");
    expect(styles).toEqual(["0", "1", "2"]);
    // 3 Runden × 10 Begriffe, jeder erratene ein Punkt
    expect(s.teamScores[0] + s.teamScores[1]).toBe(30);
  });

  it("Drei Runden: zurückgenommener Treffer kommt wieder in den Topf", () => {
    const o = { variant: "drei", words: 10 };
    let s = erklaerspiel.setup(ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    s = markN(s, ["hit", "hit"], o);
    s = run(s, { type: "stop" }, ctx(o));
    const back = s.cards[0].w;
    s = run(s, { type: "fix", i: 0 }, ctx(o, T0, "p2"));
    s = run(s, { type: "confirm" }, ctx(o));
    expect(s.left).toBe(9);
    expect(s.pile).toContain(back);
    expect(s.teamScores[0]).toBe(1);
  });

  it("Pakete: Standard = Erklären, Pantomime, Drei Runden", () => {
    expect(currentPreset(erklaerspiel, {})).toBe("standard");
    const p = erklaerspiel.presets!.find((x) => x.id === "drei")!;
    expect(currentPreset(erklaerspiel, presetValues(erklaerspiel, p))).toBe("drei");
    const s = erklaerspiel.setup(ctx({ variant: "pantomime" }));
    expect(s.variant).toBe("pantomime");
  });

  it("Themen: Chips filtern, keine Lieder/Geräusche, alles aus heißt alles an; Kartensets wie Zeichnen & Raten", () => {
    expect(ALL_EXPLAINABLE.length).toBeLessThan(CATEGORIES.length);
    for (const t of THEMES) for (const c of t.cats) expect(CATEGORIES.some((x) => x.id === c), c).toBe(true);
    const only = Object.fromEntries(THEMES.map((t) => [`th_${t.id}`, t.id === "natur"]));
    expect(activeCats({ ...only, level: "familie" }).map((c) => c.id).sort()).toEqual(THEMES[0].cats.slice().sort());
    const none = Object.fromEntries(THEMES.map((t) => [`th_${t.id}`, false]));
    expect(activeCats({ ...none, level: "kinder" }).length).toBeGreaterThan(5);
    expect(activeCats({ level: "familie" }).some((c) => c.level === "ab18")).toBe(false);
    expect(kindOfGame("erklaerspiel")).toBe("zeichnen");
    const own = { sets: [{ id: "x", name: "Wir", data: { words: ["Opas Bart", "Unser Hund", "Tante Erna"] } }] };
    let s = erklaerspiel.setup(ctx({ own_only: true }, T0, null, 4, { content: own }));
    expect(s.ownOnly).toBe(true);
    s = run(s, { type: "start" }, ctx({ own_only: true }));
    expect(s.cards[0].w.startsWith("x:")).toBe(true);
  });

  it("Nichts hängt: Überspringen im Bereit-Zustand, Zug beenden, übernehmen; Erklärer geht", () => {
    let s = erklaerspiel.setup(ctx({}, T0, null, 5));
    expect(erklaerspiel.skipLabel!(s, ctx())).toBe("Jemand anderes erklärt");
    s = erklaerspiel.skipTurn!(s, ctx());
    expect(s.explainer).toBe("p3");
    expect(s.team).toBe(0);
    s = run(s, { type: "start" }, ctx());
    expect(erklaerspiel.skipLabel!(s, ctx())).toBe("Zug beenden");
    s = erklaerspiel.skipTurn!(s, ctx());
    expect(s.phase).toBe("review");
    s = erklaerspiel.skipTurn!(s, ctx());
    expect(s.team).toBe(1);
    // Erklärer geht während des Zugs: Zug fällt aus, nächstes Team
    s = run(s, { type: "start" }, ctx());
    const gone = s.explainer!;
    s = erklaerspiel.onPlayerRemoved!(s, gone, ctx({}, T0, null, 5));
    expect(s.phase).toBe("ready");
    expect(s.team).toBe(0);
    // ein Team leer → Ende
    let t = erklaerspiel.setup(ctx());
    t = erklaerspiel.onPlayerRemoved!(t, "p2", ctx());
    t = erklaerspiel.onPlayerRemoved!(t, "p4", ctx());
    expect(t.phase).toBe("over");
  });

  it("Ende und Ergebnis: Team mit den meisten Punkten gewinnt", () => {
    const o = { rounds: 1 };
    let s = erklaerspiel.setup(ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    s = markN(s, ["hit", "hit"], o);
    s = run(s, { type: "stop" }, ctx(o));
    s = run(s, { type: "confirm" }, ctx(o));
    s = run(s, { type: "start" }, ctx(o));
    s = markN(s, ["hit"], o);
    s = run(s, { type: "stop" }, ctx(o));
    s = run(s, { type: "confirm" }, ctx(o));
    expect(erklaerspiel.isOver(s)).toBe(true);
    const r = erklaerspiel.results!(s, ctx(o));
    expect(r.filter((x) => x.won).map((x) => x.id).sort()).toEqual(["p1", "p3"]);
  });
});
