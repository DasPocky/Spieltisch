import type { CardType } from "@shared/games/tutto/logic";

/** Augen-Positionen für Würfelseiten 1–6 (im 10×10-Raster) */
const PIPS: Record<number, [number, number][]> = {
  1: [[5, 5]],
  2: [[3, 3], [7, 7]],
  3: [[3, 3], [5, 5], [7, 7]],
  4: [[3, 3], [7, 3], [3, 7], [7, 7]],
  5: [[3, 3], [7, 3], [5, 5], [3, 7], [7, 7]],
  6: [[3, 3], [7, 3], [3, 5], [7, 5], [3, 7], [7, 7]],
};

/** Helle Tönung einer Kartenfarbe (für Flächen) */
const tint = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

function Art({ card }: { card: CardType }) {
  const c = card.color;
  switch (card.id) {
    case "stop": {
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        return `${50 + Math.cos(a) * 40},${50 + Math.sin(a) * 40}`;
      }).join(" ");
      return (
        <g>
          <polygon points={pts} fill={c} />
          <text x="50" y="58.5" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff" letterSpacing="1">STOP</text>
        </g>
      );
    }
    case "clover": {
      const leaf = "M50 50 C 32 45, 25 25, 39 19 C 46 16, 50 24, 50 31 C 50 24, 54 16, 61 19 C 75 25, 68 45, 50 50 Z";
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={tint(c, 0.12)} />
          {[0, 90, 180, 270].map((r) => <path key={r} d={leaf} fill={c} transform={`rotate(${r} 50 50)`} />)}
          <path d="M52 54 Q 57 70 66 80" stroke={c} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case "fire": {
      const burst = (cx: number, cy: number, r: number, n: number, o: number) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return <line key={`${cx}-${i}`} x1={cx + Math.cos(a) * r * 0.4} y1={cy + Math.sin(a) * r * 0.4} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke={c} strokeOpacity={o} strokeWidth="3.2" strokeLinecap="round" />;
        });
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={tint(c, 0.1)} />
          {burst(50, 44, 28, 14, 1)}
          {burst(26, 72, 13, 10, 0.55)}
          {burst(75, 74, 12, 10, 0.55)}
        </g>
      );
    }
    case "street":
      return (
        <g>
          {[1, 2, 3, 4, 5, 6].map((n, i) => {
            const x = 9 + (i % 3) * 29, y = 22 + Math.floor(i / 3) * 29, k = 2.3;
            return (
              <g key={n} transform={`translate(${x} ${y})`}>
                <rect width="23" height="23" rx="4.5" fill={tint(c, 0.12)} stroke={c} strokeWidth="1.6" />
                {PIPS[n].map(([px, py], j) => <circle key={j} cx={px * k} cy={py * k} r="2.1" fill={c} />)}
              </g>
            );
          })}
        </g>
      );
    case "x2":
      return (
        <g>
          <circle cx="40" cy="54" r="28" fill={tint(c, 0.12)} stroke={c} strokeWidth="2.5" />
          <circle cx="60" cy="46" r="28" fill="#fdfdfb" stroke={c} strokeWidth="2.5" />
          <circle cx="60" cy="46" r="28" fill={tint(c, 0.12)} />
          <text x="60" y="58" textAnchor="middle" fontSize="32" fontWeight="800" fill={c}>×2</text>
        </g>
      );
    case "pm":
      return (
        <g>
          <circle cx="32" cy="50" r="24" fill={tint("#4f8a5e", 0.14)} stroke="#4f8a5e" strokeWidth="2.5" />
          <path d="M32 38 V62 M20 50 H44" stroke="#4f8a5e" strokeWidth="5" strokeLinecap="round" />
          <circle cx="68" cy="50" r="24" fill={tint("#a84a57", 0.14)} stroke="#a84a57" strokeWidth="2.5" />
          <path d="M56 50 H80" stroke="#a84a57" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    default: {
      const ray = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r = i % 2 ? 36 : 45;
        return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
      }).join(" ");
      return (
        <g>
          <polygon points={ray} fill={tint(c, 0.16)} />
          <circle cx="50" cy="50" r="26" fill="none" stroke={c} strokeWidth="2.5" />
          <path d="M50 34 L54.7 44.6 66 45.6 57.4 53.2 60 64.4 50 58.4 40 64.4 42.6 53.2 34 45.6 45.3 44.6 Z" fill={c} />
        </g>
      );
    }
  }
}

const TITLE: Partial<Record<CardType["id"], string>> = { b200: "Bonus", b300: "Bonus", b400: "Bonus", b500: "Bonus", b600: "Bonus", pm: "Plus / Minus", x2: "Verdoppeln" };

/** Kurztext unten auf Karten ohne festen Punktwert */
const FOOT: Partial<Record<CardType["id"], string>> = { fire: "Bis zur Niete", stop: "Zug vorbei", clover: "Sofort-Sieg" };

/**
 * Vorderseite im Stil der Tutto-Karten: weiße Karte, feiner farbiger Rahmen, Titel, ruhiges Bild
 * und unten immer an derselben Stelle der Punktwert.
 */
export function CardFace({ card }: { card: CardType }) {
  const title = TITLE[card.id] ?? card.name;
  return (
    <div className="size-full rounded-[7cqw] bg-paper p-[4cqw]">
      <div className="flex size-full flex-col items-center rounded-[4.5cqw] px-[5cqw] pt-[7cqw] pb-[6cqw] text-paper-ink" style={{ boxShadow: `inset 0 0 0 1.6cqw ${card.color}` }}>
        <div className="text-[8.5cqw] leading-none font-extrabold tracking-[0.08em] uppercase" style={{ color: card.color }}>{title}</div>
        <div className="mt-[2.5cqw] h-[0.9cqw] w-[18cqw] rounded-full" style={{ background: tint(card.color, 0.45) }} />
        <svg viewBox="0 0 100 100" className="my-[3cqw] min-h-0 w-[80%] flex-1" aria-hidden="true">
          <Art card={card} />
        </svg>
        <div className="flex h-[15cqw] min-w-[56%] items-center justify-center gap-[1.5cqw] rounded-full px-[5cqw] whitespace-nowrap" style={{ background: tint(card.color, 0.13), color: card.color }}>
          {card.value ? (
            <>
              <b className="text-[10cqw] leading-none font-extrabold tabular-nums">{card.value}</b>
              <span className="text-[6cqw] leading-none font-semibold opacity-80">Punkte</span>
            </>
          ) : (
            <span className="text-[7cqw] leading-none font-bold">{FOOT[card.id]}</span>
          )}
        </div>
      </div>
    </div>
  );
}
