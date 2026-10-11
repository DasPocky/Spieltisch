import { useContext, useEffect, useRef, type ReactNode } from "react";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@shared/platform/group";
import { cn } from "@/lib/utils";
import { AvatarContext } from "./Avatar";
import { Bubble } from "./chat/Chat";
import { CallContext } from "./call/CallBar";

export interface Seat {
  id: string;
  name: string;
  /** am Zug */
  cur?: boolean;
  /** führt (Krone) */
  lead?: boolean;
  /** raus / ausgeschieden: blass */
  out?: boolean;
  /** Hauptwert, groß (Punkte, Kartenzahl …) */
  value?: ReactNode;
  /** Zusatz, klein (Ziel 2/4, Stiche/Ansage …) */
  sub?: ReactNode;
  /** statt des Avatars (z. B. Spielfigur in Spielerfarbe) */
  icon?: ReactNode;
  /** Fortschritt 0..1 (z. B. Richtung Spielziel) */
  progress?: number;
  /** Vorlesetext für den Platz (sonst Name) */
  label?: string;
  testId?: string;
}

/**
 * Wer sitzt am Tisch: alle Spieler auf einen Blick, ohne Seitwärts-Wischen.
 * Bis 4 Spieler breite Plätze mit Namen, ab 5 schmale Spalten mit Avatar (Name gekürzt, voll beim Antippen/Vorlesen),
 * ab 9 zwei Reihen. Wer dran ist, ist farbig hinterlegt; wer führt, bekommt eine Krone.
 */
export function Seats({ seats, me, online, selectedId, onSelect, pickable, className, label = "Mitspieler" }: {
  seats: Seat[];
  me: string | null;
  online: Set<string> | null;
  selectedId?: string | null;
  /** antippbar (z. B. Block eines Spielers zeigen, Ziel wählen) */
  onSelect?: (id: string) => void;
  /** nur diese sind antippbar (Standard: alle) */
  pickable?: (id: string) => boolean;
  className?: string;
  label?: string;
}) {
  const avatars = useContext(AvatarContext);
  const n = seats.length;
  // Breite Plätze nur bis 2 Spieler – ab 3 wird der Name daneben sonst zu schmal; Spalten mit Avatar oben passen besser
  const wide = n <= 2;
  const roomy = !wide && n <= 4;
  const cols = n <= 8 ? n : Math.ceil(n / 2);

  return (
    <div role="group" aria-label={label} className={cn("seats grid shrink-0 gap-1.5 pt-1 pb-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {seats.map((p) => {
        const av = avatars?.[p.id];
        const off = online && !online.has(p.id);
        const name = p.id === me ? "Du" : p.name;
        const can = onSelect && (!pickable || pickable(p.id));
        const Tag = onSelect ? "button" : "div";
        const face = p.icon ?? (
          <SeatFace id={p.id} className={cn(wide ? "size-7 text-[1.05rem]" : roomy ? "size-9 text-[1.3rem]" : "size-8 text-[1.15rem]", off && "opacity-40 grayscale")}
            bg={av ? AVATAR_COLORS[av.color] : undefined}>
            {av ? AVATAR_EMOJIS[av.emoji] : name.trim()[0]?.toUpperCase()}
          </SeatFace>
        );
        return (
          <Tag key={p.id} type={onSelect ? "button" : undefined} data-cur={!!p.cur} data-testid={p.testId}
            disabled={onSelect ? !can : undefined}
            aria-pressed={onSelect ? selectedId === p.id : undefined}
            aria-label={p.label}
            title={p.name}
            onClick={can ? () => onSelect!(p.id) : undefined}
            className={cn(
              "relative min-w-0 rounded-xl text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
              wide ? "flex items-center gap-2 px-2 py-1.5" : "flex flex-col items-center gap-0.5 px-0.5 pt-1.5 pb-1 text-center",
              p.cur ? "turn" : "glass",
              can && "cursor-pointer active:scale-[0.97]",
              onSelect && !can && "cursor-default",
              selectedId === p.id && (p.cur ? "ring-2 ring-inset ring-white/70" : "ring-2 ring-inset ring-primary"),
              p.out && "opacity-45",
            )}>
            {p.lead && <span className={cn("absolute z-10 text-[0.8rem] leading-none", wide ? "top-0.5 left-0.5" : "-top-1.5 left-1/2 -translate-x-1/2")} role="img" aria-label="führt">👑</span>}
            <Bubble playerId={p.id} />
            {face}
            <span className={cn("min-w-0 leading-tight", wide ? "flex-1" : "w-full")}>
              <span className={cn("block truncate font-semibold", wide || roomy ? "text-xs" : "text-[0.66rem]", !p.cur && "opacity-80", p.out && "line-through")}>{name}{off && <span className="sr-only"> (offline)</span>}</span>
              {wide && p.sub !== undefined && <span className="block truncate text-[0.7rem] tabular-nums opacity-75">{p.sub}</span>}
            </span>
            {p.value !== undefined && (
              <span className={cn("shrink-0 font-bold leading-none tabular-nums", wide ? "text-lg" : roomy ? "text-base" : "text-sm")}>{p.value}</span>
            )}
            {!wide && p.sub !== undefined && <span className={cn("block w-full truncate leading-tight tabular-nums opacity-75", roomy ? "text-[0.68rem]" : "text-[0.6rem]")}>{p.sub}</span>}
            {p.progress !== undefined && (
              <span className={cn("block h-1 overflow-hidden rounded-full", wide ? "absolute right-2 bottom-1 left-2" : "mt-0.5 w-4/5", p.cur ? "bg-white/25" : "bg-navy-950/60")} aria-hidden="true">
                <i className={cn("block h-full rounded-full", p.cur ? "bg-white" : "bg-navy-300")} style={{ width: `${Math.min(100, Math.max(0, p.progress) * 100)}%` }} />
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}

/**
 * Gesicht am Platz: Avatar – oder, wenn die Person im Video-Chat die Kamera an hat, ihr Live-Bild.
 * Wer gerade spricht, bekommt einen leuchtenden Ring. So braucht das Spiel keine extra Video-Leiste.
 */
function SeatFace({ id, bg, className, children }: { id: string; bg?: string; className: string; children: ReactNode }) {
  const c = useContext(CallContext);
  const call = c?.call;
  const self = id === c?.me;
  const stream = call ? (self ? call.local : call.streams[id]) : null;
  const camOn = !!call && call.phase === "on" && (self ? call.cam : !!call.peers[id]?.cam) && !!stream?.getVideoTracks().length;
  const talking = !!call?.speaking?.has(id);
  const muted = !!call && call.phase === "on" && (self ? !call.micOn : call.peers[id] ? !call.peers[id].mic : false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream, camOn]);
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-visible rounded-full leading-none transition-shadow", talking && "speaking", className)}
      style={bg && !camOn ? { backgroundColor: bg } : undefined} aria-hidden="true">
      {camOn ? <video ref={ref} autoPlay playsInline muted className={cn("size-full rounded-full object-cover", self && "-scale-x-100")} /> : children}
      {muted && <span className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center rounded-full bg-destructive text-[0.45rem] text-white">✕</span>}
    </span>
  );
}
