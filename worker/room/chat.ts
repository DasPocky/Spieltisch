/** Text-Chat im Raum: Nachricht prüfen und bauen, Verlauf kürzen, wer mitliest */
import { ACTION_ID_RE, CHAT_EMOJIS, CHAT_KEEP, CHAT_MAX, type ChatMsg } from "../../shared/platform/protocol";
import type { Attachment } from "./types";

/** Nachricht aus dem, was das Gerät schickt – null bei leer, ungültiger ID oder schon vorhanden */
export function chatMessage(raw: { id?: unknown; text?: unknown; emoji?: unknown }, from: string, now: number, chat: readonly ChatMsg[]): ChatMsg | null {
  const id = typeof raw.id === "string" && ACTION_ID_RE.test(raw.id) ? raw.id : null;
  if (!id || chat.some((m) => m.id === id)) return null;
  const text = typeof raw.text === "string" ? raw.text.replace(/\s+/g, " ").trim().slice(0, CHAT_MAX) : "";
  const emoji = typeof raw.emoji === "string" && (CHAT_EMOJIS as readonly string[]).includes(raw.emoji) ? raw.emoji : undefined;
  if (!text && !emoji) return null;
  return { id, from, at: now, ...(text ? { text } : { emoji }) };
}

/** Anhängen und auf die letzten CHAT_KEEP kürzen */
export function appendChat(chat: ChatMsg[], m: ChatMsg): void {
  chat.push(m);
  if (chat.length > CHAT_KEEP) chat.splice(0, chat.length - CHAT_KEEP);
}

/** Wer Chat bekommt: Spieler und die Verwaltung beim Zuschauen – nicht der Große Tisch (den sieht jeder im Raum) */
export const getsChat = (att: Attachment | null) => !!att?.playerId || (!!att?.watch && !att.table);
