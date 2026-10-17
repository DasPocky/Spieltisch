import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GAMES, getGame } from "@shared/games";
import { addPlayer, applyRoomAction, createRoom, migrateRoomState, ROOM_SCHEMA, roomGame, upgradeRoom, type RoomState } from "@shared/platform/room";
import type { GameLogic } from "@shared/platform/types";
import { berlinHour, DEFAULT_UPDATE, releaseDue, sanitizeUpdate } from "@shared/platform/update";
import { NEWS, newsFor, sanitizeNews } from "@shared/news";

// Eine „gesicherte“ alte Mau-Mau-Version 0 – im echten Betrieb legt sie scripts/legacy.mjs an
const OLD = { ...getGame("maumau"), version: 0 } as GameLogic<unknown, { type: string }>;
vi.mock("@shared/legacy", () => ({ legacyGame: (id: string, v: number) => (id === "maumau" && v === 0 ? OLD : null), LEGACY_KEYS: ["maumau@0"] }));

function playing(gameId: string): RoomState {
  let r = createRoom(gameId);
  for (const id of ["a", "b", "c"]) r = addPlayer(r, { id, name: id.toUpperCase() });
  return applyRoomAction(r, { type: "start" }, null);
}

describe("Update: laufende Partien", () => {
  it("Start merkt sich die Spielversion", () => {
    const r = playing("uno");
    expect(r.gameVersion).toBe(getGame("uno").version);
    expect(upgradeRoom(r)).toEqual({ room: r, result: "same" });
  });

  it("Räume von vor der Versionsprüfung gelten als aktuell", () => {
    const { gameVersion: _, ...old } = playing("uno");
    const up = upgradeRoom(old as RoomState);
    expect(up.result).toBe("same");
    expect(up.room.gameVersion).toBe(getGame("uno").version);
  });

  it("gesicherte alte Version: Partie läuft damit zu Ende, die nächste startet aktuell", () => {
    const r = { ...playing("maumau"), gameVersion: 0 };
    const up = upgradeRoom(r);
    expect(up.result).toBe("legacy");
    expect(roomGame(up.room)).toBe(OLD);
    const next = applyRoomAction(up.room, { type: "restart" }, null);
    expect(next.gameVersion).toBe(getGame("maumau").version);
    expect(roomGame(next)).toBe(getGame("maumau"));
  });

  it("ohne gesicherte Version: umrechnen, wenn das Spiel es kann", () => {
    const logic = getGame("uno");
    const r = { ...playing("uno"), gameVersion: logic.version - 1, undo: [{}] };
    logic.migrate = (s) => ({ ...(s as object), migrated: true });
    try {
      const up = upgradeRoom(r);
      expect(up.result).toBe("migrated");
      expect(up.room.gameVersion).toBe(logic.version);
      expect((up.room.game as { migrated?: boolean }).migrated).toBe(true);
      expect(up.room.undo).toEqual([]);
    } finally { delete logic.migrate; }
  });

  it("sonst endet die Partie sanft: Lobby, Spieler und Spielabend bleiben, Hinweis für die Lobby", () => {
    const r = { ...playing("uno"), gameVersion: 999, evening: { wins: { a: 2 }, names: { a: "A" }, log: [] } };
    const up = upgradeRoom(r);
    expect(up.result).toBe("reset");
    expect(up.room.phase).toBe("lobby");
    expect(up.room.game).toBeNull();
    expect(up.room.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(up.room.evening?.wins.a).toBe(2);
    expect(up.room.updated?.gameId).toBe("uno");
    // Neue Partie: Hinweis weg
    expect(applyRoomAction(up.room, { type: "start" }, null).updated).toBeUndefined();
  });

  it("Versionsliste passt zum Code – nach dem Erhöhen: node scripts/legacy.mjs <spiel>", () => {
    const versions = JSON.parse(readFileSync("shared/games/versions.json", "utf8")) as Record<string, number>;
    for (const [id, logic] of Object.entries(GAMES)) {
      expect(versions[id], `${id}: Version ${logic.version} ist neu – \`node scripts/legacy.mjs ${id}\` ausführen (sichert die alte für laufende Partien)`).toBe(logic.version);
    }
  });
});

describe("Update-Zeitpunkt", () => {
  const p = { versionId: "x", sha: "abc1234", time: "", at: 0 };
  const H = 3_600_000;
  it("sofort und je Raum: gleich live", () => {
    expect(releaseDue(p, { ...DEFAULT_UPDATE, mode: "now" }, 1, 5)).toBe("sofort");
    expect(releaseDue(p, { ...DEFAULT_UPDATE, mode: "round" }, 1, 5)).toBe("sofort");
  });
  it("wenn keine Partie läuft – sonst spätestens nach der Höchstwartezeit", () => {
    const cfg = { ...DEFAULT_UPDATE, mode: "idle" as const, maxWaitHours: 3 };
    expect(releaseDue(p, cfg, H, 0)).toBe("ruhe");
    expect(releaseDue(p, cfg, H, 2)).toBeNull();
    expect(releaseDue(p, cfg, 3 * H, 2)).toBe("zeitlimit");
  });
  it("feste Uhrzeit (deutsche Zeit), verpasst spätestens nach einem Tag", () => {
    const cfg = { ...DEFAULT_UPDATE, mode: "time" as const, hour: 4 };
    const at4 = Date.parse("2026-10-20T02:10:00Z"); // 4:10 Uhr Sommerzeit
    expect(berlinHour(at4)).toBe(4);
    expect(releaseDue({ ...p, at: at4 - H }, cfg, at4, 3)).toBe("uhrzeit");
    expect(releaseDue({ ...p, at: at4 - H }, cfg, at4 + 2 * H, 3)).toBeNull();
    expect(releaseDue({ ...p, at: at4 - 26 * H }, cfg, at4 + 2 * H, 3)).toBe("uhrzeit");
  });
  it("nur per Knopf: nie von selbst", () => {
    expect(releaseDue(p, { ...DEFAULT_UPDATE, mode: "manual" }, 99 * H, 0)).toBeNull();
  });
  it("Einstellungen werden geprüft", () => {
    expect(sanitizeUpdate({ mode: "quatsch", maxWaitHours: 999, hour: -3 })).toEqual({ mode: "now", maxWaitHours: 48, hour: 0 });
  });
});

describe("Was ist neu?", () => {
  it("Admin kann ausblenden und Texte ändern – Unbekanntes fällt weg", () => {
    const id = NEWS[0].id;
    const o = sanitizeNews({ hidden: [id, "gibtsnicht"], edits: { [NEWS[1].id]: { title: " Neu ", items: ["a", "", 3] }, x: { title: "t", items: ["i"] } } });
    expect(o.hidden).toEqual([id]);
    expect(Object.keys(o.edits)).toEqual([NEWS[1].id]);
    const list = newsFor(o);
    expect(list.find((n) => n.id === id)).toBeUndefined();
    expect(list[0]).toMatchObject({ id: NEWS[1].id, title: "Neu", items: ["a"] });
  });
  it("Einträge sind eindeutig und neueste zuerst", () => {
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    expect([...NEWS].sort((a, b) => b.date.localeCompare(a.date)).map((n) => n.id)).toEqual(NEWS.map((n) => n.id));
  });
});

describe("Gespeicherte Räume (Fixtures) laden", () => {
  const load = (f: string) => JSON.parse(readFileSync(`tests/fixtures/rooms/${f}`, "utf8")) as unknown;
  it("v1, Partie läuft (vor der Versionsprüfung gespeichert): weiterspielen mit Spielern, Punkten, Spielabend", () => {
    const raw = load("v1-uno-playing.json") as RoomState;
    const r = upgradeRoom(migrateRoomState(raw)).room;
    expect(r.phase).toBe("playing");
    expect(r.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(r.evening?.wins.a).toBe(1);
    expect(r.gameVersion).toBe(getGame("uno").version);
    expect(r.game).toEqual(raw.game);
    // ein Zug geht weiter
    const view = roomGame(r);
    expect(view.isOver(r.game)).toBe(false);
  });
  it("v1, Lobby: unverändert nutzbar", () => {
    const r = migrateRoomState(load("v1-lobby.json"));
    expect(r.phase).toBe("lobby");
    expect(applyRoomAction(r, { type: "start" }, "a").phase).toBe("playing");
  });
  it("Kaputtes wird abgelehnt, Lücken werden aufgefüllt", () => {
    expect(() => migrateRoomState(null)).toThrow();
    expect(() => migrateRoomState({ v: 1 })).toThrow();
    const r = migrateRoomState({ gameId: "uno", phase: "playing" });
    expect(r).toMatchObject({ v: 1, players: [], phase: "lobby", game: null, round: 0 });
    expect(ROOM_SCHEMA).toBe(1);
  });
});
