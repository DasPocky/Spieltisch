import { describe, expect, it } from "vitest";
import { schamlos, HAND, type SchamlosState } from "@shared/games/schamlos/logic";
import { ADULT_SETS, blanksOf, CHILD_RE, cardText, deckFor, fillIn, SETS } from "@shared/games/schamlos/cards";
import { setsOf } from "@shared/games/schamlos/logic";
import type { GameContext } from "@shared/platform/types";

const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const ctx = (actorId: string | null = null, options = {}): GameContext => ({ players, hostId: "a", actorId, options: { goal: 2, ...options }, now: 0, round: 0 });
const play = (s: SchamlosState, id: string) => schamlos.apply(s, { type: "play", cards: s.hands[id].slice(0, s.blanks) }, ctx(id));

describe("Schamlos", () => {
  it("Karten: jedes Set ist groß genug, jede Karte hat Text, schwarze Karten haben Lücken", () => {
    for (const set of SETS.map((s) => s.id)) {
      const d = deckFor([set]);
      expect(d.black.length, set).toBeGreaterThanOrEqual(40);
      expect(d.white.length, set).toBeGreaterThanOrEqual(150);
      for (const id of [...d.black, ...d.white]) expect(cardText(id), id).not.toBe("");
      for (const id of d.black) expect(cardText(id), id).toContain("___");
    }
  });

  it("Sex-Set: keine Karte mit Kinder-Bezug im Stapel, auch nicht aus gemischten Sets", () => {
    for (const adult of ADULT_SETS) {
      const d = deckFor(["frech", "schwarz", adult]);
      for (const id of [...d.black, ...d.white]) expect(CHILD_RE.test(cardText(id)), cardText(id)).toBe(false);
    }
    // Ohne Erwachsenen-Set bleiben harmlose Kinder-Karten drin
    expect(deckFor(["frech", "ab18"]).white.length).toBe(deckFor(["frech"]).white.length + deckFor(["ab18"]).white.length);
    expect(deckFor(["schwarz", "plus"]).white.length).toBeLessThan(deckFor(["schwarz"]).white.length + deckFor(["plus"]).white.length);
    expect(CHILD_RE.test("eine Erbschaft, die nur aus Schulden besteht")).toBe(false);
    expect(CHILD_RE.test("der Kindergeburtstag mit Punsch")).toBe(true);
    expect(CHILD_RE.test("Selling a kidney on a forum")).toBe(false);
  });

  it("Sets mischen: gewählte Sets zusammen, ohne Auswahl „Frech“", () => {
    expect(setsOf({})).toEqual(["frech"]);
    expect(setsOf({ set_frech: false, set_schwarz: true, set_plus: true })).toEqual(["plus", "schwarz"]);
    expect(setsOf({ set_frech: false })).toEqual(["frech"]);
    const mix = deckFor(["frech", "schwarz"]);
    expect(mix.white.length).toBe(deckFor(["frech"]).white.length + deckFor(["schwarz"]).white.length);
    expect(deckFor(["frech", "plus"]).white.length).toBeLessThan(deckFor(["frech"]).white.length + deckFor(["plus"]).white.length);
    expect(deckFor(["frech"]).black.every((id) => id.startsWith("frech-"))).toBe(true);
    expect(schamlos.setup(ctx(null, { set_frech: false, set_en: true })).blackPile.every((id) => id.startsWith("en-"))).toBe(true);
  });

  it("Lückentext: Antworten an der richtigen Stelle, am Satzanfang groß", () => {
    const two = deckFor(["frech"]).black.find((id) => blanksOf(id) === 2)!;
    const parts = fillIn(two, ["frech-w-0", "frech-w-1"]);
    expect(parts.filter((p) => p.fill).map((p) => p.text)).toHaveLength(2);
    // Lücke am Satzanfang: Antwort beginnt groß
    const first = deckFor(["frech", "ab18", "plus", "schwarz"]).black.find((id) => cardText(id).startsWith("___"));
    if (first) expect(fillIn(first, ["frech-w-0", "frech-w-1"])[0].text).toMatch(/^\p{Lu}/u);
  });

  it("Ablauf: alle außer dem Zar legen, dann wird gewählt, Punkt, nächster Zar mit vollen Händen", () => {
    let s = schamlos.setup(ctx());
    expect(s.czar).toBe("a");
    for (const p of players) expect(s.hands[p.id]).toHaveLength(HAND);
    expect(() => play(s, "a")).toThrow();
    s = play(s, "b"); s = play(s, "c");
    expect(s.phase).toBe("pick");
    expect(() => play(s, "b")).toThrow();
    s = play(s, "d");
    expect(s.phase).toBe("judge");
    expect(s.subs).toHaveLength(3);
    expect(() => schamlos.apply(s, { type: "choose", index: 0 }, ctx("b"))).toThrow();
    s = schamlos.apply(s, { type: "choose", index: 0 }, ctx("a"));
    expect(s.phase).toBe("result");
    expect(Object.values(s.scores).reduce((x, y) => x + y)).toBe(1);
    s = schamlos.apply(s, { type: "next" }, ctx("a"));
    expect(s.czar).toBe("b");
    for (const p of players) expect(s.hands[p.id]).toHaveLength(HAND);
  });

  it("Sicht: fremde Hände und gelegte Karten verdeckt, beim Wählen anonym", () => {
    let s = schamlos.setup(ctx());
    s = play(s, "b");
    const v = schamlos.view!(s, "c");
    expect(Object.keys(v.hands)).toEqual(["c"]);
    expect(v.played.b).toEqual([]);
    expect(v.whitePile).toEqual([]);
    s = play(play(s, "c"), "d");
    const j = schamlos.view!(s, "a");
    expect(j.subs.every((x) => x.by === "")).toBe(true);
    expect(schamlos.view!(s, "b").subs.filter((x) => x.by === "b")).toHaveLength(1);
  });

  it("Sieg bei Zielpunkten, Ergebnis für die Statistik", () => {
    let s = schamlos.setup(ctx());
    for (let r = 0; r < 20 && s.phase !== "over"; r++) {
      for (const p of players) if (p.id !== s.czar && s.phase === "pick") s = play(s, p.id);
      const i = s.subs.findIndex((x) => x.by === "b");
      s = schamlos.apply(s, { type: "choose", index: Math.max(0, i) }, ctx(null));
      if (s.phase === "result") s = schamlos.apply(s, { type: "next" }, ctx(null));
    }
    expect(s.phase).toBe("over");
    expect(schamlos.results!(s, ctx()).filter((r) => r.won)).toHaveLength(1);
  });

  it("Nichts hängt: Host deckt ohne Fehlende auf, wählt statt Zar, neue Karte wenn niemand legte", () => {
    let s = schamlos.setup(ctx());
    expect(schamlos.skipLabel!(s, ctx())).toBe("Neue Karte, neuer Zar");
    const fresh = schamlos.skipTurn!(s, ctx());
    expect(fresh.czar).toBe("b");
    s = play(s, "b");
    expect(schamlos.skipLabel!(s, ctx())).toMatch(/Ohne C, D aufdecken/);
    s = schamlos.skipTurn!(s, ctx());
    expect(s.phase).toBe("judge");
    s = schamlos.skipTurn!(s, ctx());
    expect(s.phase).toBe("result");
  });

  it("Spieler geht: als Zar beginnt eine neue Runde, sonst fehlt nur seine Antwort", () => {
    let s = schamlos.setup(ctx());
    s = play(play(s, "b"), "c");
    s = schamlos.onPlayerRemoved!(s, "d", ctx());
    expect(s.phase).toBe("judge");
    const t = schamlos.onPlayerRemoved!(schamlos.setup(ctx()), "a", ctx());
    expect(t.czar).toBe("b");
    expect(t.phase).toBe("pick");
  });
});
