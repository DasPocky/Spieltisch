import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { currentPlayerId, roomGame, type RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { decide, useUpdate, useUpdateGate, type Gate } from "@/lib/update";

/** Guter Moment zum Neuladen? Lobby und Partie-Ende sofort, wer dran ist (oder alle gleichzeitig) etwas später */
export function roomGate(room: RoomState, me: string | null, mode: string): Gate {
  const playing = room.phase === "playing" && room.game !== null;
  if (!playing || roomGame(room).isOver(room.game)) return "now";
  if (mode === "round") return "hold";
  const cur = currentPlayerId(room);
  if (me === null || cur === null || cur === me) return "later";
  return "now";
}

/** Raum meldet, wann ein Update passt – und neu entschieden wird nach jeder Änderung */
export function useRoomUpdateGate(room: RoomState, me: string | null): void {
  const { mode } = useUpdate();
  const g = useRef<Gate>("now");
  g.current = roomGate(room, me, mode);
  const fn = useCallback(() => g.current, []);
  useUpdateGate(fn);
  useEffect(() => { decide(); }, [room, mode]);
}

/**
 * Dezenter Hinweis im Raum: ein Update wartet (kommt, wenn keine Partie mehr läuft bzw. zur Uhrzeit)
 * oder ist schon da und kommt nach dieser Partie. Lässt sich wegtippen.
 */
export function UpdateBar({ playing }: { playing: boolean }) {
  const u = useUpdate();
  const [hidden, setHidden] = useState<string | null>(null);
  let text: string | null = null;
  if (u.ready && u.mode === "round" && playing) text = "Neue Version ist da – sie kommt nach dieser Partie.";
  else if (u.pending?.mode === "idle") text = "Ein Update wartet – es kommt, sobald keine Partie mehr läuft.";
  else if (u.pending?.mode === "time" && u.pending.hour !== undefined) text = `Ein Update kommt heute um ${u.pending.hour} Uhr.`;
  const key = `${text}:${u.ready?.sha ?? u.pending?.at}`;
  if (!text || hidden === key) return null;
  return (
    <div role="status" data-testid="update-bar" className="text-in mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm">
      <Sparkles className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 leading-snug">{text}</span>
      <button type="button" aria-label="Hinweis schließen" onClick={() => setHidden(key)} className="-m-1 rounded-full p-1 text-muted-foreground"><X className="size-4" /></button>
    </div>
  );
}

/** In der Lobby nach einem Update, das die letzte Partie nicht übernehmen konnte */
export function UpdatedNote({ room }: { room: RoomState }) {
  if (!room.updated || Date.now() - room.updated.at > 12 * 3_600_000) return null;
  return (
    <div role="status" data-testid="updated-note" className="glass mt-2 flex items-start gap-2 rounded-2xl p-3 text-sm">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      <span><b>{getGame(room.updated.gameId).info.name}</b> wurde verbessert – die letzte Partie ließ sich nicht übernehmen. Startet einfach eine neue Runde, der Spielabend zählt weiter.</span>
    </div>
  );
}
