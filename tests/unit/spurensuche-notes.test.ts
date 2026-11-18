import { describe, expect, it } from "vitest";
import { spurensuche } from "@shared/games/spurensuche/logic";
import type { Player } from "@shared/platform/types";
import { between, DEFAULT_CARDS, emptyNotes, fromLists, infer, rowState, solutionOf, type Notes } from "../../src/games/spurensuche/notes";

const P = ["a", "b", "c", "d"];
const base = (): Notes => ({ ...emptyNotes("a"), mine: ["s:graefin", "w:gift", "r:turm"] });

describe("Spurensuche-Notizblock (echtes Brett)", () => {
  it("Eigene Karten: ich habe sie, die anderen nicht; alle übrigen habe ich nicht", () => {
    const auto = infer(base(), DEFAULT_CARDS, P);
    expect(auto["s:graefin"]).toEqual({ a: "y", b: "x", c: "x", d: "x" });
    expect(auto["s:doktor"].a).toBe("x");
    expect(rowState(auto, "s:graefin", P)).toBe("out");
  });
  it("Wer nichts zeigen konnte, hat keine der drei; die mir gezeigte Karte hat der Zeigende", () => {
    const n = base();
    n.log.push({ id: "1", by: "a", cards: ["s:doktor", "w:schal", "r:kaminhalle"], passed: ["b"], shower: "c", shown: "w:schal" });
    const auto = infer(n, DEFAULT_CARDS, P);
    expect(auto["s:doktor"].b).toBe("x");
    expect(auto["w:schal"].c).toBe("y");
    expect(auto["w:schal"].d).toBe("x");
    expect(rowState(auto, "w:schal", P)).toBe("out");
  });
  it("Gezeigt, aber zwei der drei sicher nicht → die dritte hat er", () => {
    const n = base();
    // d hat bei einem fremden Verdacht gezeigt (Karte unbekannt); von zweien weiß ich, dass d sie nicht hat
    n.log.push({ id: "1", by: "b", cards: ["s:graefin", "w:gift", "r:jagdzimmer"], passed: ["c"], shower: "d", shown: null });
    const auto = infer(n, DEFAULT_CARDS, P);
    // graefin und gift habe ich → d hat sie nicht → d hat jagdzimmer
    expect(auto["r:jagdzimmer"].d).toBe("y");
  });
  it("Keiner hat sie → Lösung; in einer Gruppe nur eine offen → ebenfalls Lösung", () => {
    const n = base();
    n.log.push({ id: "1", by: "a", cards: ["s:rosa", "w:stock", "r:weinkeller"], passed: ["b", "c", "d"], shower: null, shown: null });
    const auto = infer(n, DEFAULT_CARDS, P);
    expect(rowState(auto, "s:rosa", P)).toBe("solution");
    expect(solutionOf(DEFAULT_CARDS, auto, P).s).toBe("s:rosa");
  });
  it("Wer zwischen Fragendem und Zeigendem sitzt, konnte nichts zeigen", () => {
    expect(between(P, "b", "a")).toEqual(["c", "d"]);
    expect(between(P, "d", null)).toEqual(["a", "b", "c"]);
  });
  it("Spielweise echtes Brett: keine Karten, keine Züge, die Spielleitung beendet mit Sieger", () => {
    const players = ["Anna", "Ben", "Cem"].map((name, i) => ({ id: `p${i}`, name } as Player));
    const ctx = (actorId: string | null) => ({ players, hostId: "p0", actorId, options: { board: "real" }, now: 0 });
    let s = spurensuche.setup(ctx(null));
    expect(s.phase).toBe("notes");
    expect(Object.values(s.hands).flat()).toEqual([]);
    expect(spurensuche.currentPlayerId(s)).toBeNull();
    expect(spurensuche.skipLabel!(s, ctx(null))).toBeNull();
    expect(() => spurensuche.apply(s, { type: "roll" }, ctx(null))).toThrow();
    expect(spurensuche.actionKind({ type: "finish", winner: "p1" })).toBe("host");
    s = spurensuche.apply(s, { type: "finish", winner: "p1" }, ctx("p0"));
    expect(s.phase).toBe("over");
    expect(spurensuche.results!(s, ctx(null)).find((r) => r.won)?.id).toBe("p1");
  });
  it("Namen als Liste: eine Zeile je Karte, vorhandene Karten behalten ihre Kennung, leere Liste ändert nichts", () => {
    const rooms = "Arbeitszimmer\nHalle\nSalon\nBibliothek\nSpeisezimmer\nBillardzimmer\nWintergarten\nMusikzimmer\nKüche";
    const out = fromLists(DEFAULT_CARDS, { s: "", w: "Seil, Dolch", r: rooms }, 1);
    expect(out.filter((c) => c.group === "s")).toEqual(DEFAULT_CARDS.filter((c) => c.group === "s"));
    expect(out.filter((c) => c.group === "w").map((c) => c.name)).toEqual(["Seil", "Dolch"]);
    const r = out.filter((c) => c.group === "r");
    expect(r.map((c) => c.name)[0]).toBe("Arbeitszimmer");
    expect(r[0].id).toBe(DEFAULT_CARDS.find((c) => c.group === "r")!.id);
    expect(r).toHaveLength(9);
  });
});
