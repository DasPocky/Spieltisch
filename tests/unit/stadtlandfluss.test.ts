import { describe, expect, it } from "vitest";
import { catsOf, deadlineOf, same, scoreCategory, stadtlandfluss, startsWith, RARE, type SlfState } from "@shared/games/stadtlandfluss/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { presetValues } from "@shared/platform/presets";
import { GameError } from "@shared/platform/types";
import { act, game, roomWith } from "./helpers";

const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil"];
const g = (r: RoomState) => r.game as SlfState;
function start(n = 3, options: Record<string, string | number | boolean> = {}, online = true) {
  let r = act(roomWith(NAMES.slice(0, n)), { type: "selectGame", gameId: "stadtlandfluss" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" }, online ? "p1" : null);
}
/** Antworten passend zum Buchstaben: `w(id, i)` liefert das Wortende */
const fill = (s: SlfState, words: string[]) => words.map((w) => (w ? `${s.letter}${w}` : ""));

describe("Stadt-Land-Fluss", () => {
  it("Vergleich: groß/klein egal, kleine Tippfehler gleich, Anfangsbuchstabe mit Umlaut", () => {
    expect(same("Hamburg", "hamburg")).toBe(true);
    expect(same("Hamburg", "Hamburk")).toBe(true);
    expect(same("Oslo", "Olso")).toBe(false);
    expect(same("Bremen", "Berlin")).toBe(false);
    expect(startsWith("Ägypten", "A")).toBe(true);
    expect(startsWith(" kiel", "K")).toBe(true);
    expect(startsWith("Berlin", "K")).toBe(false);
  });

  it("Punkte: 20 allein, 10 einzigartig, 5 doppelt, 0 leer/abgelehnt", () => {
    expect(scoreCategory({ a: "Kiel", b: "", c: "Köln" }, { a: "ok", b: "empty", c: "no" })).toEqual({ a: 20, b: 0, c: 0 });
    expect(scoreCategory({ a: "Kiel", b: "kiel", c: "Köln" }, { a: "ok", b: "ok", c: "ok" })).toEqual({ a: 5, b: 5, c: 10 });
    expect(scoreCategory({ a: "Kassel", b: "Kasel" }, { a: "ok", b: "ok" })).toEqual({ a: 5, b: 5 });
  });

  it("Kategorien: Standard sechs, eigene dazu, höchstens zehn, nie keine; Pakete", () => {
    expect(catsOf({})).toEqual(["Stadt", "Land", "Fluss", "Name", "Beruf", "Tier"]);
    expect(catsOf({ own: "Promi, promi, Gericht" })).toEqual(["Stadt", "Land", "Fluss", "Name", "Beruf", "Tier", "Promi", "Gericht"]);
    expect(catsOf({ k_stadt: false, k_land: false, k_fluss: false, k_name: false, k_beruf: false, k_tier: false })).toHaveLength(6);
    expect(catsOf({ k_pflanze: true, k_essen: true, k_sport: true, k_hobby: true, k_kleidung: true, own: "A, B" })).toHaveLength(10);
    const logic = stadtlandfluss;
    expect(catsOf(presetValues(logic, logic.presets![0]))).toEqual(["Stadt", "Land", "Fluss", "Tier"]);
    const kinder = presetValues(logic, logic.presets![1]);
    expect(catsOf(kinder)).not.toContain("Stadt");
    expect(kinder.rare).toBe(false);
  });

  it("Ohne seltene Buchstaben nie Q, X, Y; Buchstaben wiederholen sich erst, wenn alle dran waren", () => {
    for (let i = 0; i < 30; i++) expect(RARE).not.toContain(g(start(2, { rounds: 10 })).letter);
    const s = g(start(2));
    expect(s.pool).toHaveLength(23);
    expect(g(start(2, { rare: true })).pool).toHaveLength(26);
  });

  it("Geheim: beim Schreiben sieht jeder nur seine Antworten, der Fernseher keine", () => {
    let r = start(3);
    r = game(r, { type: "fill", answers: fill(g(r), ["a1", "a2"]) }, "p1");
    r = game(r, { type: "fill", answers: fill(g(r), ["b1"]) }, "p2");
    const tv = viewRoom(r, WATCH_ID).game as SlfState;
    expect(tv.answers).toEqual({});
    const ben = viewRoom(r, "p2").game as SlfState;
    expect(Object.keys(ben.answers)).toEqual(["p2"]);
  });

  it("Stopp nur mit allen Feldern, dann Countdown; Zeit um → Auswertung mit den Entwürfen", () => {
    let r = start(3, { countdown: "10" });
    const s = g(r);
    expect(() => game(r, { type: "done", answers: fill(s, ["x"]), stop: true }, "p1")).toThrow(GameError);
    r = game(r, { type: "fill", answers: fill(s, ["entwurf"]) }, "p3");
    r = game(r, { type: "done", answers: fill(s, s.cats.map(() => "a")), stop: true }, "p1");
    expect(g(r).stopBy).toBe("p1");
    const end = deadlineOf(g(r))!;
    expect(end).toBe(g(r).stopAt! + 10_000);
    // zu früh geht nicht
    expect(() => game(r, { type: "timeUp" }, "p2")).toThrow(GameError);
    const now = Date.now;
    Date.now = () => end + 1000;
    try { r = game(r, { type: "timeUp" }, "p2"); } finally { Date.now = now; }
    expect(g(r).phase).toBe("review");
    expect(g(r).answers.p3[0]).toBe(`${s.letter}entwurf`);
    expect(g(r).answers.p2.every((x) => x === "")).toBe(true);
  });

  it("Ablehnen: Mehrheit lehnt ab, Gleichstand entscheidet der Host, eigene nicht", () => {
    let r = start(5);
    const s = g(r);
    const same5 = s.cats.map(() => "x");
    for (const id of ["p1", "p2", "p3", "p4", "p5"]) r = game(r, { type: "done", answers: fill(s, id === "p5" ? same5.map(() => "") : same5.map((_, i) => `${id}${i}`)) }, id);
    expect(g(r).phase).toBe("review");
    expect(() => game(r, { type: "vote", target: "p1" }, "p1")).toThrow(GameError);
    // p2: 3 von 4 dagegen → abgelehnt
    for (const v of ["p1", "p3", "p4"]) r = game(r, { type: "vote", target: "p2" }, v);
    // p3: 2 von 4 → Gleichstand, Host lehnt ab
    for (const v of ["p1", "p2"]) r = game(r, { type: "vote", target: "p3" }, v);
    expect(() => game(r, { type: "decide", target: "p3", reject: true }, "p2")).toThrow(GameError);
    r = game(r, { type: "decide", target: "p3", reject: true }, "p1");
    // p4: 2 von 4, Host entscheidet nicht → gilt
    for (const v of ["p1", "p5"]) r = game(r, { type: "vote", target: "p4" }, v);
    // Daumen wieder weg
    r = game(r, { type: "vote", target: "p4" }, "p5");
    r = game(r, { type: "vote", target: "p4" }, "p5");
    r = game(r, { type: "next" }, "p1");
    const st = g(r);
    expect(st.marks.p2[0]).toBe("no");
    expect(st.marks.p3[0]).toBe("no");
    expect(st.marks.p4[0]).toBe("ok");
    expect(st.marks.p5[0]).toBe("empty");
    expect(st.points.p1[0]).toBe(10);
    expect(st.points.p2[0]).toBe(0);
    expect(st.cat).toBe(1);
    // nur der Host geht weiter
    expect(() => act(r, { type: "game", action: { type: "next" } }, "p2")).toThrow();
  });

  it("Falscher Anfangsbuchstabe zählt nicht; Auswertung zeigt nur bis zur aktuellen Kategorie", () => {
    let r = start(2);
    const s = g(r);
    const other = s.letter === "B" ? "C" : "B";
    r = game(r, { type: "done", answers: s.cats.map((_, i) => `${s.letter}eins${i}`) }, "p1");
    r = game(r, { type: "done", answers: s.cats.map((_, i) => `${other}zwei${i}`) }, "p2");
    const v = viewRoom(r, WATCH_ID).game as SlfState;
    expect(v.answers.p1[0]).toBe(`${s.letter}eins0`);
    expect(v.answers.p1[1]).toBe("");
    r = game(r, { type: "next" }, "p1");
    expect(g(r).marks.p2[0]).toBe("letter");
    expect(g(r).points.p1[0]).toBe(20);
  });

  it("Ganze Partie bis zum Ende, Aussteiger wird übersprungen, Host-Weiter beendet alles", () => {
    let r = start(3, { rounds: 2 });
    r = act(r, { type: "removePlayer", id: "p3" }, "p1");
    for (let round = 0; round < 2; round++) {
      const s = g(r);
      expect(s.phase).toBe("write");
      r = game(r, { type: "done", answers: fill(s, s.cats.map((_, i) => `a${i}`)), stop: true }, "p1");
      r = game(r, { type: "done", answers: fill(s, s.cats.map((_, i) => `b${i}`)) }, "p2");
      expect(g(r).phase).toBe("review");
      for (let c = 0; c < s.cats.length; c++) r = game(r, { type: "next" }, "p1");
      expect(g(r).phase).toBe("score");
      r = game(r, { type: "next" }, "p1");
    }
    expect(g(r).phase).toBe("over");
    expect(g(r).scores.p1).toBe(2 * 6 * 10);
    const res = stadtlandfluss.results!(g(r), { players: [], hostId: "p1", actorId: null, options: {}, now: 0 });
    expect(res.map((x) => x.id)).toEqual(["p1", "p2"]);
    // Host überspringt: Stopp erzwingen, dann ohne die anderen auswerten
    let q = start(3);
    expect(stadtlandfluss.skipLabel!(g(q), { players: [], hostId: "p1", actorId: "p1", options: {}, now: 0 })).toBe("Stopp für alle");
    q = act(q, { type: "skip" }, "p1");
    expect(g(q).stopAt).not.toBeNull();
    q = act(q, { type: "skip" }, "p1");
    expect(g(q).phase).toBe("review");
  });

  it("Ein Handy für alle: ohne Uhr, reihum, Gruppe lehnt per Tippen ab", () => {
    let r = start(2, {}, false);
    const s = g(r);
    expect(s.seconds).toBe(0);
    expect(deadlineOf(s)).toBeNull();
    r = game(r, { type: "done", answers: fill(s, s.cats.map(() => "a")), player: "p1" });
    r = game(r, { type: "done", answers: fill(s, s.cats.map(() => "b")), player: "p2" });
    r = game(r, { type: "vote", target: "p2" });
    r = game(r, { type: "next" });
    expect(g(r).marks.p2[0]).toBe("no");
    expect(g(r).points.p1[0]).toBe(20);
  });
});
