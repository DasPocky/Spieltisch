import { describe, expect, it } from "vitest";
import { addResult, emptyStats, formatProfileId, makeProfileId, parseProfileId, PROFILE_ID_RE, sanitizeResult } from "@shared/platform/profile";

describe("Profile", () => {
  it("IDs: 16 Zeichen, lesbar formatiert, Eingabe tolerant", () => {
    const id = makeProfileId();
    expect(id).toMatch(PROFILE_ID_RE);
    expect(formatProfileId(id)).toMatch(/^.{4}-.{4}-.{4}-.{4}$/);
    expect(parseProfileId(formatProfileId(id).toLowerCase())).toBe(id);
    expect(new Set(Array.from({ length: 200 }, makeProfileId)).size).toBe(200);
  });

  it("Statistik: Partien, Siege, Bestwert, Durchschnitt, letzte Partien begrenzt", () => {
    let s = emptyStats(0);
    s = addResult(s, { gameId: "tutto", at: 1, won: true, score: 6200, players: 3, online: true });
    s = addResult(s, { gameId: "tutto", at: 2, won: false, score: 4100, players: 3, online: false });
    s = addResult(s, { gameId: "maumau", at: 3, won: true, players: 4, online: true });
    expect(s.games.tutto).toEqual({ played: 2, won: 1, best: 6200, total: 10300, scored: 2 });
    expect(s.games.maumau).toEqual({ played: 1, won: 1 });
    expect(s.recent[0].gameId).toBe("maumau");
    for (let i = 0; i < 50; i++) s = addResult(s, { gameId: "kniffel", at: i, won: false, score: 200, players: 2, online: false });
    expect(s.recent).toHaveLength(30);
  });

  it("lokale Ergebnisse werden geprüft", () => {
    const ids = ["tutto", "kniffel"];
    expect(sanitizeResult({ gameId: "tutto", won: true, score: 100, players: 2 }, ids, 5)).toMatchObject({ gameId: "tutto", won: true, online: false, at: 5 });
    expect(sanitizeResult({ gameId: "gibtsnicht", won: true, players: 2 }, ids, 5)).toBeNull();
    expect(sanitizeResult({ gameId: "tutto", won: true, players: 0 }, ids, 5)).toBeNull();
    expect(sanitizeResult({ gameId: "tutto", won: true, players: 2, score: 1e12 }, ids, 5)).toBeNull();
  });
});
