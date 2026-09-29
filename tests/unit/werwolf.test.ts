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

describe("Rollen aus den Erweiterungen", () => {
  /** Lokales Spiel (schrittweise) mit festen Rollen, direkt in der ersten Nacht */
  function night1(roles: Record<string, Role>, options: Record<string, string | boolean> = {}) {
    const n = Object.keys(roles).length;
    let r = start(n, { wolves: String(Object.values(roles).filter((x) => ["werwolf", "urwolf", "grosserwolf"].includes(x)).length), ...options });
    r = { ...r, game: { ...g(r), roles: { ...roles } } };
    return w(r, { type: "startNight" });
  }
  /** Die Nacht durchspielen: je Schritt die passende Aktion (oder nur „Weiter“) */
  function runNight(r: RoomState, choices: Partial<Record<string, Record<string, unknown> & { type: string }>>) {
    for (let i = 0; i < 20 && g(r).phase === "night"; i++) {
      const step = g(r).pending[0];
      const c = choices[step];
      if (c) r = w(r, c);
      r = w(r, { type: "next" });
    }
    return r;
  }
  const base = { p1: "werwolf", p2: "dorf", p3: "dorf", p4: "dorf", p5: "dorf" } as Record<string, Role>;

  it("Deck: Schwestern kommen zu zweit, Sonder-Wölfe zählen als Wölfe", () => {
    expect(buildDeck(6, { wolves: "1", schwester: true }).filter((x) => x === "schwester")).toHaveLength(2);
    expect(() => buildDeck(8, { wolves: "1", urwolf: true, grosserwolf: true })).toThrow(/mehr Werwölfe/);
    expect(buildDeck(8, { wolves: "2", urwolf: true, grosserwolf: true }).filter((x) => x === "werwolf")).toHaveLength(0);
  });

  it("Der Alte überlebt den ersten Angriff", () => {
    let r = night1({ ...base, p2: "alter" });
    r = runNight(r, { werwolf: { type: "wolf", target: "p2" } });
    expect(g(r).alive.p2).toBe(true);
    r = w(r, { type: "lynch", target: null });
    r = runNight(r, { werwolf: { type: "wolf", target: "p2" } });
    expect(g(r).alive.p2).toBe(false);
  });

  it("Ritter: der nächste Wolf stirbt eine Nacht später", () => {
    let r = night1({ p1: "dorf", p2: "ritter", p3: "werwolf", p4: "dorf", p5: "dorf", p6: "werwolf", p7: "dorf" });
    r = runNight(r, { werwolf: { type: "wolf", target: "p2" } });
    expect(g(r).alive.p2).toBe(false);
    expect(g(r).alive.p3).toBe(true);
    r = w(r, { type: "lynch", target: null });
    r = runNight(r, { werwolf: { type: "wolf", target: "p1" } });
    expect(g(r).alive.p3).toBe(false);
    expect(g(r).news!.deaths.find((d) => d.id === "p3")!.cause).toBe("rost");
  });

  it("Urwolf verwandelt das Opfer in einen Werwolf", () => {
    let r = night1({ p1: "urwolf", p2: "dorf", p3: "dorf", p4: "dorf", p5: "dorf", p6: "dorf", p7: "werwolf" });
    r = runNight(r, { werwolf: { type: "wolf", target: "p2" }, urwolf: { type: "infect", yes: true } });
    expect(g(r).alive.p2).toBe(true);
    expect(g(r).roles.p2).toBe("werwolf");
    expect(g(r).infectUsed).toBe(true);
  });

  it("Großer böser Wolf frisst ein zweites Opfer – bis ein Wolf stirbt", () => {
    let r = night1({ p1: "grosserwolf", p2: "dorf", p3: "dorf", p4: "dorf", p5: "dorf", p6: "dorf", p7: "werwolf" });
    r = runNight(r, { werwolf: { type: "wolf", target: "p2" }, grosserwolf: { type: "wolf2", target: "p3" } });
    expect(g(r).alive.p2 || g(r).alive.p3).toBe(false);
    r = w(r, { type: "lynch", target: "p7" });
    expect(g(r).pending).not.toContain("grosserwolf");
  });

  it("Wildes Kind wird zum Werwolf, wenn sein Vorbild stirbt", () => {
    let r = night1({ ...base, p2: "wildeskind", p6: "dorf" });
    r = runNight(r, { wildeskind: { type: "model", target: "p3" }, werwolf: { type: "wolf", target: "p3" } });
    expect(g(r).roles.p2).toBe("werwolf");
  });

  it("Wolfshund entscheidet sich für die Wölfe", () => {
    let r = night1({ ...base, p2: "wolfshund", p6: "dorf" });
    r = runNight(r, { wolfshund: { type: "dog", wolf: true }, werwolf: { type: "wolf", target: "p3" } });
    expect(g(r).roles.p2).toBe("werwolf");
  });

  it("Fuchs wittert Wölfe und verliert sonst seine Fähigkeit", () => {
    let r = night1({ p1: "fuchs", p2: "dorf", p3: "dorf", p4: "werwolf", p5: "dorf", p6: "dorf", p7: "dorf" });
    r = runNight(r, { werwolf: { type: "wolf", target: "p7" }, fuchs: { type: "fox", target: "p3" } });
    expect(g(r).fox.at(-1)!.wolf).toBe(true);
    r = w(r, { type: "lynch", target: null });
    r = runNight(r, { werwolf: { type: "wolf", target: "p6" }, fuchs: { type: "fox", target: "p1" } });
    expect(g(r).foxPower).toBe(false);
  });

  it("Bärenführer: der Bär brummt neben einem Wolf", () => {
    let r = night1({ p1: "dorf", p2: "baerenfuehrer", p3: "werwolf", p4: "dorf", p5: "dorf", p6: "dorf" });
    r = runNight(r, { werwolf: { type: "wolf", target: "p5" } });
    expect(g(r).news!.growl).toBe(true);
  });

  it("Schwestern kennen sich", () => {
    let r = start(7, { schwester: true }, true);
    r = withRoles(r, { p1: "werwolf", p2: "schwester", p3: "schwester", p4: "dorf", p5: "dorf", p6: "dorf", p7: "dorf" });
    expect(g(viewRoom(r, "p2")).known!.sort()).toEqual(["p2", "p3"]);
  });

  describe("online (App erzählt)", () => {
    function day(roles: Record<string, Role>) {
      let r = start(Object.keys(roles).length, {}, true);
      r = withRoles(r, roles);
      r = w(r, { type: "startNight" }, "p1");
      const wolves = Object.entries(roles).filter(([, x]) => x === "werwolf").map(([id]) => id);
      const target = Object.keys(roles).find((id) => roles[id] === "dorf" && !["p1", "p2", "p3"].includes(id))!;
      for (const id of wolves) r = w(r, { type: "wolf", target }, id);
      if (g(r).phase === "night") r = w(r, { type: "raven", target: "p3" }, Object.keys(roles).find((id) => roles[id] === "rabe")!);
      return r;
    }

    it("Dorfdepp überlebt die Verurteilung und darf nicht mehr abstimmen", () => {
      let r = day({ p1: "dorf", p2: "dorfdepp", p3: "dorf", p4: "werwolf", p5: "dorf", p6: "dorf", p7: "dorf" });
      expect(g(r).phase).toBe("day");
      r = w(r, { type: "closeVote" }, "p1"); // niemand – neue Nacht
      r = w(r, { type: "wolf", target: "p6" }, "p4");
      expect(g(r).phase).toBe("day");
      for (const id of ["p1", "p2", "p3", "p4", "p7"]) r = w(r, { type: "vote", target: "p2" }, id);
      expect(g(r).alive.p2).toBe(true);
      expect(g(r).news!.idiot).toBe("p2");
      r = w(r, { type: "wolf", target: "p7" }, "p4");
      expect(() => w(r, { type: "vote", target: "p4" }, "p2")).toThrow(/Dorfdepp/);
    });

    it("Sündenbock stirbt bei Gleichstand", () => {
      let r = day({ p1: "dorf", p2: "suendenbock", p3: "dorf", p4: "werwolf", p5: "dorf", p6: "dorf", p7: "dorf" });
      r = w(w(r, { type: "vote", target: "p3" }, "p1"), { type: "vote", target: "p4" }, "p3");
      r = w(r, { type: "closeVote" }, "p1");
      expect(g(r).alive.p2).toBe(false);
      expect(g(r).news!.scapegoat).toBe(true);
    });

    it("Rabe: zwei Stimmen mehr gegen den Markierten", () => {
      let r = day({ p1: "dorf", p2: "rabe", p3: "dorf", p4: "werwolf", p5: "dorf", p6: "dorf", p7: "dorf" });
      expect(g(r).news!.raven).toBe("p3");
      r = w(r, { type: "vote", target: "p4" }, "p1"); // p4: 1 Stimme, p3: 2 vom Raben
      r = w(r, { type: "closeVote" }, "p1");
      expect(g(r).alive.p3).toBe(false);
    });
  });
});

describe("Hausregeln, eigene Karten, Solo-Rollen, Dieb", () => {
  function onlineDay(roles: Record<string, Role>, options: Record<string, string | boolean> = {}) {
    let r = start(Object.keys(roles).length, options, true);
    r = withRoles(r, roles);
    r = w(r, { type: "startNight" }, "p1");
    const wolves = Object.keys(roles).filter((id) => roles[id] === "werwolf");
    const target = Object.keys(roles).reverse().find((id) => roles[id] === "dorf")!;
    for (const id of wolves) r = w(r, { type: "wolf", target }, id);
    return r;
  }
  const seven = { p1: "dorf", p2: "dorf", p3: "dorf", p4: "werwolf", p5: "dorf", p6: "dorf", p7: "dorf" } as Record<string, Role>;

  it("Hauptmann: Wahl am ersten Tag, doppelte Stimme, Nachfolger", () => {
    let r = onlineDay(seven, { captain: true });
    expect(g(r).phase).toBe("election");
    for (const id of ["p1", "p2", "p3", "p4", "p5", "p6"]) r = w(r, { type: "vote", target: "p2" }, id);
    expect(g(r).captain).toBe("p2");
    expect(g(r).phase).toBe("day");
    // p2 (doppelt) gegen p4, p1 gegen p3: p4 hat 2, p3 hat 1
    r = w(w(r, { type: "vote", target: "p4" }, "p2"), { type: "vote", target: "p3" }, "p1");
    r = w(r, { type: "closeVote" }, "p1");
    expect(g(r).winner).toBe("dorf");
  });

  it("Stichwahl bei Gleichstand", () => {
    let r = onlineDay(seven, { tie: "runoff" });
    r = w(w(r, { type: "vote", target: "p4" }, "p1"), { type: "vote", target: "p3" }, "p2");
    r = w(r, { type: "closeVote" }, "p1");
    expect(g(r).runoff!.sort()).toEqual(["p3", "p4"]);
    expect(() => w(r, { type: "vote", target: "p1" }, "p2")).toThrow(/Stichwahl/);
    r = w(r, { type: "vote", target: "p4" }, "p2");
    r = w(r, { type: "closeVote" }, "p1");
    expect(g(r).winner).toBe("dorf");
  });

  it("Seherin sieht nur gut/böse", () => {
    let r = start(6, { aura: true });
    r = withRoles(r, { p1: "urwolf", p2: "seherin", p3: "dorf", p4: "jaeger", p5: "dorf", p6: "dorf" });
    r = w(r, { type: "startNight" });
    while (g(r).pending[0] !== "seherin") {
      if (g(r).pending[0] === "werwolf") r = w(r, { type: "wolf", target: "p3" });
      if (g(r).pending[0] === "urwolf") r = w(r, { type: "infect", yes: false });
      r = w(r, { type: "next" });
    }
    r = w(r, { type: "see", target: "p1" });
    expect(g(r).seer.at(-1)!.role).toBe("werwolf");
  });

  it("Erste Nacht ohne Opfer", () => {
    let r = start(5, { peaceful: true });
    r = w(r, { type: "startNight" });
    expect(g(r).pending).not.toContain("werwolf");
  });

  it("Hexe darf sich nach Hausregel nicht selbst heilen", () => {
    let r = start(5, { selfHeal: false });
    r = withRoles(r, { p1: "werwolf", p2: "hexe", p3: "dorf", p4: "dorf", p5: "dorf" });
    r = w(r, { type: "startNight" });
    r = w(r, { type: "next" });
    r = w(w(r, { type: "wolf", target: "p2" }), { type: "next" });
    expect(() => w(r, { type: "witch", heal: true, poison: null })).toThrow(/Hausregeln/);
  });

  it("Eigene Karten: Spielleiter ordnet zu, online wählt jeder seine Karte", () => {
    let r = start(5, { cards: "own" });
    expect(g(r).phase).toBe("assign");
    expect(() => w(r, { type: "assignDone" })).toThrow(/Werwolf/);
    r = w(r, { type: "assign", id: "p3", role: "werwolf" });
    r = w(r, { type: "assign", id: "p1", role: "seherin" });
    r = w(r, { type: "assignDone" });
    expect(g(r).phase).toBe("night");
    expect(g(r).roles).toMatchObject({ p1: "seherin", p3: "werwolf", p2: "dorf" });

    let o = start(5, { cards: "own" }, true);
    for (const [id, role] of [["p1", "dorf"], ["p2", "werwolf"], ["p3", "hexe"], ["p4", "dorf"]] as const) o = w(o, { type: "claim", role }, id);
    expect(g(o).phase).toBe("assign");
    o = w(o, { type: "claim", role: "dorf" }, "p5");
    expect(g(o).phase).toBe("night");
    expect(g(o).roles.p3).toBe("hexe");
  });

  it("Dieb tauscht mit einer übrigen Karte", () => {
    let r = start(5, { dieb: true });
    r = { ...r, game: { ...g(r), roles: { p1: "dieb", p2: "werwolf", p3: "dorf", p4: "dorf", p5: "dorf" }, extra: ["seherin", "dorf"] as Role[] } };
    r = w(r, { type: "startNight" });
    r = w(r, { type: "next" });
    expect(g(r).pending[0]).toBe("dieb");
    r = w(r, { type: "steal", pick: 0 });
    expect(g(r).roles.p1).toBe("seherin");
    expect(g(r).extra).toEqual(["dieb", "dorf"]);
  });

  it("Weißer Werwolf gewinnt nur allein", () => {
    const s = g(start(5));
    expect(checkWinner({ ...s, roles: { a: "weisserwolf", b: "dorf" }, alive: { a: true, b: false }, lovers: null, winner: null })).toBe("weisserwolf");
    expect(checkWinner({ ...s, roles: { a: "weisserwolf", b: "werwolf", c: "dorf" }, alive: { a: true, b: true, c: true }, lovers: null, winner: null })).toBeNull();
  });

  it("Flötenspieler verzaubert und gewinnt, wenn alle verzaubert sind", () => {
    let r = start(5, { floetenspieler: true });
    r = withRoles(r, { p1: "werwolf", p2: "floetenspieler", p3: "dorf", p4: "dorf", p5: "dorf" });
    r = w(r, { type: "startNight" });
    r = w(r, { type: "next" });
    r = w(w(r, { type: "wolf", target: "p5" }), { type: "next" });
    r = w(r, { type: "enchant", a: "p1", b: "p3" });
    r = w(w(r, { type: "next" }), { type: "next" });
    expect(g(r).enchanted.sort()).toEqual(["p1", "p3"]);
    r = w(r, { type: "lynch", target: null });
    r = w(r, { type: "next" });
    r = w(w(r, { type: "wolf", target: "p3" }), { type: "next" });
    expect(() => w(r, { type: "enchant", a: "p1", b: "p4" })).toThrow(/verzaubert/);
    r = w(r, { type: "enchant", a: "p4" });
    r = w(w(r, { type: "next" }), { type: "next" });
    expect(g(r).winner).toBe("floete");
  });

  it("Engel gewinnt, wenn er am ersten Tag verurteilt wird", () => {
    let r = start(5, { engel: true });
    r = withRoles(r, { p1: "werwolf", p2: "engel", p3: "dorf", p4: "dorf", p5: "dorf" });
    r = w(r, { type: "startNight" });
    r = w(r, { type: "next" });
    r = w(w(r, { type: "wolf", target: "p5" }), { type: "next" });
    r = w(r, { type: "lynch", target: "p2" });
    expect(g(r).winner).toBe("engel");
  });
});

describe("Randfälle", () => {
  it("Leben nur noch Wölfe samt weißem Werwolf, hängt die Nacht nicht", () => {
    let r = start(5, { weisserwolf: true, wolves: "2" });
    r = { ...r, game: { ...g(r), roles: { p1: "weisserwolf", p2: "werwolf", p3: "dorf", p4: "dorf", p5: "dorf" }, alive: { p1: true, p2: true, p3: false, p4: false, p5: false } } };
    r = w(r, { type: "startNight" });
    expect(g(r).pending).not.toContain("werwolf");
    while (g(r).phase === "night") r = w(r, { type: "next" });
    expect(g(r).phase).toBe("day");
  });
});
