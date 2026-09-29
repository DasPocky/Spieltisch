import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreDice, stackCard, type CardId, type TuttoState } from "@shared/games/tutto/logic";
import type { RoomState } from "@shared/platform/room";
import { act, fixDice, game, roomWith } from "./helpers";

afterEach(() => vi.restoreAllMocks());

const g = (r: RoomState) => r.game as TuttoState;
function start(names = ["Anna", "Ben", "Cem"], options: Record<string, string | number | boolean> = {}) {
  let r = roomWith(names);
  r = act(r, { type: "setOption", key: "autoDraw", value: false });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Karte oben auf den Stapel legen und ziehen */
function draw(r: RoomState, card: CardId) {
  return game({ ...r, game: stackCard(g(r), card) }, { type: "draw" });
}
const pts = (r: RoomState, delta: number) => game(r, { type: "addPts", delta });

describe("Würfelwertung", () => {
  it.each([
    [[1], 100], [[5], 50], [[1, 5], 150], [[1, 1, 1], 1000], [[2, 2, 2], 200], [[6, 6, 6], 600],
    [[1, 1, 1, 1], 1100], [[5, 5, 5, 5, 5, 5], 1000], [[2, 2, 2, 1, 5], 350],
  ])("%j → %i", (dice, expected) => expect(scoreDice(dice)).toBe(expected));

  it.each([[[2]], [[1, 2]], [[3, 3]], [[]]])("%j ist nicht wertbar", (dice) => expect(scoreDice(dice)).toBeNull());
});

describe("Echte Würfel", () => {
  it("Punkte eintragen und weitergeben", () => {
    let r = start();
    r = draw(r, "b300");
    r = pts(pts(r, 500), 300);
    r = game(r, { type: "book" });
    expect(g(r).scores.p1).toBe(800);
    expect(g(r).curId).toBe("p2");
    expect(g(r).log).toHaveLength(1);
  });

  it("Niete gibt 0 Punkte", () => {
    let r = draw(start(), "b200");
    r = game(pts(r, 500), { type: "book", zero: true });
    expect(g(r).scores.p1).toBe(0);
    expect(g(r).curId).toBe("p2");
  });

  it("nur erlaubte Punktwerte", () => {
    expect(() => pts(start(), 7)).toThrow(/Ungültiger/);
  });

  it("Bonus gibt es nur über Tutto, danach neue Karte", () => {
    let r = pts(draw(start(), "b300"), 500);
    expect(() => pts(r, 2000)).toThrow(/Ungültiger/);
    expect(() => game(r, { type: "draw" })).toThrow(/nach einem Tutto/);
    r = game(r, { type: "tutto" });
    expect(g(r).turnPts).toBe(800);
    expect(g(r).afterTutto).toBe(true);
    expect(() => pts(r, 100)).toThrow(/neue Karte/);
    r = draw(r, "x2");
    r = game(pts(r, 100), { type: "tutto" });
    expect(g(r).turnPts).toBe(1800);
  });

  it("gesicherte Punkte lassen sich nicht wegkorrigieren", () => {
    let r = game(pts(draw(start(), "b200"), 100), { type: "tutto" });
    r = draw(r, "b400");
    r = game(pts(r, -50), { type: "clearPts" });
    expect(g(r).turnPts).toBe(300);
  });

  it("Pflichtkarten: kein Aufhören und keine Würfelpunkte", () => {
    const r = draw(start(), "street");
    expect(() => pts(r, 100)).toThrow(/zählen/);
    expect(() => game(r, { type: "book" })).toThrow(/nicht aufhören/);
    const done = game(game(r, { type: "tutto" }), { type: "book" });
    expect(g(done).scores.p1).toBe(2000);
  });

  it("Stopp: nichts eintippen, keine neue Karte", () => {
    const r = draw(start(), "stop");
    expect(() => pts(r, 100)).toThrow(/Stopp/);
    expect(() => game(r, { type: "draw" })).toThrow(/Stopp/);
    expect(() => game(r, { type: "tutto" })).toThrow(/Stopp/);
  });

  it("Feuerwerk: Niete behält die Punkte", () => {
    let r = pts(draw(start(), "fire"), 500);
    r = game(r, { type: "book", zero: true });
    expect(g(r).scores.p1).toBe(500);
  });

  it("Plus/Minus zieht dem Führenden 1.000 ab", () => {
    let r = start();
    r = game(pts(pts(draw(r, "b200"), 1000), 1000), { type: "book" }); // Anna 2000
    r = game(game(draw(r, "pm"), { type: "tutto" }), { type: "book" }); // Ben 1000, Anna −1000
    expect(g(r).scores).toMatchObject({ p1: 1000, p2: 1000 });
    expect(g(r).log.at(-1)!.penalized).toEqual(["p1"]);
    r = game(r, { type: "undo" });
    expect(g(r).scores).toMatchObject({ p1: 2000, p2: 0 });
    expect(g(r).curId).toBe("p2");
  });

  it("Plus/Minus ohne Tutto bestraft niemanden", () => {
    let r = start();
    r = game(pts(draw(r, "b200"), 1000), { type: "book" });
    r = game(pts(draw(r, "b200"), 100), { type: "tutto" });
    r = game(draw(r, "pm"), { type: "book" }); // frisch nach Tutto aufgehört
    expect(g(r).scores).toMatchObject({ p1: 1000, p2: 300 });
  });

  it("automatisch aufdecken: zu Zugbeginn und nach Tutto", () => {
    let r = act(roomWith(["Anna", "Ben"]), { type: "start" });
    expect(g(r).turnCards).toHaveLength(1);
    r = { ...r, game: { ...g(r), turnCards: ["b200"], cardStart: 0 } };
    r = game(pts(r, 100), { type: "tutto" });
    expect(g(r).turnCards).toHaveLength(2);
    expect(g(r).cardStart).toBe(300);
    r = game(r, { type: "book" });
    expect(g(r).scores.p1).toBe(300);
    expect(g(r).curId).toBe("p2");
    expect(g(r).turnCards).toHaveLength(1);
  });

  it("Sieg beim Erreichen des Spielziels", () => {
    let r = start(["Anna", "Ben"], { target: 1000 });
    r = game(pts(draw(r, "b200"), 1000), { type: "book" });
    expect(g(r).winnerId).toBe("p1");
    expect(() => game(r, { type: "draw" })).toThrow(/entschieden/);
    r = game(r, { type: "undo" });
    expect(g(r).winnerId).toBeNull();
  });

  it("Kleeblatt gewinnt nach zwei Tuttos", () => {
    let r = draw(start(), "clover");
    expect(() => game(r, { type: "book" })).toThrow(/nicht aufhören/);
    r = game(r, { type: "tutto" });
    expect(g(r).winnerId).toBeNull();
    r = game(r, { type: "tutto" });
    expect(g(r).winnerId).toBe("p1");
    expect(g(r).cloverWin).toBe(true);
  });

  it("leerer Stapel wird neu gemischt", () => {
    let r = start();
    r = { ...r, game: { ...g(r), pile: [] } };
    r = game(r, { type: "draw" });
    expect(g(r).pile).toHaveLength(55);
  });
});

describe("App-Würfel", () => {
  const app = () => start(["Anna", "Ben"], { diceMode: "app" });

  it("Torte: nur passende Würfel, 1.500 bei Erfolg", () => {
    let r = draw(start(["Anna", "Ben"], { diceMode: "app", torte: true }), "torte");
    fixDice([4, 4, 4, 5, 5, 1]);
    r = game(r, { type: "roll" });
    r = game(r, { type: "toggleDie", i: 0 });
    expect(() => game(r, { type: "roll" })).toThrow(/Torte/);
    for (let i = 1; i < 6; i++) r = game(r, { type: "toggleDie", i });
    r = game(r, { type: "roll" });
    expect(g(r).turnPts).toBe(1500);
  });

  it("Torte: Wurf ohne passende Würfel ist eine Niete", () => {
    let r = draw(start(["Anna", "Ben"], { diceMode: "app", torte: true }), "torte");
    fixDice([5, 5, 5, 3, 1, 1]);
    r = game(r, { type: "roll" });
    for (const i of [0, 1, 2]) r = game(r, { type: "toggleDie", i });
    fixDice([1, 3, 3]);
    r = game(r, { type: "roll" });
    expect(g(r).dice!.bust).toBe(false); // 1 passt noch
    r = game(r, { type: "toggleDie", i: 0 });
    fixDice([2, 3]);
    r = game(r, { type: "roll" });
    expect(g(r).dice!.bust).toBe(true);
  });

  it("nach Tutto automatisch neue Karte, sichere Punkte eintragbar", () => {
    let r = draw(start(["Anna", "Ben"], { diceMode: "app" }), "b300");
    r = act(r, { type: "setOption", key: "autoDraw", value: true });
    fixDice([1, 1, 1, 5, 5, 5]);
    r = game(r, { type: "roll" });
    for (let i = 0; i < 6; i++) r = game(r, { type: "toggleDie", i });
    r = { ...r, game: stackCard(g(r), "street") };
    r = game(r, { type: "roll" });
    expect(g(r).turnCards).toEqual(["b300", "street"]);
    expect(g(r).turnPts).toBe(1800);
    r = game(r, { type: "book" });
    expect(g(r).scores.p1).toBe(1800);
  });

  it("würfeln, auswählen, eintragen", () => {
    let r = draw(app(), "b300");
    fixDice([1, 5, 2, 3, 4, 6]);
    r = game(r, { type: "roll" });
    expect(g(r).dice!.roll).toEqual([1, 5, 2, 3, 4, 6]);
    expect(() => game(r, { type: "book" })).toThrow(/wertbare/);
    r = game(game(r, { type: "toggleDie", i: 0 }), { type: "toggleDie", i: 1 });
    r = game(r, { type: "book" });
    expect(g(r).scores.p1).toBe(150);
    expect(g(r).curId).toBe("p2");
  });

  it("Niete beendet den Zug ohne Punkte", () => {
    let r = draw(app(), "b300");
    fixDice([2, 3, 4, 6, 2, 3]);
    r = game(r, { type: "roll" });
    expect(g(r).dice!.bust).toBe(true);
    r = game(r, { type: "book" });
    expect(g(r).scores.p1).toBe(0);
  });

  it("Tutto mit Bonus, danach neue Karte", () => {
    let r = draw(app(), "b300");
    fixDice([1, 1, 1, 5, 5, 5]);
    r = game(r, { type: "roll" });
    for (let i = 0; i < 6; i++) r = game(r, { type: "toggleDie", i });
    r = game(r, { type: "roll" });
    expect(g(r).dice!.tutto).toBe(true);
    expect(g(r).turnPts).toBe(1000 + 500 + 300);
    r = draw(r, "b200");
    expect(g(r).turnCards).toEqual(["b300", "b200"]);
  });

  it("Karten mit Pflicht zum Weiterspielen", () => {
    let r = draw(app(), "fire");
    fixDice([1, 2, 3, 4, 6, 2]);
    r = game(game(r, { type: "roll" }), { type: "toggleDie", i: 0 });
    expect(() => game(r, { type: "book" })).toThrow(/nicht aufhören/);
  });

  it("Feuerwerk: Niete behält die Punkte", () => {
    let r = draw(app(), "fire");
    fixDice([1, 2, 3, 4, 6, 2, /* Rest */ 2, 3, 4, 6, 2]);
    r = game(game(r, { type: "roll" }), { type: "toggleDie", i: 0 });
    r = game(r, { type: "roll" });
    expect(g(r).dice!.bust).toBe(true);
    r = game(r, { type: "book" });
    expect(g(r).scores.p1).toBe(100);
  });

  it("Straße: nur neue Zahlen, 2.000 bei Erfolg", () => {
    let r = draw(app(), "street");
    fixDice([1, 2, 3, 4, 5, 6]);
    r = game(r, { type: "roll" });
    for (let i = 0; i < 6; i++) r = game(r, { type: "toggleDie", i });
    r = game(r, { type: "roll" });
    expect(g(r).turnPts).toBe(2000);
  });

  it("Kleeblatt: zwei Tuttos gewinnen", () => {
    let r = draw(app(), "clover");
    fixDice([1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5]);
    for (let t = 0; t < 2; t++) {
      r = game(r, { type: "roll" });
      for (let i = 0; i < 6; i++) r = game(r, { type: "toggleDie", i });
      r = game(r, { type: "roll" });
    }
    expect(g(r).winnerId).toBe("p1");
    expect(g(r).cloverWin).toBe(true);
  });

  it("Stopp-Karte: nicht würfeln", () => {
    const r = draw(app(), "stop");
    expect(() => game(r, { type: "roll" })).toThrow(/Stopp/);
  });

  it("Würfelmodus wechseln setzt den Wurf zurück", () => {
    let r = draw(app(), "b300");
    fixDice([1, 2, 3, 4, 6, 2]);
    r = game(r, { type: "roll" });
    r = act(r, { type: "setOption", key: "diceMode", value: "real" });
    expect(g(r).dice).toBeNull();
  });
});

describe("Spieler während der Partie", () => {
  it("Entfernen des Spielers am Zug gibt an den Nächsten weiter", () => {
    let r = pts(draw(start(), "b300"), 500);
    r = act(r, { type: "removePlayer", id: "p1" });
    expect(g(r).curId).toBe("p2");
    expect(g(r).turnPts).toBe(0);
    expect(r.hostId).toBe("p2");
  });

  it("Letzten Spieler entfernen führt zurück in die Lobby", () => {
    const r = act(start(["Anna"]), { type: "removePlayer", id: "p1" });
    expect(r.phase).toBe("lobby");
  });

  it("Beitritt mitten im Spiel startet mit 0 Punkten und kommt in die Reihe", () => {
    let r = start(["Anna"]);
    r = { ...r, players: [...r.players, { id: "p9", name: "Neu" }] };
    r = game(r, { type: "book" });
    expect(g(r).curId).toBe("p9");
  });
});
