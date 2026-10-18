import { describe, expect, it } from "vitest";
import { parseClientMessage } from "@shared/platform/parse";

describe("Nachrichten ans Server prüfen", () => {
  it("gültige Nachrichten kommen durch, fremde Felder fallen weg", () => {
    expect(parseClientMessage({ type: "join", name: "Anna", pin: "1234", nonce: "abcdef12", extra: "x" })).toEqual({ type: "join", name: "Anna", pin: "1234", nonce: "abcdef12" });
    expect(parseClientMessage({ type: "action", action: { type: "play", card: "h7" }, id: "abcdef" })).toEqual({ type: "action", action: { type: "play", card: "h7" }, id: "abcdef" });
    expect(parseClientMessage({ type: "presence", foo: 1 })).toEqual({ type: "presence" });
    expect(parseClientMessage({ type: "call", session: null })).toEqual({ type: "call", session: null });
    // „aus“ ist ein gültiger Wert
    expect(parseClientMessage({ type: "call", session: "s1", audio: "a-1", mic: false, cam: false })).toEqual({ type: "call", session: "s1", audio: "a-1", mic: false, cam: false });
    // Fernbedienung: nur bekannte Befehle
    expect(parseClientMessage({ type: "remote", cmd: "louder" })).toEqual({ type: "remote", cmd: "louder" });
    expect(parseClientMessage({ type: "remote", cmd: "reboot" })).toBeNull();
    // Begleit-Handy koppeln
    expect(parseClientMessage({ type: "pair", x: 1 })).toEqual({ type: "pair" });
    expect(parseClientMessage({ type: "join", pairCode: "ABCD2345", companion: true, nonce: "n1n1n1n1" })).toEqual({ type: "join", pairCode: "ABCD2345", companion: true, nonce: "n1n1n1n1" });
    expect(parseClientMessage({ type: "knock", id: "k1", decision: "admit" })).toEqual({ type: "knock", id: "k1", decision: "admit" });
    expect(parseClientMessage({ type: "table", pin: "1234" })).toEqual({ type: "table", pin: "1234" });
  });

  it("kaputte, falsche oder zu große Nachrichten werden abgelehnt", () => {
    const bad: unknown[] = [
      null, 42, "join", [], {}, { type: "gibtsnicht" },
      { type: "join", name: 5 }, { type: "join", pin: "1".repeat(50) }, { type: "join", avatar: "x" },
      { type: "action" }, { type: "action", action: "start" }, { type: "action", action: { kind: "x" } },
      { type: "action", action: { type: "x", n: Infinity } }, { type: "action", action: { type: "x", a: { b: { c: { d: { e: { f: { g: 1 } } } } } } } },
      { type: "action", action: { type: "x", list: Array.from({ length: 100 }, (_, i) => i) } },
      { type: "call", session: 5 }, { type: "call", session: "s", mic: "ja" },
      { type: "chat", text: "hi" }, { type: "chat", id: "x", text: "a".repeat(2000) },
      { type: "knock", id: "k", decision: "vielleicht" }, { type: "table" },
    ];
    for (const b of bad) expect(parseClientMessage(b), JSON.stringify(b)).toBeNull();
  });

  it("__proto__ in Aktionen wird abgelehnt", () => {
    expect(parseClientMessage(JSON.parse('{"type":"action","action":{"type":"x","__proto__":{"admin":true}}}'))).toBeNull();
  });
});
