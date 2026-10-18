/**
 * Nachrichten vom Gerät an den Server prüfen – zentral, bevor der Raum sie verarbeitet.
 * Jeder Nachrichtentyp hat hier seine Regeln (Pflichtfelder, Typen, Längen, erlaubte Werte); unbekannte Felder fallen weg.
 * Was nicht passt, wird als ganze Nachricht abgelehnt (null). Neue Nachrichtentypen brauchen hier einen Eintrag und einen Test.
 */
import { REMOTE_CMDS, type ClientMessage, type RemoteCmd } from "./protocol";

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
/** Markiert ein ungültiges Feld (eigenes Zeichen – `false` ist ein gültiger Wert) */
const BAD: unique symbol = Symbol("ungültig");
type Bad = typeof BAD;
/** optionaler Text bis `max` Zeichen (sonst ungültig) */
const str = (x: unknown, max: number): string | undefined | Bad => (x === undefined || x === null ? undefined : typeof x === "string" && x.length <= max ? x : BAD);
const bool = (x: unknown): boolean | undefined | Bad => (x === undefined ? undefined : typeof x === "boolean" ? x : BAD);

/** Größte erlaubte Tiefe und Feldanzahl einer Spielaktion (sie wird vom Spiel selbst noch genau geprüft) */
const MAX_DEPTH = 6;
const MAX_KEYS = 40;
function plain(x: unknown, depth = 0): boolean {
  if (x === null || typeof x === "boolean" || typeof x === "string") return true;
  if (typeof x === "number") return Number.isFinite(x);
  if (depth >= MAX_DEPTH) return false;
  if (Array.isArray(x)) return x.length <= MAX_KEYS && x.every((v) => plain(v, depth + 1));
  if (isObj(x)) {
    const keys = Object.keys(x);
    return keys.length <= MAX_KEYS && !keys.includes("__proto__") && keys.every((k) => plain(x[k], depth + 1));
  }
  return false;
}

/** Felder einsammeln; ein ungültiges Feld macht die ganze Nachricht ungültig */
function pick<T extends Obj>(fields: { [K in keyof T]: T[K] | undefined | Bad }): T | null {
  const out: Obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === BAD) return null;
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isObj(raw) || typeof raw.type !== "string") return null;
  const m = raw;
  switch (m.type) {
    case "join": {
      const avatar = m.avatar === undefined ? undefined : isObj(m.avatar) && plain(m.avatar) ? m.avatar : BAD;
      const p = pick({
        name: str(m.name, 64), pin: str(m.pin, 16), playerId: str(m.playerId, 64), token: str(m.token, 128),
        profile: str(m.profile, 32), profileKey: str(m.profileKey, 64), avatar, group: str(m.group, 16), nonce: str(m.nonce, 64), pairCode: str(m.pairCode, 16), companion: bool(m.companion),
      });
      return p ? ({ type: "join", ...p } as unknown as ClientMessage) : null;
    }
    case "action": {
      if (!isObj(m.action) || typeof m.action.type !== "string" || m.action.type.length > 40 || !plain(m.action)) return null;
      const id = str(m.id, 64);
      if (id === BAD) return null;
      return { type: "action", action: m.action as never, ...(id ? { id } : {}) };
    }
    case "presence":
    case "closeRoom":
    case "claimHost":
    case "pair":
      return { type: m.type };
    case "remote":
      return (REMOTE_CMDS as readonly unknown[]).includes(m.cmd) ? { type: "remote", cmd: m.cmd as RemoteCmd } : null;
    case "call": {
      if (m.session !== null && typeof m.session !== "string") return null;
      const p = pick({ audio: str(m.audio, 128), video: str(m.video, 128), mic: bool(m.mic), cam: bool(m.cam) });
      if (!p || (typeof m.session === "string" && m.session.length > 128)) return null;
      return { type: "call", session: m.session as string | null, ...p } as ClientMessage;
    }
    case "chat": {
      const p = pick({ id: str(m.id, 64), text: str(m.text, 1000), emoji: str(m.emoji, 16) });
      if (!p || typeof p.id !== "string") return null;
      return { type: "chat", ...p } as ClientMessage;
    }
    case "knock": {
      if (typeof m.id !== "string" || m.id.length > 64) return null;
      if (m.decision !== "admit" && m.decision !== "deny" && m.decision !== "wait") return null;
      return { type: "knock", id: m.id, decision: m.decision };
    }
    case "table":
      return typeof m.pin === "string" && m.pin.length <= 16 ? { type: "table", pin: m.pin } : null;
    default:
      return null;
  }
}
