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
/** Spielsteine: woher sie aufsteigen (fx, fy) und wo sie um das Logo schweben bleiben (x, y) */
const PIECES: Piece[] = [
  { id: "card-a", x: -78, y: -62, r: -16, fx: -200, fy: 420, fr: -60, delay: 0, size: 58 },
  { id: "card-b", x: 80, y: -58, r: 14, fx: 220, fy: 440, fr: 70, delay: 0.08, size: 54 },
  { id: "die", x: -86, y: 56, r: 10, fx: -160, fy: 520, fr: 90, delay: 0.16, size: 48 },
  { id: "pawn", x: 86, y: 60, r: -6, fx: 180, fy: 540, fr: -80, delay: 0.24, size: 46 },
  { id: "star", x: 0, y: -100, r: 8, fx: 30, fy: 560, fr: 120, delay: 0.32, size: 38 },
  { id: "heart", x: -4, y: 104, r: -10, fx: -40, fy: 600, fr: -90, delay: 0.4, size: 34 },
];
/** Blasen wie im EndLab-Icon: steigen langsam durchs Bild */
const BUBBLES = [
  { x: "12%", s: 18, d: 0, t: 3.4 }, { x: "28%", s: 10, d: 0.6, t: 2.8 }, { x: "46%", s: 26, d: 0.2, t: 4 },
  { x: "64%", s: 12, d: 0.9, t: 3 }, { x: "80%", s: 20, d: 0.4, t: 3.6 }, { x: "90%", s: 8, d: 1.2, t: 2.6 },
];

const ICE = "#3fb6d8";
const NAVY = "#0e2240";
const WHITE = "#ffffff";

/** Die Steine in den EndLab-Farben: Weiß und Eisblau auf Marineblau */
function Shape({ id }: { id: string }) {
  switch (id) {
    case "card-a":
      return <svg viewBox="0 0 60 80"><rect x="4" y="4" width="52" height="72" rx="10" fill={WHITE} /><circle cx="30" cy="40" r="11" fill={ICE} /></svg>;
    case "card-b":
      return <svg viewBox="0 0 60 80"><rect x="4" y="4" width="52" height="72" rx="10" fill={ICE} /><path d="M30 24 L40 40 L30 56 L20 40 Z" fill={WHITE} /></svg>;
    case "die":
      return <svg viewBox="0 0 60 60"><rect x="4" y="4" width="52" height="52" rx="12" fill={WHITE} />{[[18, 18], [42, 18], [30, 30], [18, 42], [42, 42]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="4.5" fill={i === 2 ? ICE : NAVY} />)}</svg>;
    case "pawn":
      return <svg viewBox="0 0 60 70"><path d="M30 6a11 11 0 0 1 7 19.5c4 3 6.5 8 7.5 14.5l4 20.5a4 4 0 0 1-4 4.5H15.5a4 4 0 0 1-4-4.5l4-20.5c1-6.5 3.5-11.5 7.5-14.5A11 11 0 0 1 30 6Z" fill={ICE} /></svg>;
    case "star":
      return <svg viewBox="0 0 60 60"><path d="M30 5l7.5 15.5 17 2.5-12.3 12 2.9 17L30 44l-15.1 8 2.9-17L5.5 23l17-2.5Z" fill={WHITE} /></svg>;
    default:
      return <svg viewBox="0 0 60 56"><path d="M30 52S5 36 5 19A12.5 12.5 0 0 1 30 13 12.5 12.5 0 0 1 55 19c0 17-25 33-25 33Z" fill={ICE} /></svg>;
  }
}

/**
 * „Willkommen zurück“ im EndLab-Look: Spielsteine steigen wie Blasen auf und schweben um das Logo, der Avatar
 * dockt mit eisblauem Ring an, unten füllt sich ein eisblauer Ladebalken. Währenddessen lädt die App alles Nötige.
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
      className={cn("welcome-bg fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden px-6", leaving && "intro-out")}>
      <svg className="welcome-wave pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 512 94" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 22C110 -20 214 50 330 14S474 -16 512 0V94H0Z" fill={ICE} opacity=".22" />
      </svg>
      {BUBBLES.map((b, i) => (
        <span key={i} aria-hidden="true" className="welcome-bubble pointer-events-none absolute bottom-0 rounded-full"
          style={{ left: b.x, width: b.s, height: b.s, animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }} />
      ))}
      <div className="relative size-72 shrink-0">
        {PIECES.map((p) => (
          <span key={p.id} className="paper-piece absolute top-1/2 left-1/2"
            style={{ width: p.size, height: p.size, "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, "--fx": `${p.fx}px`, "--fy": `${p.fy}px`, "--fr": `${p.fr}deg`, animationDelay: `${p.delay}s` } as CSSProperties}>
            <Shape id={p.id} />
          </span>
        ))}
        <div className="logo-pop absolute top-1/2 left-1/2 -mt-12 -ml-12">
          <Logo className="size-24 rounded-[1.6rem] shadow-[0_0_0_3px_rgb(255_255_255/0.85),0_0_36px_rgb(63_182_216/0.45),0_16px_40px_rgb(0_0_0/0.35)]" />
          <span className="avatar-stick absolute -right-5 -bottom-4">
            <Avatar avatar={avatar} className="size-14 text-3xl ring-4 ring-[#3fb6d8] shadow-[0_4px_14px_rgb(0_0_0/0.35)]" />
          </span>
        </div>
      </div>
      <p className="text-rise mt-4 text-lg text-white/75" style={{ animationDelay: "1.35s" }}>Willkommen zurück,</p>
      <h1 className="text-rise font-display max-w-full truncate text-4xl font-bold tracking-tight text-white" style={{ animationDelay: "1.5s" }}>{name}!</h1>
      <div className="mt-8 flex w-56 gap-1.5" aria-hidden="true" data-testid="welcome-progress">
        {Array.from({ length: strips }, (_, i) => (
          <span key={i} className="strip relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <span className="strip-fill absolute inset-0 origin-left bg-[#3fb6d8]"
              style={{ animationDuration: `${each}ms`, animationDelay: `${i * each}ms`, animationPlayState: i < strips - 1 || ready ? "running" : "paused" }}
              onAnimationEnd={i === strips - 1 ? () => setTimeout(leave, 200) : undefined} />
          </span>
        ))}
      </div>
      <p className="text-rise absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] text-xs text-white/55" style={{ animationDelay: "1.8s" }}>Tippen zum Überspringen</p>
    </div>
  );
}
