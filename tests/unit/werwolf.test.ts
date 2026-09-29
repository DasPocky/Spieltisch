import { describe, expect, it } from "vitest";
import { buildDeck, checkWinner, type Role, type WerwolfState } from "@shared/games/werwolf/logic";
import { playerLimits, viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as WerwolfState;
const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn", "Gina"];

/** Werwolf-Raum starten; `actor` null = lokal, sonst Start durch den Host p1 (online) */
function start(n: number, options: Record<string, string | boolean> = {}, online = false) {
  let r = act(roomWith(NAMES.slice(0, n)), { type: "selectGame", gameId: "werwolf" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" }, online ? "p1" : null);
}
/** Rollen gezielt festlegen */
function withRoles(r: RoomState, roles: Record<string, Role>): RoomState {
  return { ...r, game: { ...g(r), roles: { ...g(r).roles, ...roles } } };
}
const w = (r: RoomState, action: Record<string, unknown> & { type: string }, actor: string | null = null) => game(r, action, actor);

describe("Rollen verteilen", () => {
  it("Deck nach Einstellungen", () => {
    expect(buildDeck(5, { wolves: "auto", seherin: true })).toEqual(["werwolf", "seherin", "dorf", "dorf", "dorf"]);
    expect(buildDeck(8, { wolves: "auto" }).filter((x) => x === "werwolf")).toHaveLength(2);
    expect(() => buildDeck(6, { wolves: "3" })).toThrow(/zu viele/);
    expect(() => buildDeck(5, { wolves: "1", seherin: true, hexe: true, jaeger: true, amor: true, beschuetzer: true })).toThrow(/Sonderrollen/);
  });

  it("Spielerzahl 5–20, mit Spielleiter online einer mehr", () => {
    let r = act(roomWith(NAMES.slice(0, 4)), { type: "selectGame", gameId: "werwolf" });
    expect(playerLimits(r)).toMatchObject({ min: 5, max: 20 });
    expect(() => act(r, { type: "start" })).toThrow(/mindestens 5/);
    r = act(roomWith(NAMES.slice(0, 5)), { type: "selectGame", gameId: "werwolf" });
    r = act(r, { type: "setOption", key: "narrator", value: "human" });
    expect(() => act(r, { type: "start" }, "p1")).toThrow(/plus Spielleiter/);
  });

  it("jeder bekommt genau eine Rolle, der Spielleiter keine", () => {
    const r = start(6, { narrator: "human" }, true);
    expect(Object.keys(g(r).roles).sort()).toEqual(["p2", "p3", "p4", "p5", "p6"]);
    expect(g(r).narratorId).toBe("p1");
    expect(g(r).stepwise).toBe(true);
  });
});

describe("Geheime Sicht", () => {
  it("Mitspieler sehen nur die eigene Rolle, Wölfe sich gegenseitig", () => {
    let r = start(7, { wolves: "2" }, true);
    r = withRoles(r, { p1: "werwolf", p2: "werwolf", p3: "seherin", p4: "dorf", p5: "dorf", p6: "dorf", p7: "hexe" });
    const v4 = g(viewRoom(r, "p4"));
    expect(v4.known).toEqual(["p4"]);
    expect(v4.roles.p1).toBe("dorf"); // getarnt
    const v1 = g(viewRoom(r, "p1"));
    expect(v1.known!.sort()).toEqual(["p1", "p2"]);
  });

  it("Spielleiter sieht alles", () => {
    const r = start(6, { narrator: "human" }, true);
    expect(g(viewRoom(r, "p1")).known).toBeUndefined();
  });
});

describe("App erzählt, online", () => {
  function night() {
    let r = start(7, { wolves: "2", seherin: true, hexe: true }, true);
    r = withRoles(r, { p1: "werwolf", p2: "werwolf", p3: "seherin", p4: "hexe", p5: "dorf", p6: "dorf", p7: "dorf" });
    for (const id of ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]) r = w(r, { type: "ready" }, id);
    expect(g(r).phase).toBe("night");
    return r;
  }

  it("Wölfe stimmen ab, Seherin schaut, Hexe heilt – niemand stirbt", () => {
    let r = night();
    expect(() => w(r, { type: "wolf", target: "p5" }, "p5")).toThrow(/passende Rolle/);
    expect(() => w(r, { type: "witch", heal: true, poison: null }, "p4")).toThrow(/Werwölfe/);
    r = w(r, { type: "suspect", target: "p1" }, "p6");
    r = w(r, { type: "wolf", target: "p5" }, "p1");
    expect(g(r).victim).toBeNull();
    r = w(r, { type: "wolf", target: "p5" }, "p2");
    expect(g(r).victim).toBe("p5");
    r = w(r, { type: "see", target: "p1" }, "p3");
    expect(g(r).seer.at(-1)).toMatchObject({ target: "p1", role: "werwolf" });
    expect(g(viewRoom(r, "p4")).victim).toBe("p5"); // Hexe kennt das Opfer
    expect(g(viewRoom(r, "p6")).victim).toBeNull();
    r = w(r, { type: "witch", heal: true, poison: null }, "p4");
    expect(g(r).phase).toBe("day");
    expect(g(r).news!.deaths).toEqual([]);
    expect(g(r).news!.tally).toEqual({ p1: 1 });
    expect(g(r).potions.heal).toBe(false);
  });

  it("Abstimmung am Tag, Mehrheit stirbt", () => {
    let r = night();
    r = w(w(r, { type: "wolf", target: "p5" }, "p1"), { type: "wolf", target: "p5" }, "p2");
    r = w(r, { type: "see", target: "p6" }, "p3");
    r = w(r, { type: "witch", heal: false, poison: null }, "p4");
    expect(g(r).alive.p5).toBe(false);
    expect(() => w(r, { type: "vote", target: "p1" }, "p5")).toThrow(/Tote/);
    for (const id of ["p2", "p3", "p4", "p6"]) r = w(r, { type: "vote", target: "p1" }, id);
    expect(g(viewRoom(r, "p3")).votes.p2).toBe("?");
    r = w(r, { type: "vote", target: "p3" }, "p1");
    r = w(r, { type: "vote", target: "" }, "p7");
    expect(g(r).alive.p1).toBe(false);
    expect(g(r).phase).toBe("night");
    expect(g(r).night).toBe(2);
  });

  it("Gleichstand: niemand stirbt; Host kann die Abstimmung beenden", () => {
    let r = night();
    r = w(w(r, { type: "wolf", target: "p5" }, "p1"), { type: "wolf", target: "p5" }, "p2");
    r = w(w(r, { type: "see", target: "p6" }, "p3"), { type: "witch", heal: true, poison: null }, "p4");
    r = w(w(r, { type: "vote", target: "p1" }, "p3"), { type: "vote", target: "p2" }, "p4");
    expect(() => w(r, { type: "closeVote" }, "p3")).toThrow(/Host/);
    r = w(r, { type: "closeVote" }, "p1");
    expect(Object.values(g(r).alive).every(Boolean)).toBe(true);
    expect(g(r).phase).toBe("night");
  });
});

describe("Spielleiter bzw. lokal (schrittweise)", () => {
  it("Schritte der Reihe nach mit „Weiter“", () => {
    let r = start(6, { narrator: "human", jaeger: true, amor: true, hexe: false }, true);
    r = withRoles(r, { p2: "werwolf", p3: "seherin", p4: "jaeger", p5: "amor", p6: "dorf" });
    expect(() => w(r, { type: "ready" }, "p1")).toThrow(/spielst nicht/);
    r = w(r, { type: "startNight" }, "p1");
    // neu berechnen, da Rollen nachträglich gesetzt wurden
    expect(g(r).pending[0]).toBe("sleep");
    expect(() => w(r, { type: "startNight" }, "p2")).toThrow();
    r = w(r, { type: "next" }, "p1");
    expect(g(r).pending[0]).toBe("amor");
    expect(() => w(r, { type: "next" }, "p1")).toThrow(/Auswahl/);
    expect(() => w(r, { type: "amor", a: "p4", b: "p6" }, "p5")).toThrow(/Spielleiter/);
    r = w(w(r, { type: "amor", a: "p4", b: "p6" }, "p1"), { type: "next" }, "p1");
    expect(g(r).pending[0]).toBe("lovers");
    r = w(r, { type: "next" }, "p1");
    r = w(w(r, { type: "wolf", target: "p4" }, "p1"), { type: "next" }, "p1");
    r = w(w(r, { type: "see", target: "p2" }, "p1"), { type: "next" }, "p1");
    // Jäger tot, Geliebte stirbt aus Kummer, Jäger schießt
    expect(g(r).phase).toBe("hunter");
    expect(g(r).alive.p6).toBe(false);
    r = w(r, { type: "shoot", target: "p2" }, "p1");
    expect(g(r).winner).toBe("dorf");
    expect(g(r).phase).toBe("over");
  });

  it("lokal ohne Spielleiter: das Gerät führt, Verurteilung per Tipp", () => {
    let r = start(5);
    r = withRoles(r, { p1: "werwolf", p2: "seherin", p3: "hexe", p4: "dorf", p5: "dorf" });
    expect(g(r).narratorId).toBeNull();
    r = w(r, { type: "startNight" });
    while (g(r).phase === "night") {
      const step = g(r).pending[0];
      if (step === "werwolf") r = w(r, { type: "wolf", target: "p4" });
      if (step === "seherin") r = w(r, { type: "see", target: "p1" });
      if (step === "hexe") r = w(r, { type: "witch", heal: false, poison: "p5" });
      r = w(r, { type: "next" });
    }
    expect(g(r).news!.deaths.map((d) => d.id).sort()).toEqual(["p4", "p5"]);
    r = w(r, { type: "lynch", target: "p1" });
    expect(g(r).winner).toBe("dorf");
  });
});

describe("Sieg", () => {
  it("Wölfe gewinnen bei Gleichstand der Zahl", () => {
    const s = g(start(5));
    const st: WerwolfState = { ...s, roles: { a: "werwolf", b: "dorf", c: "dorf" }, alive: { a: true, b: true, c: false }, lovers: null };
    expect(checkWinner(st)).toBe("werwolf");
  });

  it("gemischtes Liebespaar gewinnt als Letzte", () => {
    const s = g(start(5));
    const st: WerwolfState = { ...s, roles: { a: "werwolf", b: "dorf", c: "dorf" }, alive: { a: true, b: true, c: false }, lovers: ["a", "b"] };
    expect(checkWinner(st)).toBe("liebe");
  });
});

describe("Spieler verlässt das Spiel", () => {
  it("letzter Wolf entfernt: Dorf gewinnt", () => {
    let r = start(5, {}, true);
    r = withRoles(r, { p1: "dorf", p2: "werwolf", p3: "seherin", p4: "hexe", p5: "dorf" });
    r = act(r, { type: "removePlayer", id: "p2" });
    expect(g(r).winner).toBe("dorf");
  });
});
