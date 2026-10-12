import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { CHAT_EMOJIS, CHAT_MAX, type ChatMsg } from "@shared/platform/protocol";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, vibrate } from "@/lib/utils";
import { Avatar, AvatarContext } from "../Avatar";

export interface ChatControls {
  messages: ChatMsg[];
  say: (m: { text?: string; emoji?: string }) => void;
}

/** Chat des Raums – die Spielerleiste liest hier die frischen Reaktionen, um sie über dem Platz aufploppen zu lassen */
export const ChatContext = createContext<ChatControls | null>(null);

/** Was ein Spieler gerade gesagt hat (die letzten Sekunden) – für die Sprechblase über seinem Platz */
export function useBubble(playerId: string, ms = 4500): ChatMsg | null {
  const chat = useContext(ChatContext);
  const last = useMemo(() => [...(chat?.messages ?? [])].reverse().find((m) => m.from === playerId) ?? null, [chat?.messages, playerId]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!last) return;
    const left = last.at + ms - Date.now();
    if (left <= 0) return;
    const t = setTimeout(() => tick((x) => x + 1), left + 30);
    return () => clearTimeout(t);
  }, [last, ms]);
  return last && Date.now() - last.at < ms ? last : null;
}

/** Sprechblase über einem Platz (Emoji groß, Text kurz) */
export function Bubble({ playerId, side }: { playerId: string; /** in einer Listenzeile: rechts in der Zeile statt darüber */ side?: boolean }) {
  const m = useBubble(playerId);
  if (!m) return null;
  return (
    <span key={m.id} className={cn("pointer-events-none absolute z-20 max-w-[9rem] truncate rounded-xl bg-popover px-2 py-1 text-sm font-semibold text-popover-foreground shadow-lg ring-1 ring-border",
      side ? "bubble-side top-1/2 right-24" : "bubble-in -top-2 left-1/2")}
      aria-live="polite">
      {m.emoji ? <span className="text-xl leading-none">{m.emoji}</span> : m.text}
    </span>
  );
}

const SEEN_KEY = (code: string) => `spieltisch:chatSeen:${code}`;

/** Knopf in der Kopfzeile: Chat öffnen, mit Zähler für Ungelesenes. Neue Nachrichten blitzen kurz oben auf. */
export function ChatButton({ code, chat, players, me }: { code: string; chat: ChatControls; players: Player[]; me: string | null }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => { try { return Number(sessionStorage.getItem(SEEN_KEY(code))) || 0; } catch { return 0; } });
  const latest = chat.messages.at(-1)?.at ?? 0;
  const unread = chat.messages.filter((m) => m.at > seen && m.from !== me).length;
  useEffect(() => {
    if (!open || latest <= seen) return;
    setSeen(latest);
    try { sessionStorage.setItem(SEEN_KEY(code), String(latest)); } catch { /* egal */ }
  }, [open, latest, seen, code]);
  // Kurzer Hinweis bei neuer Text-Nachricht (Reaktionen zeigt die Spielerleiste)
  const [flash, setFlash] = useState<ChatMsg | null>(null);
  const lastId = useRef(chat.messages.at(-1)?.id);
  useEffect(() => {
    const m = chat.messages.at(-1);
    if (!m || m.id === lastId.current) return;
    lastId.current = m.id;
    if (m.from === me || open || !m.text) return;
    vibrate(8);
    setFlash(m);
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [chat.messages, me, open]);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Jemand";

  return (
    <>
      <Button variant="secondary" size="icon" className="relative" aria-label={unread ? `Chat, ${unread} neu` : "Chat"} onClick={() => setOpen(true)} data-testid="chat-button">
        <MessageCircle />
        {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-bold text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
      </Button>
      {flash && (
        <button type="button" onClick={() => { setFlash(null); setOpen(true); }}
          className="text-in fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-popover px-3 py-2 text-left text-sm text-popover-foreground shadow-xl ring-1 ring-border">
          <b className="shrink-0">{nameOf(flash.from)}:</b><span className="min-w-0 truncate">{flash.text}</span>
        </button>
      )}
      <ChatSheet open={open} onOpenChange={setOpen} chat={chat} players={players} me={me} />
    </>
  );
}

/** Der Chat selbst: Verlauf, Schnell-Reaktionen, Eingabe */
export function ChatSheet({ open, onOpenChange, chat, players, me }: { open: boolean; onOpenChange: (o: boolean) => void; chat: ChatControls; players: Player[]; me: string | null }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex max-h-[85dvh] flex-col">
        <SheetHeader>
          <SheetTitle>Chat</SheetTitle>
          <SheetDescription>Alle im Raum lesen mit.</SheetDescription>
        </SheetHeader>
        <ChatPanel chat={chat} players={players} me={me} className="min-h-0 flex-1 px-4 pb-4" />
      </SheetContent>
    </Sheet>
  );
}

/** Verlauf + Eingabe – im Sheet oder im Treffpunkt direkt auf der Seite */
export function ChatPanel({ chat, players, me, className }: { chat: ChatControls; players: Player[]; me: string | null; className?: string }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const avatars = useContext(AvatarContext);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [chat.messages.length]);
  const send = () => { const t = text.trim(); if (!t) return; chat.say({ text: t }); setText(""); };
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Jemand";
  const time = (at: number) => new Date(at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div ref={list} className="no-scrollbar grid min-h-24 flex-1 content-start gap-1.5 overflow-y-auto" data-testid="chat-list" role="log" aria-live="polite">
        {chat.messages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Noch still hier. Sag hallo!</p>}
        {chat.messages.map((m, i) => {
          const mine = m.from === me;
          const first = chat.messages[i - 1]?.from !== m.from;
          return (
            <div key={m.id} className={cn("flex items-end gap-1.5", mine && "flex-row-reverse")}>
              <span className="w-7 shrink-0">{first && !mine && <Avatar avatar={avatars?.[m.from]} name={nameOf(m.from)} className="size-7 text-sm" />}</span>
              <div className={cn("max-w-[78%] rounded-2xl px-3 py-1.5", m.emoji ? "bg-transparent px-1 text-3xl leading-none" : mine ? "bg-primary text-primary-foreground" : "glass")}>
                {first && !mine && !m.emoji && <div className="text-[0.7rem] font-semibold opacity-70">{nameOf(m.from)}</div>}
                {m.emoji ?? <span className="break-words whitespace-pre-wrap">{m.text}</span>}
              </div>
              <span className="pb-1 text-[0.6rem] text-muted-foreground tabular-nums">{time(m.at)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1" role="group" aria-label="Schnell reagieren">
        {CHAT_EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => { vibrate(6); chat.say({ emoji: e }); }} aria-label={`Reaktion ${e}`}
            className="grid size-10 place-items-center rounded-full text-2xl transition outline-none active:scale-90 focus-visible:ring-[3px] focus-visible:ring-ring">{e}</button>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={CHAT_MAX} placeholder="Nachricht" aria-label="Nachricht" enterKeyHint="send" autoComplete="off" />
        <Button type="submit" size="icon" className="size-12 shrink-0" disabled={!text.trim()} aria-label="Senden"><Send /></Button>
      </form>
    </div>
  );
}
