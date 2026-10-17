import { describe, expect, it } from "vitest";
import { schamlos, HAND, type SchamlosState } from "@shared/games/schamlos/logic";
import { blanksOf, cardText, deckFor, fillIn } from "@shared/games/schamlos/cards";
import type { GameContext } from "@shared/platform/types";

const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const ctx = (actorId: string | null = null, options = {}): GameContext => ({ players, hostId: "a", actorId, options: { tier: "alle", goal: 2, ...options }, now: 0, round: 0 });
const play = (s: SchamlosState, id: string) => schamlos.apply(s, { type: "play", cards: s.hands[id].slice(0, s.blanks) }, ctx(id));

describe("Schamlos", () => {
  it("Karten: jede Karte hat Text, schwarze Karten haben Lücken, höhere Stufen spielen die unteren mit", () => {
    for (const tier of ["alle", "ab18", "plus"] as const) {
      const d = deckFor(tier);
      for (const id of [...d.black, ...d.white]) expect(cardText(id), id).not.toBe("");
      for (const id of d.black) expect(cardText(id), id).toContain("___");
    }
    expect(deckFor("ab18").white.length).toBeGreaterThan(deckFor("alle").white.length);
    expect(deckFor("plus").black).toEqual(expect.arrayContaining(deckFor("ab18").black));
    expect(deckFor("alle").black.some((id) => id.startsWith("e-"))).toBe(false);
  });

  it("Lückentext: Antworten an der richtigen Stelle, am Satzanfang groß", () => {
    const two = deckFor("alle").black.find((id) => blanksOf(id) === 2)!;
    const parts = fillIn(two, ["a-w-0", "a-w-1"]);
    expect(parts.filter((p) => p.fill).map((p) => p.text)).toEqual([expect.stringMatching(/^S/), cardText("a-w-1")]);
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
