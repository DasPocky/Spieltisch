import { describe, expect, it } from "vitest";
import { guessMatches, guessResult, questionResult, werbinich, type WbState } from "@shared/games/werbinich/logic";
import { KATEGORIEN } from "@shared/games/werbinich/figuren";
import { applyRoomAction, viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { presetValues } from "@shared/platform/presets";
import { GameError } from "@shared/platform/types";
import { act, game, roomWith } from "./helpers";

const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil"];
const g = (r: RoomState) => r.game as WbState;
function start(n = 3, options: Record<string, string | number | boolean> = {}, online = true) {
  let r = act(roomWith(NAMES.slice(0, n)), { type: "selectGame", gameId: "werbinich" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" }, online ? "p1" : null);
}
const at = (r: RoomState, now: number, a: Record<string, unknown> & { type: string }, actor: string | null) => {
  const spy = Date.now;
  Date.now = () => now;
  try { return applyRoomAction(r, { type: "game", action: a }, actor); } finally { Date.now = spy; }
};

describe("Wer bin ich", () => {
  it("Raten: Tippfehler und markanter Namensteil zählen, anderes nicht", () => {
    expect(guessMatches("Albert Einstein", "Albert Einstein")).toBe(true);
    expect(guessMatches("einstain", "Albert Einstein")).toBe(true);
    expect(guessMatches("Cleopatra", "Kleopatra")).toBe(true);
    expect(guessMatches("Bäckerin", "Bäcker")).toBe(true);
    expect(guessMatches("Löwe", "Tiger")).toBe(false);
    expect(guessMatches("der", "Karl der Große")).toBe(false);
    expect(guessMatches("", "Hund")).toBe(false);
  });

  it("Mehrheit: früh entschieden, Gleichstand Ja/Nein ist Weiß nicht, Raten braucht Mehrheit", () => {
    expect(questionResult({ ja: 2, nein: 0, egal: 0 }, 3)).toBe("ja");
    expect(questionResult({ ja: 1, nein: 0, egal: 0 }, 3)).toBe(null);
    expect(questionResult({ ja: 1, nein: 1, egal: 0 }, 2)).toBe("egal");
    expect(questionResult({ ja: 1, nein: 0, egal: 0 }, 3, true)).toBe("ja");
    expect(questionResult({ ja: 0, nein: 0, egal: 0 }, 3, true)).toBe("egal");
    expect(guessResult({ ja: 1, nein: 1, egal: 0 }, 2)).toBe("nein");
    expect(guessResult({ ja: 2, nein: 0, egal: 0 }, 3)).toBe("ja");
    expect(guessResult({ ja: 0, nein: 0, egal: 0 }, 3, true)).toBe("nein");
  });

  it("Figuren: jeder eine, keine doppelt, nur aus gewählten Kategorien; Kinder-Paket", () => {
    const r = start(5, { k_personen: false, k_berufe: false });
    const figs = Object.values(g(r).figures);
    expect(figs).toHaveLength(5);
    expect(new Set(figs).size).toBe(5);
    const allowed = new Set(KATEGORIEN.filter((k) => k.id === "tiere" || k.id === "maerchen").flatMap((k) => k.figuren));
    figs.forEach((f) => expect(allowed.has(f)).toBe(true));
    expect(presetValues(werbinich, werbinich.presets![0])).toMatchObject({ k_personen: false, k_berufe: false });
    expect(presetValues(werbinich, werbinich.presets![1])).toMatchObject({ perTurn: 1 });
  });

  it("Geheim: eigene Figur fehlt, andere sichtbar; Fernseher und Außenstehende sehen keine; Notizblock privat", () => {
    let r = start(3);
    const s = g(r);
    const anna = viewRoom(r, "p1").game as WbState;
    expect(anna.figures.p1).toBeUndefined();
    expect(anna.cats.p1).toBeUndefined();
    expect(anna.figures.p2).toBe(s.figures.p2);
    expect(JSON.stringify(anna)).not.toContain(s.figures.p1);
    for (const v of [WATCH_ID, "fremd"]) {
      const out = viewRoom(r, v).game as WbState;
      expect(out.figures).toEqual({});
      for (const id of s.order) expect(JSON.stringify(out)).not.toContain(s.figures[id]);
    }
    r = game(r, { type: "note", text: "geheime Idee" }, "p2");
    expect(JSON.stringify(viewRoom(r, "p1").game)).not.toContain("geheime Idee");
    expect((viewRoom(r, "p2").game as WbState).notes.p2[0].q).toBe("geheime Idee");
  });

  it("Frage: Ja → weiterfragen, Nein → Nächster; Notiz automatisch; nur Fragender fragt, nicht über sich abstimmen", () => {
    let r = start(3);
    expect(g(r).asker).toBe("p1");
    expect(() => game(r, { type: "ask" }, "p2")).toThrow(GameError);
    r = game(r, { type: "ask", text: "Bin ich ein Tier?" }, "p1");
    expect(g(r).phase).toBe("vote");
    expect(() => game(r, { type: "vote", a: "ja" }, "p1")).toThrow(GameError);
    r = game(r, { type: "vote", a: "ja" }, "p2");
    expect(g(r).phase).toBe("vote");
    r = game(r, { type: "vote", a: "ja" }, "p3");
    expect(g(r).phase).toBe("ask");
    expect(g(r).asker).toBe("p1");
    expect(g(r).notes.p1).toEqual([{ q: "Bin ich ein Tier?", a: "ja" }]);
    r = game(r, { type: "ask" }, "p1");
    r = game(r, { type: "vote", a: "nein" }, "p2");
    r = game(r, { type: "vote", a: "nein" }, "p3");
    expect(g(r).asker).toBe("p2");
    expect(g(r).notes.p1[1]).toEqual({ q: "Frage 2", a: "nein" });
  });

  it("Grenze je Zug und ohne Weiterfragen", () => {
    let r = start(3, { perTurn: 2 });
    for (let i = 0; i < 2; i++) { r = game(r, { type: "ask" }, "p1"); r = game(r, { type: "vote", a: "ja" }, "p2"); r = game(r, { type: "vote", a: "ja" }, "p3"); }
    expect(g(r).asker).toBe("p2");
    r = start(3, { follow: false });
    r = game(r, { type: "ask" }, "p1"); r = game(r, { type: "vote", a: "ja" }, "p2"); r = game(r, { type: "vote", a: "ja" }, "p3");
    expect(g(r).asker).toBe("p2");
  });

  it("Raten richtig (Punkte nach Reihenfolge), falsch (Nächster), Bestätigen durch die anderen; Ende und Auflösung", () => {
    let r = start(3);
    const f = g(r).figures;
    r = game(r, { type: "guess", text: f.p1 }, "p1");
    expect(g(r).solved).toEqual(["p1"]);
    expect(g(r).scores.p1).toBe(3);
    expect(g(r).asker).toBe("p2");
    // nach dem Erraten sieht man die eigene Figur
    expect((viewRoom(r, "p1").game as WbState).figures.p1).toBe(f.p1);
    // falsch getippt → die anderen prüfen, Gleichstand ist falsch
    r = game(r, { type: "guess", text: "Quatsch" }, "p2");
    expect(g(r).phase).toBe("guess");
    r = game(r, { type: "vote", a: "nein" }, "p1");
    expect(g(r).phase).toBe("ask");
    expect(g(r).asker).toBe("p3");
    expect(g(r).last).toMatchObject({ kind: "raten", result: "nein" });
    // laut geraten, die anderen bestätigen (auch wer schon erraten hat, stimmt mit)
    r = game(r, { type: "guess" }, "p3");
    r = game(r, { type: "vote", a: "ja" }, "p1");
    r = game(r, { type: "vote", a: "ja" }, "p2");
    expect(g(r).scores.p3).toBe(2);
    expect(g(r).asker).toBe("p2");
    r = game(r, { type: "guess", text: f.p2 }, "p2");
    expect(g(r).phase).toBe("over");
    expect(g(r).scores.p2).toBe(1);
    expect((viewRoom(r, WATCH_ID).game as WbState).figures).toEqual(f);
    expect(werbinich.results!(g(r), {} as never).find((x) => x.won)?.id).toBe("p1");
  });

  it("Fragerunden-Grenze beendet das Spiel", () => {
    let r = start(3, { laps: 3 });
    for (let i = 0; i < 9; i++) r = game(r, { type: "pass" }, g(r).asker);
    expect(g(r).phase).toBe("over");
    expect(g(r).lap).toBe(3);
  });

  it("Nichts hängt: Zeit um, Host setzt Antwort, Überspringen, Aussteiger", () => {
    let r = start(4);
    const t0 = Date.now();
    r = at(r, t0, { type: "ask" }, "p1");
    r = at(r, t0 + 1000, { type: "vote", a: "ja" }, "p2");
    expect(() => at(r, t0 + 5000, { type: "timeUp" }, "p2")).toThrow(GameError);
    r = at(r, t0 + 31_000, { type: "timeUp" }, "p3");
    expect(g(r).last?.result).toBe("ja");
    expect(g(r).asker).toBe("p1");
    r = game(r, { type: "ask" }, "p1");
    expect(() => game(r, { type: "decide", a: "nein" }, "p2")).toThrow(GameError);
    r = game(r, { type: "decide", a: "nein" }, "p1");
    expect(g(r).asker).toBe("p2");
    r = act(r, { type: "skip" }, "p1");
    expect(g(r).asker).toBe("p3");
    r = game(r, { type: "ask" }, "p3");
    r = act(r, { type: "removePlayer", id: "p3" }, "p1");
    expect(g(r).left).toContain("p3");
    expect(g(r).asker).toBe("p4");
    expect(g(r).phase).toBe("ask");
  });

  it("Gegenseitig vergeben: jeder schreibt für den Nachbarn, nur der Schreiber sieht seinen Entwurf, Host lost Fehlende aus", () => {
    let r = start(3, { source: "gegenseitig" });
    expect(g(r).phase).toBe("write");
    expect(g(r).writeFor).toEqual({ p1: "p2", p2: "p3", p3: "p1" });
    r = game(r, { type: "write", text: "Opa Willi" }, "p1");
    expect(JSON.stringify(viewRoom(r, "p2").game)).not.toContain("Opa Willi");
    expect(JSON.stringify(viewRoom(r, WATCH_ID).game)).not.toContain("Opa Willi");
    expect((viewRoom(r, "p1").game as WbState).drafts.p1).toBe("Opa Willi");
    r = game(r, { type: "write", text: "Tante Erna" }, "p2");
    r = act(r, { type: "skip" }, "p1");
    expect(g(r).phase).toBe("ask");
    expect(g(r).figures.p2).toBe("Opa Willi");
    expect(g(r).figures.p3).toBe("Tante Erna");
    expect(g(r).figures.p1).toBeTruthy();
    expect((viewRoom(r, "p2").game as WbState).figures.p2).toBeUndefined();
  });

  it("Ein Handy für alle: die Gruppe antwortet direkt, Notizen je Spieler", () => {
    let r = start(3, {}, false);
    expect(g(r).local).toBe(true);
    r = game(r, { type: "ask", text: "Bin ich alt?" });
    r = game(r, { type: "vote", a: "nein" });
    expect(g(r).asker).toBe("p2");
    expect(g(r).notes.p1).toEqual([{ q: "Bin ich alt?", a: "nein" }]);
    r = game(r, { type: "guess", text: "Quatsch" });
    expect(g(r).phase).toBe("guess");
    r = game(r, { type: "vote", a: "ja" });
    expect(g(r).solved).toEqual(["p2"]);
  });
});
