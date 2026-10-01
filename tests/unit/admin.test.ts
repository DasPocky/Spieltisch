import { describe, expect, it } from "vitest";
import { GAMES, isGameId } from "@shared/games";
import { countStat, emptySiteStats, isoWeek, sanitizeConfig, sanitizeDefaults, STAT_WEEKS, sumStats, withDefaults } from "@shared/platform/access";
import { createRoom } from "@shared/platform/room";

const defs = (id: string) => (isGameId(id) ? GAMES[id].settings : undefined);
const DAY = 86_400_000;

describe("Admin", () => {
  it("Freigaben: Unbekanntes fällt raus", () => {
    expect(sanitizeConfig({ site: "x", games: { tutto: "off", nope: "off", kniffel: "on" }, message: 3 }, Object.keys(GAMES)))
      .toEqual({ site: "on", games: { tutto: "off" }, message: "" });
  });

  it("Standards: nur bekannte Spiele/Einstellungen, geprüft, ohne eingebaute Werte", () => {
    const d = sanitizeDefaults({
      tutto: { target: 12_345, torte: true, diceMode: "real", unknown: 1 },
      kniffel: { diceMode: "quatsch" },
      nope: { a: 1 },
    }, defs);
    // 12345 → auf Schrittweite 1000 gerundet; diceMode „real“ ist eingebaut und fällt weg
    expect(d).toEqual({ tutto: { target: 12_000, torte: true } });
    expect(sanitizeDefaults("x", defs)).toEqual({});
  });

  it("Standards ersetzen nur die eingebauten Werte", () => {
    const room = createRoom("tutto");
    const o = withDefaults(GAMES.tutto.settings, room.options, { target: 99_999_999, torte: true, fremd: 1 });
    expect(o.target).toBe(50_000);
    expect(o.torte).toBe(true);
    expect(o.fremd).toBeUndefined();
    expect(withDefaults(GAMES.tutto.settings, room.options, undefined)).toBe(room.options);
  });

  it("ISO-Kalenderwoche", () => {
    expect(isoWeek(Date.UTC(2026, 9, 1))).toBe("2026-W40");
    expect(isoWeek(Date.UTC(2021, 0, 3))).toBe("2020-W53");
    expect(isoWeek(Date.UTC(2024, 11, 30))).toBe("2025-W01");
  });

  it("Statistik: pro Woche und insgesamt, höchstens zwölf Wochen", () => {
    const t0 = Date.UTC(2026, 0, 5);
    let s = emptySiteStats(t0);
    s = countStat(s, "tutto", "rooms", t0);
    s = countStat(s, "tutto", "started", t0);
    s = countStat(s, "tutto", "started", t0 + DAY);
    s = countStat(s, "kniffel", "local", t0);
    expect(s.weeks).toHaveLength(1);
    expect(s.totals.tutto).toEqual({ rooms: 1, started: 2 });
    expect(sumStats(s.totals)).toEqual({ rooms: 1, started: 2, finished: 0, local: 1 });
    for (let i = 1; i <= 20; i++) s = countStat(s, "tutto", "finished", t0 + i * 7 * DAY);
    expect(s.weeks).toHaveLength(STAT_WEEKS);
    expect(s.weeks[0].week).toBe(isoWeek(t0 + 20 * 7 * DAY));
    expect(s.totals.tutto.finished).toBe(20);
  });
});
