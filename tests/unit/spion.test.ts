import { describe, expect, it } from "vitest";
import { poolOf, spion, tally, type SpionState } from "@shared/games/spion/logic";
import { PACKS, PLACES } from "@shared/games/spion/places";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as SpionState;
const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"];
function start(n: number, online = false, options: Record<string, unknown> = {}) {
  let r = roomWith(NAMES.slice(0, n), "spion");
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value: value as never });
  return act(r, { type: "start" }, online ? "p1" : null);
}
/** Spion und Ort festlegen */
const fix = (r: RoomState, spies: string[], place = "bahnhof"): RoomState => ({ ...r, game: { ...g(r), spies, place, roles: Object.fromEntries(Object.keys(g(r).scores).map((id) => [id, spies.includes(id) ? "" : "Pendlerin"])) } });
const w = (r: RoomState, a: Record<string, unknown> & { type: string }, actor: string | null = null) => game(r, a, actor);
const allSeen = (r: RoomState, online: boolean) => Object.keys(g(r).scores).reduce((x, id) => w(x, { type: "seen", ...(online ? {} : { player: id }) }, online ? id : null), r);

describe("Spion", () => {
  it("Orte: mindestens 40, jeweils 5–7 Rollen, eindeutige IDs, alle Pakete belegt", () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    for (const p of PLACES) expect(p.roles.length, p.name).toBeGreaterThanOrEqual(5);
    for (const p of PLACES) expect(p.roles.length, p.name).toBeLessThanOrEqual(7);
    for (const pack of PACKS) expect(PLACES.filter((p) => p.pack === pack.id).length).toBeGreaterThanOrEqual(10);
    expect(poolOf({ pack_alltag: false, pack_urlaub: false, pack_arbeit: false, pack_abenteuer: true }).every((id) => PLACES.find((p) => p.id === id)!.pack === "abenteuer")).toBe(true);
    expect(poolOf({ pack_alltag: false, pack_urlaub: false, pack_arbeit: false, pack_abenteuer: false })).toHaveLength(PLACES.length);
  });

  it("Verteilung: ein Spion ohne Ort, die anderen mit Ort und Rolle; zwei Spione erst ab 5", () => {
    const s = g(start(4));
    expect(s.spies).toHaveLength(1);
    expect(s.pool).toContain(s.place);
    for (const id of Object.keys(s.scores)) expect(s.roles[id] === "").toBe(s.spies.includes(id));
    expect(g(start(4, false, { spies: "2" })).spies).toHaveLength(1);
    expect(g(start(5, false, { spies: "2" })).spies).toHaveLength(2);
    expect(Object.values(g(start(4, false, { roles: false })).roles).every((x) => x === "")).toBe(true);
  });

  it("online: jeder sieht nur seine Karte, der Spion keinen Ort, fremde Stimmen bleiben geheim", () => {
    let r = fix(start(4, true), ["p2"]);
    const v1 = g(viewRoom(r, "p1"));
    expect(v1.place).toBe("bahnhof");
    expect(v1.spies).toEqual([]);
    expect(Object.keys(v1.roles)).toEqual(["p1"]);
    const v2 = g(viewRoom(r, "p2"));
    expect(v2.place).toBeNull();
    expect(v2.spies).toEqual(["p2"]);
    r = allSeen(r, true);
    expect(g(r).phase).toBe("talk");
    r = w(r, { type: "accuse" }, "p1");
    r = w(r, { type: "vote", target: "p2" }, "p1");
    expect(g(viewRoom(r, "p3")).vote!.votes).toEqual({ p1: "?" });
    expect(g(viewRoom(r, "p1")).vote!.votes).toEqual({ p1: "p2" });
  });

  it("Fragen: wer fragt, tippt an; nicht sich selbst, nicht direkt zurück; Gefragte melden sich selbst", () => {
    let r = allSeen(fix(start(4, true), ["p2"]), true);
    expect(g(r).asker).toBe("p1");
    expect(spion.currentPlayerId(g(r))).toBe("p1");
    expect(() => w(r, { type: "ask", to: "p3" }, "p4")).toThrow(/Anna fragt/);
    r = w(r, { type: "ask", to: "p3" }, "p1");
    expect(() => w(r, { type: "ask", to: "p1" }, "p3")).toThrow(/zurückfragen/);
    expect(() => w(r, { type: "ask", to: "p3" }, "p3")).toThrow(/sich selbst/);
    r = w(r, { type: "ask", to: "p4" }, "p4"); // p4 meldet sich: „Ich wurde gefragt“
    expect(g(r).asker).toBe("p4");
  });

  it("Mehrheit trifft den Spion: andere gewinnen, Ankläger 2 Punkte, sonst 1", () => {
    let r = allSeen(fix(start(4, true), ["p2"]), true);
    r = w(r, { type: "accuse" }, "p3");
    expect(g(r).pausedAt).not.toBeNull();
    r = w(r, { type: "vote", target: "p2" }, "p1");
    r = w(r, { type: "vote", target: "p2" }, "p3");
    r = w(r, { type: "vote", target: "p1" }, "p2");
    r = w(r, { type: "vote", target: "p3" }, "p4");
    // p2 hat 2 von 3 Stimmen (ohne die eigene) → Mehrheit
    expect(g(r).phase).toBe("reveal");
    expect(g(r).last).toMatchObject({ winner: "group", reason: "caught", accused: "p2", by: "p3" });
    expect(g(r).scores).toEqual({ p1: 1, p2: 0, p3: 2, p4: 1 });
  });

  it("Einstimmig: eine Gegenstimme reicht, dann geht die Runde weiter; jeder startet nur einmal", () => {
    let r = allSeen(fix(start(4, true, { verdict: "unanimous" }), ["p2"]), true);
    r = w(r, { type: "accuse" }, "p1");
    for (const [v, t] of [["p1", "p2"], ["p3", "p2"], ["p4", "p3"], ["p2", "p3"]]) r = w(r, { type: "vote", target: t }, v);
    expect(g(r).phase).toBe("talk");
    expect(g(r).pausedAt).toBeNull();
    expect(() => w(r, { type: "accuse" }, "p1")).toThrow(/schon/);
    expect(tally({ p1: "p2", p3: "p2", p4: "p2" }, ["p1", "p2", "p3", "p4"], { verdict: "unanimous" })).toBe("p2");
    expect(tally({ p1: "p2", p3: "p2", p4: "p1" }, ["p1", "p2", "p3", "p4"], { verdict: "majority" })).toBe("p2");
    expect(tally({ p1: "p2", p2: "p1", p3: "p4", p4: "p3" }, ["p1", "p2", "p3", "p4"], {})).toBeNull();
    // Gleichstand 2:2 – niemand verurteilt
    expect(tally({ p1: "p2", p3: "p2", p2: "p1", p4: "p1" }, ["p1", "p2", "p3", "p4"], {})).toBeNull();
  });

  it("Unschuldiger verurteilt: Spion 4 Punkte; Zeit um ohne Ergebnis: Spion 2", () => {
    let r = allSeen(fix(start(3), ["p3"]), false);
    r = w(r, { type: "accuse", by: "p1" });
    r = w(r, { type: "verdict", target: "p2" });
    expect(g(r).last).toMatchObject({ winner: "spy", reason: "innocent" });
    expect(g(r).scores.p3).toBe(4);
    r = w(r, { type: "nextRound" });
    expect(g(r).round).toBe(2);
    expect(g(r).used).toEqual(["bahnhof"]);
    r = allSeen(fix(r, ["p1"], "zoo"), false);
    // zu früh: nichts passiert
    expect(g(w(r, { type: "timeUp" })).phase).toBe("talk");
    r = { ...r, game: { ...g(r), startedAt: Date.now() - 9 * 60_000 } };
    r = w(r, { type: "timeUp" });
    expect(g(r).phase).toBe("vote");
    expect(g(r).vote!.final).toBe(true);
    r = w(r, { type: "verdict", target: null });
    expect(g(r).last).toMatchObject({ winner: "spy", reason: "time" });
    expect(g(r).scores.p1).toBe(2);
  });

  it("Spion rät: richtig 4 Punkte, falsch je 1 für die anderen; nur der Spion darf", () => {
    let r = allSeen(fix(start(4, true), ["p4"]), true);
    expect(() => w(r, { type: "reveal" }, "p1")).toThrow(/nicht der Spion/);
    r = w(r, { type: "reveal" }, "p4");
    expect(g(r).phase).toBe("guess");
    expect(() => w(r, { type: "guess", place: "bahnhof" }, "p1")).toThrow(/nur der Spion/);
    const right = w(r, { type: "guess", place: "bahnhof" }, "p4");
    expect(g(right).scores).toEqual({ p1: 0, p2: 0, p3: 0, p4: 4 });
    const wrong = w(r, { type: "guess", place: "zoo" }, "p4");
    expect(g(wrong).scores).toEqual({ p1: 1, p2: 1, p3: 1, p4: 0 });
    expect(g(wrong).last?.reason).toBe("guessWrong");
  });

  it("Hausregel letzte Chance: ertappter Spion rät richtig und gewinnt doch", () => {
    let r = allSeen(fix(start(3, false, { lastChance: true }), ["p2"]), false);
    r = w(r, { type: "accuse" });
    r = w(r, { type: "verdict", target: "p2" });
    expect(g(r).phase).toBe("guess");
    expect(g(r).guess).toMatchObject({ spy: "p2", caught: true });
    r = w(r, { type: "guess", place: "bahnhof" });
    expect(g(r).last).toMatchObject({ winner: "spy", reason: "caughtGuess" });
  });

  it("Nur Runden zählen: Gewinner je 1; nach der letzten Runde ist Schluss", () => {
    let r = allSeen(fix(start(3, false, { scoring: "rounds", rounds: 1 }), ["p1"]), false);
    r = w(r, { type: "reveal", spy: "p1" });
    r = w(r, { type: "guess", place: "kino" });
    expect(g(r).scores).toEqual({ p1: 0, p2: 1, p3: 1 });
    expect(g(r).phase).toBe("over");
    const res = spion.results!(g(r), { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.filter((x) => x.won).map((x) => x.id)).toEqual(["p2", "p3"]);
  });

  it("Spieler geht: Spion weg → Runde neu verteilt; Fragender weg → der Nächste fragt; nichts hängt", () => {
    let r = allSeen(fix(start(4, true), ["p3"]), true);
    r = act(r, { type: "removePlayer", id: "p1" }, "p1");
    expect(g(r).asker).toBe("p2");
    r = act(r, { type: "removePlayer", id: "p3" }, "p2");
    expect(g(r).phase).toBe("look");
    expect(g(r).spies).toHaveLength(1);
    expect(Object.keys(g(r).scores)).toEqual(["p2", "p4"]);
    // Host überspringt alles Hängende
    for (let i = 0; i < 6 && g(r).phase !== "over"; i++) r = act(r, { type: "skip" }, r.hostId);
    expect(["reveal", "vote", "talk", "over", "look"]).toContain(g(r).phase);
  });
});
