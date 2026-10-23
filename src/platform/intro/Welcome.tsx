import { useEffect, useRef, useState, type CSSProperties } from "react";
import { myAvatar, myName } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Avatar } from "@/platform/Avatar";
import { Logo } from "@/platform/Logo";
import { boot } from "./intro";

/** Mindestdauer der Begrüßung und spätestes Ende, auch wenn noch nicht alles geladen ist */
const MIN_MS = 2800;
const MAX_MS = 3300;
const QUICK_MS = 700;

type Piece = { id: string; x: number; y: number; r: number; fx: number; fy: number; fr: number; delay: number; size: number };
/** Papierteile: wo sie herkommen (fx, fy) und wo sie um das Logo liegen bleiben (x, y) */
const PIECES: Piece[] = [
  { id: "card-a", x: -78, y: -62, r: -16, fx: -260, fy: -420, fr: -140, delay: 0, size: 62 },
  { id: "card-b", x: 80, y: -58, r: 14, fx: 300, fy: -380, fr: 160, delay: 0.08, size: 58 },
  { id: "die", x: -86, y: 56, r: 10, fx: -320, fy: 300, fr: 220, delay: 0.16, size: 50 },
  { id: "pawn", x: 86, y: 60, r: -6, fx: 340, fy: 340, fr: -180, delay: 0.24, size: 50 },
  { id: "star", x: 0, y: -100, r: 8, fx: 40, fy: -520, fr: 260, delay: 0.32, size: 40 },
  { id: "heart", x: -4, y: 104, r: -10, fx: -60, fy: 520, fr: -200, delay: 0.4, size: 36 },
];

/** Die Teile als Papierschnitt: Farbfläche mit weißem Schnittrand */
function Shape({ id }: { id: string }) {
  const edge = { stroke: "var(--paper)", strokeWidth: 4, strokeLinejoin: "round" as const };
  switch (id) {
    case "card-a":
      return <svg viewBox="0 0 60 80"><rect x="4" y="4" width="52" height="72" rx="8" fill="var(--primary)" {...edge} /><circle cx="30" cy="40" r="11" fill="var(--paper)" opacity=".9" /></svg>;
    case "card-b":
      return <svg viewBox="0 0 60 80"><rect x="4" y="4" width="52" height="72" rx="8" fill="var(--deep-500)" {...edge} /><path d="M30 24 L40 40 L30 56 L20 40 Z" fill="var(--paper)" opacity=".9" /></svg>;
    case "die":
      return <svg viewBox="0 0 60 60"><rect x="4" y="4" width="52" height="52" rx="12" fill="var(--paper)" stroke="var(--deep-500)" strokeWidth="3" />{[[18, 18], [42, 18], [30, 30], [18, 42], [42, 42]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="4.5" fill="var(--deep-700)" />)}</svg>;
    case "pawn":
      return <svg viewBox="0 0 60 70"><path d="M30 6a11 11 0 0 1 7 19.5c4 3 6.5 8 7.5 14.5l4 20.5a4 4 0 0 1-4 4.5H15.5a4 4 0 0 1-4-4.5l4-20.5c1-6.5 3.5-11.5 7.5-14.5A11 11 0 0 1 30 6Z" fill="#f2b84b" {...edge} /></svg>;
    case "star":
      return <svg viewBox="0 0 60 60"><path d="M30 5l7.5 15.5 17 2.5-12.3 12 2.9 17L30 44l-15.1 8 2.9-17L5.5 23l17-2.5Z" fill="#f6d365" {...edge} /></svg>;
    default:
      return <svg viewBox="0 0 60 56"><path d="M30 52S5 36 5 19A12.5 12.5 0 0 1 30 13 12.5 12.5 0 0 1 55 19c0 17-25 33-25 33Z" fill="var(--primary)" {...edge} /></svg>;
  }
}

/**
 * „Willkommen zurück“: Papierteile flattern herein und legen sich um das Logo, der Avatar wird aufgeklebt,
 * unten füllt sich ein Ladebalken aus Papierstreifen. Währenddessen lädt die App alles Nötige.
 * Antippen überspringt, nach gut drei Sekunden geht es in jedem Fall weiter.
 */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [loaded, setLoaded] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const quick = useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;
  const [name] = useState(myName);
  const [avatar] = useState(myAvatar);
  const left = useRef(false);

  const leave = () => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    setTimeout(onDone, quick ? 150 : 380);
  };

  // Kein Takt mehr, der neu zeichnet: der Balken läuft als CSS-Animation (flüssig, auch wenn die App gerade lädt).
  // Die Streifen füllen sich nach der Zeit, der letzte erst, wenn alles geladen ist – ist er voll, geht es weiter.
  useEffect(() => {
    void boot(setLoaded);
    const t = setTimeout(leave, quick ? QUICK_MS * 2 : MAX_MS);
    return () => clearTimeout(t);
  }, []);

  const strips = 5;
  // Dauer je Streifen, so dass alle zusammen kurz vor der Mindestzeit voll sind
  const each = ((quick ? QUICK_MS : MIN_MS) - 200) / strips;
  const ready = loaded >= 1;

  return (
    <div role="status" aria-live="polite" aria-label={`Willkommen zurück, ${name}`} data-testid="welcome" onClick={leave}
      className={cn("intro-bg fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden px-6", leaving && "intro-out")}>
      <div className="relative size-72 shrink-0">
        {PIECES.map((p) => (
          <span key={p.id} className="paper-piece absolute top-1/2 left-1/2"
            style={{ width: p.size, height: p.size, "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, "--fx": `${p.fx}px`, "--fy": `${p.fy}px`, "--fr": `${p.fr}deg`, animationDelay: `${p.delay}s` } as CSSProperties}>
            <Shape id={p.id} />
          </span>
        ))}
        <div className="logo-pop absolute top-1/2 left-1/2 -mt-12 -ml-12">
          <Logo className="size-24 -rotate-6 rounded-3xl shadow-[0_6px_0_rgb(0_0_0/0.12),0_16px_30px_rgb(0_0_0/0.18)]" />
          <span className="avatar-stick absolute -right-5 -bottom-4">
            <span className="tape absolute -top-2 left-1/2 h-3.5 w-9 -translate-x-1/2 rotate-[-12deg]" />
            <Avatar avatar={avatar} className="size-14 text-3xl ring-4 ring-[var(--paper)] shadow-[0_4px_10px_rgb(0_0_0/0.2)]" />
          </span>
        </div>
      </div>
      <p className="text-rise mt-4 text-lg text-muted-foreground" style={{ animationDelay: "1.35s" }}>Willkommen zurück,</p>
      <h1 className="text-rise font-display max-w-full truncate text-4xl font-bold tracking-tight" style={{ animationDelay: "1.5s" }}>{name}!</h1>
      <div className="mt-8 flex w-56 gap-1.5" aria-hidden="true" data-testid="welcome-progress">
        {Array.from({ length: strips }, (_, i) => (
          <span key={i} className="strip relative h-2.5 flex-1 overflow-hidden rounded-[3px] bg-foreground/10" style={{ rotate: `${[-2, 1.5, -1, 2, -1.5][i]}deg` }}>
            <span className="strip-fill absolute inset-0 origin-left bg-primary"
              style={{ animationDuration: `${each}ms`, animationDelay: `${i * each}ms`, animationPlayState: i < strips - 1 || ready ? "running" : "paused" }}
              onAnimationEnd={i === strips - 1 ? () => setTimeout(leave, 200) : undefined} />
          </span>
        ))}
      </div>
      <p className="text-rise absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground/70" style={{ animationDelay: "1.8s" }}>Tippen zum Überspringen</p>
    </div>
  );
}
