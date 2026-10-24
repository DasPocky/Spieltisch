import { describe, expect, it } from "vitest";
import { bookOf, kindAt, kritzelpost, MAX_INK, pagesPer, type KState } from "@shared/games/kritzelpost/logic";
import { encodePoints } from "@shared/games/zeichnen/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { GameError, type GameContext } from "@shared/platform/types";
import { act, game, roomWith } from "./helpers";

const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil", "Fee", "Gabi", "Hugo"];
const g = (r: RoomState) => r.game as KState;
function start(n = 3, options: Record<string, string | number | boolean> = {}, online = true) {
  let r = act(roomWith(NAMES.slice(0, n)), { type: "selectGame", gameId: "kritzelpost" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" }, online ? "p1" : null);
}
const line = encodePoints([[0.1, 0.1], [0.9, 0.9]]);
/** Jeder Aktive macht seinen Schritt (Satz oder Strich + Fertig) */
function stepAll(r: RoomState, text = (id: string) => `Satz von ${id} in Schritt ${g(r).round}`) {
  const s = g(r);
  for (const id of s.order.filter((x) => !s.left.includes(x) && !s.done.includes(x))) {
    if (kindAt(g(r)) === "text") r = game(r, { type: "write", text: text(id) }, id);
    else { r = game(r, { type: "stroke", c: 1, w: 1, p: line }, id); r = game(r, { type: "done" }, id); }
  }
  return r;
}
const ctx = (ids: string[], now = 0): GameContext => ({ players: ids.map((id) => ({ id, name: id })), hostId: ids[0], actorId: ids[0], options: { mode: "normal", clock: "90" }, now });

describe("Kritzelpost", () => {
  it("Zuteilung für 3–8 Spieler: jede Seite jeder Kette von genau einem, die eigene Kette nur in Schritt 0", () => {
    for (let n = 3; n <= 8; n++) {
      let s = kritzelpost.setup(ctx(Array.from({ length: n }, (_, i) => `p${i}`)));
      expect(s.turns).toBe(n);
      for (let k = 0; k < s.turns; k++) {
        const books = s.order.map((id) => bookOf(s, id, k));
        expect(new Set(books).size, `n=${n} k=${k}`).toBe(n);
        s.order.forEach((id, j) => { if (k > 0) expect(books[j], `n=${n}: ${id} bekommt seine Kette zurück`).not.toBe(j); });
      }
      // ganze Partie: jedes Heft hat von jedem genau eine Seite, abwechselnd Satz und Zeichnung
      for (let k = 0; k < n; k++) {
        for (const id of s.order) {
          s = kritzelpost.apply(s, kindAt(s) === "text" ? { type: "write", text: `${id}:${k}` } : { type: "done" }, { ...ctx(s.order), actorId: id });
        }
      }
      expect(s.phase).toBe("album");
      s.books.forEach((b, i) => {
        expect(b).toHaveLength(n);
        expect(new Set(b.map((p) => p.by)).size).toBe(n);
        expect(b[0].by).toBe(s.order[i]);
        b.forEach((p, k) => expect(p.kind).toBe(k % 2 === 0 ? "text" : "draw"));
      });
    }
  });

  it("Sicht: jeder sieht nur die Vorgängerseite, der Fernseher nur den Fortschritt", () => {
    let r = start(4);
    r = stepAll(r);
    const s = g(r);
    expect(kindAt(s)).toBe("draw");
    for (const id of s.order) {
      const v = viewRoom(r, id).game as KState;
      expect(v.books.flat()).toEqual([]);
      const from = s.order[(s.order.indexOf(id) + 3) % 4];
      expect(v.task?.text).toBe(`Satz von ${from} in Schritt 0`);
      expect(JSON.stringify(v)).not.toContain(`Satz von ${id} in`);
    }
    const tv = viewRoom(r, WATCH_ID).game as KState;
    expect(JSON.stringify(tv)).not.toContain("Satz von");
    expect(tv.task).toBe(null);
    // Entwürfe: nur der eigene
    r = game(r, { type: "stroke", c: 2, w: 0, p: line }, "p1");
    expect(Object.keys((viewRoom(r, "p2").game as KState).drafts)).toEqual([]);
    expect((viewRoom(r, "p1").game as KState).drafts.p1).toHaveLength(1);
    expect((viewRoom(r, WATCH_ID).game as KState).drafts).toEqual({});
  });

  it("Nicht doppelt abgeben, nicht das Falsche tun, Größe begrenzt", () => {
    let r = start(3);
    r = game(r, { type: "write", text: "Hallo Welt" }, "p1");
    expect(() => game(r, { type: "write", text: "Nochmal" }, "p1")).toThrow(GameError);
    expect(() => game(r, { type: "stroke", c: 0, w: 0, p: line }, "p2")).toThrow(GameError);
    expect(() => game(r, { type: "write", text: "x" }, "fremd")).toThrow(GameError);
    r = stepAll(r);
    expect(() => game(r, { type: "write", text: "jetzt nicht" }, "p1")).toThrow(GameError);
    expect(() => game(r, { type: "stroke", c: 99, w: 0, p: line }, "p1")).toThrow(GameError);
    expect(() => game(r, { type: "stroke", c: 0, w: 0, p: "!!!!" }, "p1")).toThrow(GameError);
    const big = encodePoints(Array.from({ length: 400 }, (_, i) => [i / 400, 0.5] as [number, number]));
    let full = r;
    let n = 0;
    try { for (;;) { full = game(full, { type: "stroke", c: 0, w: 0, p: big }, "p1"); n++; } } catch (e) { expect(e).toBeInstanceOf(GameError); }
    expect(n * big.length).toBeLessThanOrEqual(MAX_INK);
  });

  it("Zeit um: Fehlendes wird leer, Entwürfe zählen, es geht weiter", () => {
    let r = start(3);
    expect(() => game(r, { type: "timeUp" }, "p2")).toThrow(GameError);
    r = game(r, { type: "write", text: "Ein Satz" }, "p1");
    const s0 = g(r);
    const later = kritzelpost.apply(s0, { type: "timeUp" }, { ...ctx(s0.order, s0.startedAt! + 91_000), actorId: "p2" });
    expect(later.round).toBe(1);
    expect(later.books[0][0]).toMatchObject({ by: "p1", text: "Ein Satz" });
    expect(later.books[1][0]).toMatchObject({ by: "p2", empty: true });
    // Zeichnen: Entwurf von p2 zählt, p3 bleibt leer
    let s = kritzelpost.apply(later, { type: "stroke", c: 0, w: 1, p: line }, { ...ctx(later.order, later.startedAt!), actorId: "p2" });
    s = kritzelpost.apply(s, { type: "timeUp" }, { ...ctx(s.order, s.startedAt! + 91_000), actorId: "p1" });
    expect(s.books[bookOf(s, "p2", 1)][1]).toMatchObject({ by: "p2", kind: "draw", strokes: [{ p: line }] });
    expect(s.books[bookOf(s, "p3", 1)][1]).toMatchObject({ by: "p3", empty: true });
    // leerer Satz = leere Seite
    s = kritzelpost.apply(s, { type: "write", text: "   " }, { ...ctx(s.order), actorId: "p1" });
    expect(s.books[bookOf(s, "p1", 2)][2]).toMatchObject({ by: "p1", empty: true });
  });

  it("Aussteiger wird übersprungen, Host kann weiter erzwingen, unter zwei Spielern gleich ins Album", () => {
    let r = start(4);
    r = game(r, { type: "write", text: "A" }, "p1");
    r = game(r, { type: "write", text: "B" }, "p2");
    r = game(r, { type: "write", text: "C" }, "p3");
    r = act(r, { type: "removePlayer", id: "p4" }, "p1");
    expect(g(r).round).toBe(1);
    expect(g(r).books[3][0]).toMatchObject({ by: "p4", empty: true, gone: true });
    // Host: weiter ohne die Fehlenden
    r = game(r, { type: "done" }, "p1");
    r = act(r, { type: "skip" }, "p1");
    expect(g(r).round).toBe(2);
    // in jedem weiteren Schritt bleibt p4 leer
    r = stepAll(r);
    expect(g(r).books[bookOf(g(r), "p4", 2)][2]).toMatchObject({ by: "p4", gone: true });
    r = act(r, { type: "removePlayer", id: "p3" }, "p1");
    r = act(r, { type: "removePlayer", id: "p2" }, "p1");
    expect(g(r).phase).toBe("album");
    expect(g(r).books.every((b) => b.length === pagesPer(g(r)))).toBe(true);
  });

  it("Album: Host blättert Kette für Kette, Seiten erst sichtbar, wenn aufgeschlagen; am Ende vorbei", () => {
    let r = start(3);
    for (let k = 0; k < 3; k++) r = stepAll(r);
    expect(g(r).phase).toBe("album");
    expect(() => game(r, { type: "page", dir: 1 }, "p2")).toThrow(GameError);
    const v = viewRoom(r, "p2").game as KState;
    expect(v.books.map((b) => b.length)).toEqual([1, 0, 0]);
    expect((viewRoom(r, WATCH_ID).game as KState).books.map((b) => b.length)).toEqual([1, 0, 0]);
    for (let i = 0; i < 8; i++) r = game(r, { type: "page", dir: 1 }, "p1");
    expect(g(r).book).toBe(2);
    expect(g(r).page).toBe(2);
    r = game(r, { type: "page", dir: -1 }, "p1");
    expect(g(r).page).toBe(1);
    r = game(r, { type: "page", dir: 1 }, "p1");
    r = game(r, { type: "page", dir: 1 }, "p1");
    expect(g(r).phase).toBe("over");
    expect((viewRoom(r, "p2").game as KState).books.flat()).toHaveLength(9);
  });

  it("Eisbrecher: alle zeichnen zuerst denselben Satz, Ketten bleiben getrennt", () => {
    let r = start(4, { mode: "eisbrecher" });
    const s = g(r);
    expect(kindAt(s)).toBe("draw");
    const first = s.books[0][0].text!;
    expect(first).toBeTruthy();
    expect(s.books.every((b) => b[0].by === null && b[0].text === first)).toBe(true);
    for (const id of s.order) expect((viewRoom(r, id).game as KState).task?.text).toBe(first);
    expect(JSON.stringify(viewRoom(r, WATCH_ID).game)).not.toContain(first);
    for (let k = 0; k < 4; k++) r = stepAll(r);
    expect(g(r).phase).toBe("album");
    expect(g(r).books.every((b) => b.length === 5 && new Set(b.slice(1).map((p) => p.by)).size === 4)).toBe(true);
  });

  it("Ein Handy für alle: ohne Uhr, Abgabe je Spieler", () => {
    let r = start(3, {}, false);
    expect(g(r).seconds).toBe(0);
    expect(() => game(r, { type: "write", text: "x" })).toThrow(GameError);
    for (const id of ["p1", "p2", "p3"]) r = game(r, { type: "write", text: `von ${id}`, player: id });
    expect(g(r).round).toBe(1);
  });
});
