import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Phone, PhoneOff, Video, VideoOff, X } from "lucide-react";
import type { CallPeer } from "@shared/platform/protocol";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { useCall } from "./useCall";

export type CallControls = ReturnType<typeof useCall> & { peers: Record<string, CallPeer>; silent: boolean };

/** Knopf in der Kopfzeile: Chat beitreten (Sprache oder Video) – zeigt, wie viele schon drin sind */
export function CallButton({ call }: { call: CallControls }) {
  const [open, setOpen] = useState(false);
  const inCall = Object.keys(call.peers).length;
  if (call.phase !== "off") return null;
  return (
    <div className="relative">
      <Button variant="secondary" size="icon" aria-label="Sprachchat" onClick={() => setOpen((o) => !o)}>
        <Phone />
        {inCall > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-emerald-500 text-[0.7rem] font-bold text-white">{inCall}</span>}
      </Button>
      {open && (
        <div className="glass absolute top-12 right-0 z-30 grid w-56 gap-1.5 rounded-2xl p-2 shadow-xl" role="dialog" aria-label="Sprachchat beitreten">
          <p className="px-1 pb-1 text-xs text-muted-foreground">{inCall ? `${inCall} im Chat` : "Noch niemand im Chat"}</p>
          <Button onClick={() => { setOpen(false); void call.join(false); }}><Mic />Nur Sprache</Button>
          <Button variant="secondary" onClick={() => { setOpen(false); void call.join(true); }}><Video />Mit Video</Button>
          {call.error && <p role="alert" className="px-1 text-xs text-destructive">{call.error}</p>}
        </div>
      )}
      {!open && call.error && <p role="alert" className="absolute top-12 right-0 z-30 w-56 rounded-xl bg-destructive px-2 py-1 text-xs text-white">{call.error}</p>}
    </div>
  );
}

/** Leiste unter der Kopfzeile, solange man im Chat ist: kleine Kacheln (Video oder Initialen) und Schalter */
export function CallStrip({ call, players, me }: { call: CallControls; players: Player[]; me: string | null }) {
  const [big, setBig] = useState(false);
  if (call.phase === "off") return null;
  const ids = Object.keys(call.peers).filter((id) => players.some((p) => p.id === id));
  if (me && !ids.includes(me)) ids.unshift(me);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 pb-1.5" data-testid="call-strip">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-0.5 py-1" role="group" aria-label="Im Sprachchat">
          {call.phase === "joining" && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {ids.map((id) => (
            <Tile key={id} name={nameOf(id)} stream={id === me ? call.local : call.streams[id]} self={id === me}
              mic={id === me ? call.micOn : call.peers[id]?.mic ?? true} cam={id === me ? call.cam : call.peers[id]?.cam ?? false} onClick={() => setBig(true)} />
          ))}
        </div>
        {call.silent ? (
          <span className="rounded-full bg-navy-950/60 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground" title="Nachts sind die Mikros aus">🌙 still</span>
        ) : (
          <Button variant={call.mic ? "secondary" : "destructive"} size="icon" aria-label={call.mic ? "Mikro aus" : "Mikro an"} onClick={() => call.setMic(!call.mic)}>
            {call.mic ? <Mic /> : <MicOff />}
          </Button>
        )}
        {call.local?.getVideoTracks().length ? (
          <Button variant={call.cam ? "secondary" : "destructive"} size="icon" aria-label={call.cam ? "Kamera aus" : "Kamera an"} onClick={() => call.setCam(!call.cam)}>
            {call.cam ? <Video /> : <VideoOff />}
          </Button>
        ) : null}
        <Button variant="destructive" size="icon" aria-label="Chat verlassen" onClick={call.leave}><PhoneOff /></Button>
      </div>
      {/* Ton der anderen – unsichtbar, spielt automatisch */}
      {Object.entries(call.streams).map(([id, s]) => <RemoteAudio key={id} stream={s} />)}
      {big && (
        <div className="fixed inset-0 z-40 grid content-center gap-2 bg-navy-950/95 p-4" role="dialog" aria-label="Video groß">
          <Button variant="secondary" size="icon" className="absolute top-4 right-4" aria-label="Schließen" onClick={() => setBig(false)}><X /></Button>
          <div className="grid grid-cols-2 gap-2">
            {ids.map((id) => (
              <Tile key={id} name={nameOf(id)} stream={id === me ? call.local : call.streams[id]} self={id === me} large
                mic={id === me ? call.micOn : call.peers[id]?.mic ?? true} cam={id === me ? call.cam : call.peers[id]?.cam ?? false} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ name, stream, self, mic, cam, large, onClick }: { name: string; stream: MediaStream | null | undefined; self: boolean; mic: boolean; cam: boolean; large?: boolean; onClick?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const showVideo = cam && !!stream?.getVideoTracks().length;
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream, showVideo]);
  return (
    <button type="button" onClick={onClick} aria-label={`${name}${mic ? "" : " (stumm)"}`}
      className={cn("relative shrink-0 overflow-hidden bg-navy-700 outline-none", large ? "aspect-[4/3] w-full rounded-2xl" : "size-10 rounded-full ring-2", !large && (mic ? "ring-emerald-400/70" : "ring-border"))}>
      {showVideo ? <video ref={ref} autoPlay playsInline muted className={cn("size-full object-cover", self && "-scale-x-100")} />
        : <span className={cn("grid size-full place-items-center font-bold", large ? "text-3xl" : "text-sm")}>{name.slice(0, 2).toUpperCase()}</span>}
      {!mic && <MicOff className={cn("absolute rounded-full bg-destructive p-0.5 text-white", large ? "right-2 bottom-2 size-6" : "right-0 bottom-0 size-3.5")} />}
      {large && <span className="absolute bottom-2 left-2 rounded bg-navy-950/70 px-2 py-0.5 text-sm font-semibold">{name}</span>}
    </button>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); } }, [stream]);
  return <audio ref={ref} autoPlay className="hidden" />;
}
