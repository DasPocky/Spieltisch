import { describe, expect, it } from "vitest";
import { GAMES, isGameId } from "@shared/games";
import { sanitizeConfig, orderGames, sanitizeDefaults, withDefaults } from "@shared/platform/access";
import { countFeature, countStat, emptySiteStats, slotOf, isoWeek, STAT_WEEKS, sumStats } from "@shared/platform/admin";
import { createRoom } from "@shared/platform/room";

const defs = (id: string) => (isGameId(id) ? GAMES[id].settings : undefined);
const DAY = 86_400_000;

describe("Admin", () => {
  it("Freigaben: Unbekanntes fällt raus", () => {
    expect(sanitizeConfig({ site: "x", games: { alles: "off", nope: "off", fuenfwuerfel: "on" }, message: 3 }, Object.keys(GAMES)))
      .toMatchObject({ site: "on", games: { alles: "off" }, message: "" });
  });

  it("Look: Standard Papierschnitt, nur bekannte Looks", () => {
    expect(sanitizeConfig({}, Object.keys(GAMES)).look).toBe("papier");
    expect(sanitizeConfig({ look: "kreide" }, Object.keys(GAMES)).look).toBe("kreide");
    expect(sanitizeConfig({ look: "pink" }, Object.keys(GAMES)).look).toBe("papier");
  });

  it("Optionen: Grenzen begrenzt, unbekannte Spiele raus, Funktionen standardmäßig an", () => {
    const c = sanitizeConfig({
      limits: { roomHours: 9999, maxPlayers: 1, maxRooms: -5 }, featured: ["dame", "nope", "dame"], order: ["ludo", 3, "alles"],
      features: { online: false, call: "x" }, banner: "Hallo", archiveDays: 0,
    }, Object.keys(GAMES));
    expect(c.limits).toEqual({ roomHours: 336, maxPlayers: 2, maxRooms: 0 });
    expect(c.featured).toEqual(["dame"]);
    expect(c.order).toEqual(["ludo", "alles"]);
    expect(c.features).toEqual({ online: false, call: true, groups: true, profiles: true, local: false, offline: false, ai: false, recording: true, sets: true });
    expect(sanitizeConfig({ features: { local: true, offline: true } }, Object.keys(GAMES)).features).toMatchObject({ local: true, offline: true });
    expect(c.banner).toBe("Hallo");
    expect(c.archiveDays).toBe(1);
    expect(orderGames(["alles", "fuenfwuerfel", "ludo"], ["ludo", "gibtsnicht"])).toEqual(["ludo", "alles", "fuenfwuerfel"]);
  });

  it("Standards: nur bekannte Spiele/Einstellungen, geprüft, ohne eingebaute Werte", () => {
    const d = sanitizeDefaults({
      alles: { target: 12_345, torte: true, diceMode: "real", unknown: 1 },
      fuenfwuerfel: { diceMode: "quatsch" },
      nope: { a: 1 },
    }, defs);
    // 12345 → auf Schrittweite 1000 gerundet; diceMode „real“ ist eingebaut und fällt weg
    expect(d).toEqual({ alles: { target: 12_000, torte: true } });
    expect(sanitizeDefaults("x", defs)).toEqual({});
  });

  it("Standards ersetzen nur die eingebauten Werte", () => {
    const room = createRoom("alles");
    const o = withDefaults(GAMES.alles.settings, room.options, { target: 99_999_999, torte: true, fremd: 1 });
    expect(o.target).toBe(50_000);
    expect(o.torte).toBe(true);
    expect(o.fremd).toBeUndefined();
    expect(withDefaults(GAMES.alles.settings, room.options, undefined)).toBe(room.options);
  });

  it("ISO-Kalenderwoche", () => {
    expect(isoWeek(Date.UTC(2026, 9, 1))).toBe("2026-W40");
    expect(isoWeek(Date.UTC(2021, 0, 3))).toBe("2020-W53");
    expect(isoWeek(Date.UTC(2024, 11, 30))).toBe("2025-W01");
  });

  it("Statistik: pro Woche und insgesamt, höchstens zwölf Wochen", () => {
    const t0 = Date.UTC(2026, 0, 5);
    let s = emptySiteStats(t0);
    s = countStat(s, "alles", "rooms", t0);
    s = countStat(s, "alles", "started", t0);
    s = countStat(s, "alles", "started", t0 + DAY);
    s = countStat(s, "fuenfwuerfel", "local", t0);
    expect(s.weeks).toHaveLength(1);
    expect(s.totals.alles).toEqual({ rooms: 1, started: 2 });
    expect(sumStats(s.totals)).toEqual({ rooms: 1, started: 2, finished: 0, local: 1, players: 0 });
    // Tage: neuester zuerst
    expect(s.days?.[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i <= 20; i++) s = countStat(s, "alles", "finished", t0 + i * 7 * DAY);
    expect(s.weeks).toHaveLength(STAT_WEEKS);
    expect(s.weeks[0].week).toBe(isoWeek(t0 + 20 * 7 * DAY));
    expect(s.totals.alles.finished).toBe(20);
  });

  it("Spitzenzeiten nach deutscher Zeit, Funktionen pro Tag", () => {
    // Freitag, 2. Oktober 2026, 18:30 UTC = 20:30 Sommerzeit
    const fri = Date.UTC(2026, 9, 2, 18, 30);
    expect(slotOf(fri)).toBe("4-20");
    // Montag, 5. Januar 2026, 23:30 UTC = Dienstag 0:30 Winterzeit
    expect(slotOf(Date.UTC(2026, 0, 5, 23, 30))).toBe("1-0");
    let s = emptySiteStats(fri);
    s = countStat(s, "alles", "started", fri);
    s = countStat(s, "alles", "local", fri);
    s = countStat(s, "alles", "rooms", fri);
    expect(s.days?.[0].slots).toEqual({ "4-20": 2 });
    s = countFeature(s, "chat", fri);
    s = countFeature(s, "chat", fri);
    s = countFeature(s, "video", fri + DAY);
    expect(s.days?.[1].features).toEqual({ chat: 2 });
    expect(s.days?.[0].features).toEqual({ video: 1 });
    // Unbekanntes wird nicht gezählt
    expect(countFeature(s, "nix" as never, fri)).toBe(s);
  });
});
