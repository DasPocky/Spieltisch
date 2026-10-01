import { describe, expect, it } from "vitest";
import {
  addGroupResult, AVATAR_COLORS, AVATAR_EMOJIS, cleanGroupName, defaultAvatar, GROUP_CODE_RE, leaderboard, MAX_GROUP_NAME, MAX_MEMBERS,
  MEMBER_ID_RE, newGroup, playedGames, previewGroup, randomCode, removeMember, sanitizeAvatar, sanitizeGroupResult, upsertMember, viewGroup,
} from "@shared/platform/group";
import { makeProfileId } from "@shared/platform/profile";

const ids = ["tutto", "kniffel", "uno"];

function group3() {
  const g = newGroup("ABCDEF", "  Spiele   abend ", 0);
  const a = upsertMember(g, makeProfileId(), "Anna", { color: 1, emoji: 2 }, 1);
  const b = upsertMember(g, makeProfileId(), "Ben", null, 2);
  const c = upsertMember(g, makeProfileId(), "Cara", { color: 99, emoji: 0 }, 3);
  return { g, a, b, c };
}

describe("Gruppen", () => {
  it("Codes: 6 Zeichen aus dem Raumcode-Alphabet, Mitglieds-IDs 8", () => {
    expect(randomCode(6)).toMatch(GROUP_CODE_RE);
    expect(randomCode(8)).toMatch(MEMBER_ID_RE);
    expect(GROUP_CODE_RE.test("ABCDE0")).toBe(false);
  });

  it("Name wird gesäubert und begrenzt", () => {
    expect(newGroup("ABCDEF", "  Spiele   abend ", 0).name).toBe("Spiele abend");
    expect(newGroup("ABCDEF", "", 0).name).toBe("Unsere Runde");
    expect(cleanGroupName("x".repeat(50))).toHaveLength(MAX_GROUP_NAME);
  });

  it("Avatare: nur gültige Indizes, Standard aus der ID", () => {
    expect(sanitizeAvatar({ color: 0, emoji: AVATAR_EMOJIS.length - 1 })).toEqual({ color: 0, emoji: AVATAR_EMOJIS.length - 1 });
    expect(sanitizeAvatar({ color: AVATAR_COLORS.length, emoji: 0 })).toBeNull();
    expect(sanitizeAvatar({ color: 1.5, emoji: 0 })).toBeNull();
    expect(sanitizeAvatar("🐶")).toBeNull();
    expect(defaultAvatar("ABC")).toEqual(defaultAvatar("ABC"));
    expect(sanitizeAvatar(defaultAvatar("XYZ"))).not.toBeNull();
  });

  it("Mitglieder: aufnehmen, aktualisieren statt doppelt, Höchstzahl", () => {
    const g = newGroup("ABCDEF", "Runde", 0);
    const pid = makeProfileId();
    const id = upsertMember(g, pid, "Anna", { color: 1, emoji: 1 }, 1);
    expect(upsertMember(g, pid, "Anna B.", { color: 2, emoji: 3 }, 2)).toBe(id);
    expect(g.members).toEqual([{ id, name: "Anna B.", avatar: { color: 2, emoji: 3 }, joinedAt: 1 }]);
    expect(() => upsertMember(g, makeProfileId(), "  ", null, 3)).toThrow();
    for (let i = 1; i < MAX_MEMBERS; i++) upsertMember(g, makeProfileId(), `P${i}`, null, 3);
    expect(() => upsertMember(g, makeProfileId(), "Zu viel", null, 4)).toThrow(/höchstens/);
    expect(previewGroup(g)).toMatchObject({ count: MAX_MEMBERS, full: true });
  });

  it("Sicht ohne Profil-IDs", () => {
    const { g, a } = group3();
    const v = viewGroup(g, a);
    expect(v.you).toBe(a);
    expect(JSON.stringify(v)).not.toContain(Object.keys(g.keys)[0]);
    expect("keys" in v).toBe(false);
  });

  it("Ergebnisse prüfen: bekanntes Spiel, nur Mitglieder, keine Doppelten", () => {
    const { g, a, b } = group3();
    const members = g.members.map((m) => m.id);
    expect(sanitizeGroupResult({ gameId: "tutto", players: [{ id: a, won: true }, { id: b }] }, ids, members))
      .toEqual({ gameId: "tutto", players: [{ id: a, won: true }, { id: b, won: false }] });
    expect(sanitizeGroupResult({ gameId: "schach", players: [{ id: a, won: true }] }, ids, members)).toBeNull();
    expect(sanitizeGroupResult({ gameId: "tutto", players: [{ id: "FREMDXYZ", won: true }] }, ids, members)).toBeNull();
    expect(sanitizeGroupResult({ gameId: "tutto", players: [{ id: a }, { id: a }] }, ids, members)).toBeNull();
    expect(sanitizeGroupResult({ gameId: "tutto", players: [] }, ids, members)).toBeNull();
    expect(sanitizeGroupResult(null, ids, members)).toBeNull();
  });

  it("Bestenliste: Siege je Spiel und gesamt, sortiert nach Siegen und Quote", () => {
    const { g, a, b, c } = group3();
    addGroupResult(g, { gameId: "tutto", players: [{ id: a, won: true }, { id: b, won: false }] });
    addGroupResult(g, { gameId: "tutto", players: [{ id: a, won: false }, { id: b, won: true }, { id: c, won: false }] });
    addGroupResult(g, { gameId: "uno", players: [{ id: b, won: true }, { id: c, won: false }] });
    addGroupResult(g, { gameId: "uno", players: [{ id: "WEGWEG22", won: true }] });
    expect(g.stats[a]).toEqual({ tutto: { played: 2, won: 1 } });
    const all = leaderboard(g, null);
    expect(all.map((r) => [r.member.name, r.played, r.won])).toEqual([["Ben", 3, 2], ["Anna", 2, 1], ["Cara", 2, 0]]);
    expect(all[0].rate).toBeCloseTo(2 / 3);
    const tutto = leaderboard(g, "tutto");
    // Gleich viele Siege, gleiche Quote: alphabetisch
    expect(tutto.map((r) => r.member.name)).toEqual(["Anna", "Ben", "Cara"]);
    expect(leaderboard(g, "kniffel").every((r) => r.played === 0)).toBe(true);
    expect(playedGames(g)).toEqual(["tutto", "uno"]);
  });

  it("Mitglied entfernen löscht Statistik und Zuordnung", () => {
    const { g, a, b } = group3();
    addGroupResult(g, { gameId: "tutto", players: [{ id: a, won: true }, { id: b, won: false }] });
    expect(removeMember(g, a)).toBe(true);
    expect(removeMember(g, a)).toBe(false);
    expect(g.stats[a]).toBeUndefined();
    expect(Object.values(g.keys)).not.toContain(a);
    expect(g.members).toHaveLength(2);
  });
});
