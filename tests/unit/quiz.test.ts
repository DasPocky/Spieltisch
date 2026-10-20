import { afterEach, describe, expect, it, vi } from "vitest";
import { POINTS, frageOf, katsFor, type QState } from "@shared/games/quiz/logic";
import { KATEGORIEN } from "@shared/games/quiz/fragen";
import { isFolge, isWahl, isZahl } from "@shared/games/quiz/fragen/typen";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as QState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "quiz" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Nur eine Art Fragen */
const only = (kind: "wahl" | "zahl" | "folge") => ({ art_wahl: kind === "wahl", art_zahl: kind === "zahl", art_folge: kind === "folge" });
const ids = (r: RoomState) => g(r).order;

afterEach(() => vi.useRealTimers());

describe("Quiz & Schätzen – Fragen", () => {
  it("Sammlung: genug Fragen, gültige Form, keine doppelten", () => {
    const all = KATEGORIEN.flatMap((k) => k.fragen);
    expect(all.length).toBeGreaterThanOrEqual(1000);
    const seen = new Set<string>();
    for (const k of KATEGORIEN) {
      expect(k.fragen.length).toBeGreaterThanOrEqual(50);
      for (const f of k.fragen) {
        expect(f[0].length).toBeGreaterThan(5);
        expect(f[0].length).toBeLessThanOrEqual(120);
        if (isWahl(f)) {
          expect(new Set(f.slice(1)).size).toBe(4);
          for (const o of f.slice(1) as string[]) expect(o.length).toBeLessThanOrEqual(40);
        } else if (isZahl(f)) expect(Number.isFinite(f[1])).toBe(true);
        else if (isFolge(f)) expect(new Set(f[1]).size).toBe(4);
        else throw new Error(`Unbekannte Form: ${JSON.stringify(f)}`);
        // Kinderfragen laufen nie zusammen mit den anderen – dort darf sich etwas wiederholen
        const key = `${k.stufe === "kinder" ? "k:" : ""}${f[0].toLowerCase()}${isFolge(f) ? f[1].join("|") : ""}`;
        expect(seen.has(key), `doppelt: ${f[0]}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("Kinderquiz nur mit Kinderfragen, sonst ohne; Kategorien abschaltbar", () => {
    expect(katsFor({ level: "kinder" }).every((k) => k.stufe === "kinder")).toBe(true);
    expect(katsFor({ level: "alle" }).some((k) => k.stufe === "kinder")).toBe(false);
    const off = katsFor({ level: "alle", kat_sport: false }).map((k) => k.id);
    expect(off).not.toContain("sport");
  });

  it("Stapel: nur gewählte Arten, keine Frage doppelt", () => {
    const r = start(2, { ...only("zahl"), count: 20 });
    expect(g(r).total).toBe(20);
    expect(new Set(g(r).deck).size).toBe(20);
    for (const id of g(r).deck) expect(isZahl(frageOf(id)!)).toBe(true);
  });
});

describe("Quiz & Schätzen – Ablauf", () => {
  it("Auswahl: Lösung und fremde Antworten bleiben geheim, bis alle geantwortet haben; Tempo zählt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    let r = start(3, only("wahl"));
    const [a, b, c] = ids(r);
    expect(g(r).phase).toBe("ask");
    expect(g(viewRoom(r, a)).key).toBeNull();
    expect(g(viewRoom(r, WATCH_ID)).key).toBeNull();
    expect(g(viewRoom(r, a)).deck).toEqual([]);
    const key = g(r).key as number;
    r = game(r, { type: "answer", value: key }, a);
    // Anna sieht ihre Antwort, Ben und der Fernseher nicht – nur, dass sie geantwortet hat
    expect(g(viewRoom(r, a)).answers[a]).toBe(key);
    expect(g(viewRoom(r, b)).answers[a]).toBeUndefined();
    expect(g(viewRoom(r, WATCH_ID)).answers).toEqual({});
    expect(g(viewRoom(r, WATCH_ID)).answered).toEqual([a]);
    // Punkte erst beim Auflösen – sonst verrät der Stand, wer richtig lag
    expect(g(r).scores[a]).toBe(0);
    expect(() => game(r, { type: "answer", value: 0 }, a)).toThrow();
    vi.setSystemTime(1_000_000 + g(r).seconds * 500);
    r = game(r, { type: "answer", value: (key + 1) % 4 }, b);
    r = game(r, { type: "answer", value: key }, c);
    expect(g(r).phase).toBe("reveal");
    expect(g(r).scores[a]).toBe(POINTS.right + POINTS.fast);
    expect(g(r).scores[b]).toBe(0);
    expect(g(r).scores[c]).toBe(POINTS.right + POINTS.fast / 2);
    expect(g(viewRoom(r, WATCH_ID)).answers[b]).toBe((key + 1) % 4);
    r = game(r, { type: "next" }, a);
    expect(g(r).idx).toBe(1);
    expect(g(r).phase).toBe("ask");
  });

  it("Schätzen: am nächsten dran gewinnt, gleich nah teilt sich den Platz, genau trifft gibt Bonus", () => {
    let r = start(4, only("zahl"));
    const [a, b, c, d] = ids(r);
    const key = g(r).key as number;
    r = game(r, { type: "answer", value: key }, a);
    r = game(r, { type: "answer", value: key + 10 }, b);
    r = game(r, { type: "answer", value: key - 10 }, c);
    r = game(r, { type: "answer", value: key + 1000 }, d);
    expect(g(r).last!.points).toEqual({ [a]: POINTS.near[0] + POINTS.exact, [b]: POINTS.near[1], [c]: POINTS.near[1] });
  });

  it("Ordnen: Punkte je richtigem Platz", () => {
    let r = start(2, only("folge"));
    const [a, b] = ids(r);
    const key = g(r).key as number[];
    r = game(r, { type: "answer", value: key }, a);
    r = game(r, { type: "answer", value: [key[1], key[0], key[2], key[3]] }, b);
    expect(g(r).last!.points).toEqual({ [a]: 4 * POINTS.slot, [b]: 2 * POINTS.slot });
    expect(() => game(r, { type: "next" }, b)).not.toThrow();
  });

  it("Ungültige Antworten werden abgelehnt", () => {
    const r = start(2, only("folge"));
    expect(() => game(r, { type: "answer", value: 2 }, ids(r)[0])).toThrow();
    expect(() => game(r, { type: "answer", value: [0, 0, 1, 2] }, ids(r)[0])).toThrow();
  });

  it("Nichts bleibt hängen: Zeit ist um, Host löst auf, Überspringen, Spieler geht", () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    let r = start(3, only("wahl"));
    const [a, b, c] = ids(r);
    expect(() => game(r, { type: "timeUp" }, b)).toThrow();
    vi.setSystemTime(2_000_000 + g(r).seconds * 1000);
    r = game(r, { type: "timeUp" }, b);
    expect(g(r).phase).toBe("reveal");
    r = game(r, { type: "next" }, b);
    expect(() => game(r, { type: "reveal" }, b)).toThrow();
    r = game(r, { type: "reveal" }, a);
    r = game(r, { type: "next" }, a);
    // Zwei haben geantwortet, Cem geht – die Frage löst sich auf
    r = game(r, { type: "answer", value: 0 }, a);
    r = game(r, { type: "answer", value: 1 }, b);
    r = act(r, { type: "removePlayer", id: c }, a);
    expect(g(r).phase).toBe("reveal");
  });

  it("Bis zum Ende: Ergebnis mit Sieger", () => {
    let r = start(2, { count: 5 });
    for (let i = 0; i < 5; i++) {
      for (const id of ids(r)) r = game(r, { type: "answer", value: g(r).shown!.kind === "folge" ? [0, 1, 2, 3] : 0 }, id);
      r = game(r, { type: "next" }, ids(r)[0]);
    }
    expect(g(r).phase).toBe("over");
  });

  it("Ein Handy für alle: niemand antwortet am Gerät, man tippt an, wer es hatte", () => {
    let r = start(3, only("wahl"));
    const [a, b] = ids(r);
    expect(() => game(r, { type: "answer", value: 0 })).toThrow();
    r = game(r, { type: "reveal" });
    expect(g(r).phase).toBe("reveal");
    r = game(r, { type: "award", ids: [a, b] });
    expect(g(r).scores[a]).toBe(POINTS.local);
    expect(g(r).scores[b]).toBe(POINTS.local);
    expect(g(r).idx).toBe(1);
  });
});
