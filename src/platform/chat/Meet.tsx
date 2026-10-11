import { useEffect, useRef } from "react";
import { Dices, Mic, MicOff, Video } from "lucide-react";
import type { RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "../Avatar";
import type { CallControls } from "../call/CallBar";
import { ChatPanel, type ChatControls } from "./Chat";

export const meetKey = (code: string) => `spieltisch:meet:${code}`;

/**
 * Treffpunkt: einfach zusammen sein, ohne zu spielen – großes Video-Raster, Sprache, Chat.
 * Ein Spiel lässt sich jederzeit dazu starten („Spielen“ führt in die normale Lobby).
 */
export function Meet({ room, me, online, call, chat, onPlay }: {
  room: RoomState; me: string | null; online: Set<string> | null; call?: CallControls; chat?: ChatControls; onPlay: () => void;
}) {
  const inCall = call?.phase === "on";
  const ids = room.players.map((p) => p.id);
  const n = ids.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" data-testid="meet">
      <div className="grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {room.players.map((p) => (
          <MeetTile key={p.id} id={p.id} name={p.id === me ? `${p.name} (du)` : p.name} call={call} me={me}
            online={!online || online.has(p.id)} avatar={room.avatars?.[p.id]} />
        ))}
      </div>
      {call && !inCall && (
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button onClick={() => void call.join(true)}><Video />Video an</Button>
          <Button variant="secondary" onClick={() => void call.join(false)}><Mic />Nur Sprache</Button>
          {call.error && <p role="alert" className="col-span-2 text-sm text-destructive">{call.error}</p>}
        </div>
      )}
      {chat && <ChatPanel chat={chat} players={room.players} me={me} className="glass min-h-40 flex-1 rounded-2xl p-2.5" />}
      <Button size="lg" variant="secondary" className="shrink-0" onClick={onPlay}><Dices />Ein Spiel starten</Button>
    </section>
  );
}

function MeetTile({ id, name, call, me, online, avatar }: { id: string; name: string; call?: CallControls; me: string | null; online: boolean; avatar?: RoomState["avatars"] extends Record<string, infer A> | undefined ? A : never }) {
  const self = id === me;
  const on = call?.phase === "on";
  const stream = on ? (self ? call.local : call.streams[id]) : null;
  const peer = call?.peers[id];
  const camOn = !!stream?.getVideoTracks().length && (self ? !!call?.cam : !!peer?.cam);
  const mic = self ? !!call?.micOn : !!peer?.mic;
  const talking = !!call?.speaking?.has(id);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream, camOn]);
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy-800 transition-shadow", talking && "speaking", !online && "opacity-50")}>
      {camOn ? <video ref={ref} autoPlay playsInline muted className={cn("size-full object-cover", self && "-scale-x-100")} />
        : <span className="grid size-full place-items-center"><Avatar avatar={avatar} name={name} className="size-14 text-3xl" /></span>}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1 truncate rounded-lg bg-black/55 px-1.5 py-0.5 text-xs font-semibold text-white">
        {(peer || (self && on)) && (mic ? <Mic className="size-3 shrink-0" /> : <MicOff className="size-3 shrink-0 text-red-300" />)}
        <span className="truncate">{name}</span>
      </span>
    </div>
  );
}
