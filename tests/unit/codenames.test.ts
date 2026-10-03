import { describe, expect, it } from "vitest";
import { countLabel, UNLIMITED, withKey, type CNState, type Color } from "@shared/games/codenames/logic";
import { WORDS } from "@shared/games/codenames/words";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as CNState;
const KEY: Color[] = [
  "rot", "rot", "rot", "rot", "rot", "rot", "rot", "rot", "rot",
  "blau", "blau", "blau", "blau", "blau", "blau", "blau", "blau",
  "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "attentaeter",
];

/** Online-Raum: p1 Chef Rot, p2 Agent Rot, p3 Chef Blau, p4 Agent Blau */
function start(mode = "app") {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"]), { type: "selectGame", gameId: "codenames" });
  r = act(r, { type: "setOption", key: "mode", value: mode });
  r = act(r, { type: "start" }, "p1");
  r = game(r, { type: "join", team: "rot", chief: true }, "p1");
  r = game(r, { type: "join", team: "rot" }, "p2");
  r = game(r, { type: "join", team: "blau", chief: true }, "p3");
  r = game(r, { type: "join", team: "blau" }, "p4");
  r = { ...r, game: withKey(g(r), KEY, "rot") };
  return game(r, { type: "begin" }, "p1");
}

describe("Codenames", () => {
  it("Brett: 25 verschiedene Wörter, 9/8/7/1 verteilt", () => {
    let r = act(roomWith(["A", "B", "C", "D"]), { type: "selectGame", gameId: "codenames" });
    r = act(r, { type: "start" });
    const s = g(r);
    expect(new Set(s.words).size).toBe(25);
    expect(s.words.every((w) => WORDS.includes(w))).toBe(true);
    const n = (c: Color) => s.key.filter((x) => x === c).length;
    expect(n(s.start)).toBe(9);
    expect(n(s.start === "rot" ? "blau" : "rot")).toBe(8);
    expect(n("neutral")).toBe(7);
    expect(n("attentaeter")).toBe(1);
  });

  it("Start erst mit Chef und Agent je Team; man teilt sich online selbst ein", () => {
    let r = act(act(roomWith(["Anna", "Ben", "Cem", "Dora"]), { type: "selectGame", gameId: "codenames" }), { type: "start" }, "p1");
    expect(() => game(r, { type: "begin" }, "p1")).toThrow(/Chef/);
    expect(() => game(r, { type: "join", player: "p3", team: "rot" }, "p2")).toThrow(/selbst/);
    r = game(r, { type: "shuffleTeams" }, "p1");
    expect(() => game(r, { type: "begin" }, "p2")).toThrow(/Host/);
    expect(g(game(r, { type: "begin" }, "p1")).phase).toBe("play");
  });

  it("Nur Chefs sehen die Schlüsselkarte", () => {
    const r = start();
    expect(g(viewRoom(r, "p1")).key).toEqual(KEY);
    expect(g(viewRoom(r, "p2")).key.every((c) => c === "neutral")).toBe(true);
    expect(g(viewRoom(r, "p2")).seesKey).toBe(false);
  });

  it("Hinweis vom richtigen Chef, raten nur die Agenten des Teams", () => {
    let r = start();
    expect(() => game(r, { type: "clue", word: "Quatsch", count: 2 }, "p3")).toThrow(/Chef von Team Rot/);
    expect(() => game(r, { type: "clue", word: "zwei Worte", count: 2 }, "p1")).toThrow(/ein Wort/);
    expect(() => game(r, { type: "clue", word: g(r).words[0], count: 1 }, "p1")).toThrow(/auf dem Tisch/);
    expect(() => game(r, { type: "guess", i: 0 }, "p2")).toThrow(/Hinweis/);
    r = game(r, { type: "clue", word: "Quatsch", count: 2 }, "p1");
    expect(g(r).guessesLeft).toBe(3);
    expect(() => game(r, { type: "guess", i: 0 }, "p1")).toThrow(/Agenten/);
    expect(() => game(r, { type: "guess", i: 0 }, "p4")).toThrow(/Agenten/);
    expect(() => game(r, { type: "pass" }, "p2")).toThrow(/Mindestens/);
    r = game(r, { type: "guess", i: 0 }, "p2"); // rot – weiter
    expect(g(r).turn).toBe("rot");
    r = game(r, { type: "guess", i: 17 }, "p2"); // Passant – Zug vorbei
    expect(g(r).turn).toBe("blau");
    expect(g(r).clue).toBeNull();
  });

  it("Zahl + 1 Versuche, gegnerische Karte beendet den Zug", () => {
    let r = start();
    r = game(r, { type: "clue", word: "Quatsch", count: 1 }, "p1");
    r = game(r, { type: "guess", i: 0 }, "p2");
    r = game(r, { type: "guess", i: 1 }, "p2");
    expect(g(r).turn).toBe("blau"); // zwei Versuche aufgebraucht
    r = game(r, { type: "clue", word: "Unsinn", count: 1 }, "p3");
    r = game(r, { type: "guess", i: 2 }, "p4"); // rote Karte
    expect(g(r).turn).toBe("rot");
    expect(g(r).revealed[2]).toBe(true);
  });

  it("Attentäter verliert sofort, alle eigenen Karten gewinnen", () => {
    let r = start();
    r = game(r, { type: "clue", word: "Quatsch", count: 1 }, "p1");
    r = game(r, { type: "guess", i: 24 }, "p2");
    expect(g(r).phase).toBe("over");
    expect(g(r).winner).toBe("blau");
    expect(g(r).assassin).toBe(true);

    let q = start();
    q = game(q, { type: "clue", word: "Allesamt", count: 0 }, "p1");
    for (let i = 0; i < 9; i++) q = game(q, { type: "guess", i }, "p2");
    expect(g(q).winner).toBe("rot");
  });

  it("Hinweiszahl 0 und ∞: beliebig viele Versuche, mindestens einer; sonst 0–9", () => {
    let r = start();
    expect(() => game(r, { type: "clue", word: "Quatsch", count: 10 }, "p1")).toThrow(/0 und 9/);
    expect(() => game(r, { type: "clue", word: "Quatsch", count: -2 }, "p1")).toThrow(/0 und 9/);
    r = game(r, { type: "clue", word: "Xyloquark", count: 0 }, "p1");
    expect(g(r).clue).toEqual({ word: "Xyloquark", count: 0 });
    expect(() => game(r, { type: "pass" }, "p2")).toThrow(/Mindestens/);
    for (let i = 0; i < 8; i++) r = game(r, { type: "guess", i }, "p2");
    expect(g(r).turn).toBe("rot");
    r = game(r, { type: "pass" }, "p2");
    r = game(r, { type: "clue", word: "Quarxylo", count: UNLIMITED }, "p3");
    expect(countLabel(g(r).clue!.count)).toBe("∞");
    for (let i = 9; i < 16; i++) r = game(r, { type: "guess", i }, "p4");
    expect(g(r).turn).toBe("blau");
  });

  it("Brettspiel-Hilfe: Chefs markieren, Sieg wird erkannt, Tippfehler zurücknehmbar", () => {
    let r = start("key");
    expect(g(r).words).toEqual([]);
    expect(() => game(r, { type: "mark", i: 0 }, "p2")).toThrow(/Chefs/);
    r = game(r, { type: "mark", i: 0 }, "p3");
    r = game(r, { type: "mark", i: 0 }, "p3");
    expect(g(r).revealed[0]).toBe(false);
    for (let i = 9; i < 17; i++) r = game(r, { type: "mark", i }, "p1");
    expect(g(r).winner).toBe("blau");
  });

  it("Ergebnis: Mitglieder des Siegerteams gewinnen", async () => {
    let r = start();
    r = game(r, { type: "clue", word: "Quatsch", count: 1 }, "p1");
    r = game(r, { type: "guess", i: 24 }, "p2");
    const { codenames } = await import("@shared/games/codenames/logic");
    const res = codenames.results!(g(r), { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.filter((x) => x.won).map((x) => x.id).sort()).toEqual(["p3", "p4"]);
  });
});

describe("Codenames – Sanduhr", () => {
  it("turnAt wird bei jedem Teamwechsel neu gesetzt", async () => {
    const { codenames } = await import("@shared/games/codenames/logic");
    const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
    const ctx = (now: number) => ({ players, hostId: "a", actorId: null, options: { mode: "app", timer: "60" }, now });
    let s = codenames.setup(ctx(0));
    s = codenames.apply(s, { type: "join", player: "a", team: "rot", chief: true }, ctx(1));
    s = codenames.apply(s, { type: "join", player: "b", team: "rot" }, ctx(2));
    s = codenames.apply(s, { type: "join", player: "c", team: "blau", chief: true }, ctx(3));
    s = codenames.apply(s, { type: "join", player: "d", team: "blau" }, ctx(4));
    s = codenames.apply(s, { type: "begin" }, ctx(1000));
    expect(s.turnAt).toBe(1000);
    const turn = s.turn;
    s = codenames.skipTurn!(s, ctx(5000));
    expect(s.turn).not.toBe(turn);
    expect(s.turnAt).toBe(5000);
  });
});
