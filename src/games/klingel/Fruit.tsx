import type { CSSProperties } from "react";
import { countOf, fruitOf, FRUIT_NAME, type Fruit } from "@shared/games/klingel/logic";
import { cn } from "@/lib/utils";

/** Obst als einfache, eigene Formen (24×24) */
export function FruitShape({ fruit, x = 0, y = 0, size = 24 }: { fruit: Fruit; x?: number; y?: number; size?: number }) {
  const k = size / 24;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {fruit === "erdbeere" && (
        <>
          <path d="M12 21.5C6.4 18 3.8 13.3 4.6 9.8 5.3 6.9 8.4 6.1 12 7.3c3.6-1.2 6.7-.4 7.4 2.5.8 3.5-1.8 8.2-7.4 11.7z" fill="#e0464f" />
          {[[9, 10.5], [14.5, 10.2], [12, 13], [8.7, 14.6], [15.2, 14.4], [12, 17.4]].map(([cx, cy]) => <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="0.65" ry="0.95" fill="#ffe3a1" />)}
          <path d="M7.5 7.6 9.6 4.4l2.4 2.1 2.4-2.1 2.1 3.2-2.6.4L12 9.1 10.1 8z" fill="#3f9a4a" />
        </>
      )}
      {fruit === "banane" && (
        <>
          <path d="M4.2 6.2c1.6 8.7 8.6 13.7 16 10.2.9-.4.7-1.7-.3-1.6C13.6 15.6 8.4 12 6.6 5.6c-.3-1-2.6-.6-2.4.6z" fill="#f5c542" stroke="#c99a1e" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M6 7.5c1.8 5 5.6 7.8 10.6 7.9" fill="none" stroke="#c99a1e" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
          <rect x="3.4" y="4.2" width="2.4" height="2.4" rx="0.7" fill="#6b4a1f" transform="rotate(-18 4.6 5.4)" />
        </>
      )}
      {fruit === "pflaume" && (
        <>
          <path d="M12 6.4c4.6 0 7.4 3.4 7.4 7.4S16.3 21.4 12 21.4 4.6 17.8 4.6 13.8 7.4 6.4 12 6.4z" fill="#7b4fa0" />
          <path d="M12 7.2c-.9 3.8-.9 9.6 0 13.6" fill="none" stroke="#5c3680" strokeWidth="0.8" />
          <ellipse cx="8.7" cy="11.4" rx="1.4" ry="2.2" fill="#fff" opacity="0.28" transform="rotate(20 8.7 11.4)" />
          <path d="M12 6.8c.2-1.6.8-2.9 1.8-3.8" fill="none" stroke="#6b4a1f" strokeWidth="1" strokeLinecap="round" />
          <path d="M13.6 4.2c1.6-1.2 3.8-1 4.8.2-1.4 1.2-3.4 1.2-4.8-.2z" fill="#3f9a4a" />
        </>
      )}
      {fruit === "birne" && (
        <>
          <path d="M12 4.6c1.7 0 2.2 2 2.6 3.7.5 2 4.4 3.9 4.4 8.1 0 3.4-3 5.2-7 5.2s-7-1.8-7-5.2c0-4.2 3.9-6.1 4.4-8.1.4-1.7.9-3.7 2.6-3.7z" fill="#9cc54a" />
          <ellipse cx="9" cy="15.5" rx="1.3" ry="2.4" fill="#fff" opacity="0.25" transform="rotate(15 9 15.5)" />
          <path d="M12 4.8c0-1.2.3-2.2 1-3" fill="none" stroke="#6b4a1f" strokeWidth="1" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

/** Lage der Früchte auf der Karte (Mitte in Prozent), je nach Anzahl wie Würfelaugen */
const SPOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[31, 30], [69, 70]],
  3: [[28, 25], [50, 50], [72, 75]],
  4: [[29, 28], [71, 28], [29, 72], [71, 72]],
  5: [[27, 23], [73, 23], [50, 50], [27, 77], [73, 77]],
};

const W = 50, H = 70;

/** Obstkarte: Papier mit 1–5 Früchten einer Sorte */
export function FruitCard({ card, className, label = true, style }: { card: string; className?: string; label?: boolean; style?: CSSProperties }) {
  const fruit = fruitOf(card), n = countOf(card);
  const size = n === 1 ? 30 : n >= 4 ? 19 : 21;
  const name = FRUIT_NAME[fruit] ? `${n} ${n === 1 ? FRUIT_NAME[fruit].one : FRUIT_NAME[fruit].many}` : card;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("drop-shadow-md", className)} style={style} role={label ? "img" : undefined} aria-label={label ? name : undefined} aria-hidden={label ? undefined : true}
      data-testid="fruit-card" data-card={card}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="5" fill="#fffdf8" stroke="#2b2118" strokeOpacity="0.18" strokeWidth="1" />
      <rect x="4" y="4" width={W - 8} height={H - 8} rx="3.2" fill="none" stroke="#2b2118" strokeOpacity="0.08" strokeWidth="0.8" />
      {(SPOTS[n] ?? SPOTS[1]).map(([px, py], i) => <FruitShape key={i} fruit={fruit} x={(px / 100) * W - size / 2} y={(py / 100) * H - size / 2} size={size} />)}
    </svg>
  );
}

/** Leerer Platz, solange noch nichts offen liegt */
export function EmptySlot({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} style={style} aria-hidden="true" data-testid="fruit-empty">
      <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.4" strokeDasharray="4 3" />
    </svg>
  );
}

/** Rückseite (verdeckter Stapel) */
export function CardBack({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("drop-shadow", className)} style={style} aria-hidden="true">
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="5" fill="#c2492e" />
      <rect x="5" y="5" width={W - 10} height={H - 10} rx="3" fill="none" stroke="#fffdf8" strokeOpacity="0.55" strokeWidth="1.2" />
      <FruitShape fruit="erdbeere" x={W / 2 - 10} y={H / 2 - 10} size={20} />
    </svg>
  );
}

/** Die Klingel: Glocke auf Sockel, `down` = gedrückt */
export function BellShape({ className, down }: { className?: string; down?: boolean }) {
  return (
    <svg viewBox="0 0 100 84" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="kl-dome" cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.35" stopColor="#f2c84b" />
          <stop offset="1" stopColor="#b9871c" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="76" rx="44" ry="6" fill="#000" opacity="0.18" />
      <rect x="8" y="64" width="84" height="11" rx="5.5" fill="#3a2a1e" />
      <rect x="8" y="64" width="84" height="4" rx="2" fill="#5a4330" />
      <g transform={down ? "translate(0 3)" : undefined}>
        <rect x="45" y="9" width="10" height="12" rx="2" fill="#6b5a4a" />
        <ellipse cx="50" cy="9" rx="9" ry="4.2" fill="#3a2a1e" />
      </g>
      <path d="M12 64C12 37 28 21 50 21s38 16 38 43z" fill="url(#kl-dome)" stroke="#8a6414" strokeWidth="1.2" />
      <path d="M24 46c3-10 10-16 19-18" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
