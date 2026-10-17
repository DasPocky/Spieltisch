import { describe, expect, it } from "vitest";
import { JOIN_RETRY_MS, joinedAs, rememberJoin, retryJoin } from "../../worker/room/join";
import { appendChat, chatMessage, getsChat } from "../../worker/room/chat";
import { resultEvent, resultJobs } from "../../worker/room/results";
import { CHAT_KEEP } from "@shared/platform/protocol";

describe("Beitritts-Nonce", () => {
  const t = 1_000_000;
  const joins = rememberJoin(undefined, "nonce-a", "p1", t);
  it("wiederholter Beitritt kurz danach: derselbe Spieler", () => {
    expect(retryJoin(joins, "nonce-a", t + 5_000)).toBe("p1");
  });
  it("unbekannt, fremd, abgelaufen oder altes Format: kein Spieler", () => {
    expect(retryJoin(joins, "nonce-b", t)).toBeNull();
    expect(retryJoin(joins, null, t)).toBeNull();
    expect(retryJoin(undefined, "nonce-a", t)).toBeNull();
    expect(retryJoin(joins, "nonce-a", t + JOIN_RETRY_MS)).toBeNull();
    expect(retryJoin({ "nonce-a": "p1" }, "nonce-a", t)).toBeNull();
  });
  it("Abgelaufenes fällt beim Merken weg, Entfernte bleiben erkennbar", () => {
    const later = rememberJoin(joins, "nonce-c", "p2", t + JOIN_RETRY_MS + 1);
    expect(Object.keys(later)).toEqual(["nonce-c"]);
    expect(joinedAs("p9")).toBe("p9");
    expect(joinedAs({ id: "p1", at: 0 })).toBe("p1");
  });
});

describe("Chat", () => {
  it("Text wird gesäubert, unbekannte Emojis und Doppelte fallen weg", () => {
    expect(chatMessage({ id: "msg-001", text: "  Hallo\n  Welt " }, "a", 1, [])).toEqual({ id: "msg-001", from: "a", at: 1, text: "Hallo Welt" });
    expect(chatMessage({ id: "msg-001", emoji: "🦄" }, "a", 1, [])).toBeNull();
    expect(chatMessage({ id: "kurz", text: "x" }, "a", 1, [])).toBeNull();
    const m = chatMessage({ id: "msg-002", emoji: "👍" }, "a", 1, [])!;
    expect(chatMessage({ id: "msg-002", text: "nochmal" }, "a", 2, [m])).toBeNull();
  });
  it("Verlauf bleibt kurz, der Große Tisch liest nicht mit", () => {
    const chat = Array.from({ length: CHAT_KEEP }, (_, i) => ({ id: `m${i}`, from: "a", at: i, text: "x" }));
    appendChat(chat, { id: "neu", from: "a", at: 999, text: "y" });
    expect(chat.length).toBe(CHAT_KEEP);
    expect(chat.at(-1)?.id).toBe("neu");
    expect(getsChat({ playerId: "a" })).toBe(true);
    expect(getsChat({ playerId: null, watch: true })).toBe(true);
    expect(getsChat({ playerId: null, watch: true, table: true })).toBe(false);
    expect(getsChat(null)).toBe(false);
  });
});

describe("Ergebnisse", () => {
  it("je Profil und Gruppe ein Auftrag mit derselben Partie-Kennung", () => {
    const room = { code: "ABCDE", createdAt: 5, profiles: { a: "PROFA", b: "PROFB" }, groups: { a: "GRP1", b: "GRP1" } };
    const jobs = resultJobs(room, "uno", 3, [{ id: "a", won: true }, { id: "b", won: false }, { id: "c", won: false }], 100);
    expect(jobs.map((j) => `${j.kind}:${j.target}`)).toEqual(["profile:PROFA", "profile:PROFB", "group:GRP1"]);
    expect(new Set(jobs.map((j) => j.event))).toEqual(new Set([resultEvent(room, 3)]));
    expect(resultEvent(room, 3)).not.toBe(resultEvent(room, 4));
  });
});
