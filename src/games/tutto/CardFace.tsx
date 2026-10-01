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

/** Kräftige Kartenfarben nah am Original (Rahmen, Titel, Bild) */
const COLOR: Record<CardType["id"], string> = {
  b200: "#e3a400", b300: "#e3a400", b400: "#e3a400", b500: "#e3a400", b600: "#e3a400",
  x2: "#6a3fb5", fire: "#e2541c", street: "#1f6db8", pm: "#2e9a48", stop: "#d42a26", clover: "#2e9a48", torte: "#d6487a",
};
const RED = "#d42a26";

/** Würfel mit Augen (Seitenlänge s) an Position x/y */
function Die({ n, x, y, s, c, rot = 0 }: { n: number; x: number; y: number; s: number; c: string; rot?: number }) {
  const k = s / 10;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot} ${s / 2} ${s / 2})`}>
      <rect width={s} height={s} rx={s * 0.2} fill="#fff" stroke={c} strokeWidth="1.8" />
      {PIPS[n].map(([px, py], j) => <circle key={j} cx={px * k} cy={py * k} r={s * 0.095} fill={c} />)}
    </g>
  );
}

/** Stern mit n Zacken (für Bonus und Feuerwerk) */
const star = (cx: number, cy: number, r1: number, r2: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ");

function Art({ card, c }: { card: CardType; c: string }) {
  // Chance: gleiche Wirkung wie Feuerwerk – Sternschnuppe auf Nachthimmel
  if (card.id === "fire" && card.name === "Chance") {
    const star = (cx: number, cy: number, r: number, fill: string) => {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
      });
      return <polygon points={pts.join(" ")} fill={fill} />;
    };
    return (
      <g>
        <rect x="8" y="8" width="84" height="84" rx="12" fill="#17305c" />
        {[[22, 24, 1.2], [76, 20, 1.5], [84, 50, 1], [30, 80, 1.3], [62, 84, 1], [16, 56, 0.9]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />)}
        {/* Schweif */}
        <path d="M16 82 Q 42 66 60 42" stroke="#ffd45c" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.35" />
        <path d="M22 78 Q 44 64 60 42" stroke="#ffe08a" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M30 76 Q 48 62 60 42" stroke="#fff6d6" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="62" cy="38" r="20" fill="#ffd45c" opacity="0.22" />
        <g>{star(62, 38, 19, "#ffc83d")}</g>
        <g>{star(62, 38, 9, "#fff3c4")}</g>
      </g>
    );
  }
  switch (card.id) {
    case "stop": {
      const oct = (r: number) => Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        return `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
      }).join(" ");
      return (
        <g>
          <polygon points={oct(44)} fill={c} />
          <polygon points={oct(39.5)} fill="none" stroke="#fff" strokeWidth="3" />
          <text x="50" y="58.5" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff">STOP</text>
        </g>
      );
    }
    case "clover": {
      const leaf = "M50 50 C 30 46, 22 24, 37 17 C 45 13, 50 22, 50 30 C 50 22, 55 13, 63 17 C 78 24, 70 46, 50 50 Z";
      return (
        <g>
          <path d="M52 56 Q 58 74 70 88" stroke="#1f7a35" strokeWidth="5" fill="none" strokeLinecap="round" />
          {[0, 90, 180, 270].map((r) => (
            <g key={r} transform={`rotate(${r} 50 50)`}>
              <path d={leaf} fill={c} stroke="#1f7a35" strokeWidth="1.5" />
              <path d="M50 46 L50 30" stroke="#bfe8c8" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          ))}
          <circle cx="50" cy="50" r="3.5" fill="#1f7a35" />
        </g>
      );
    }
    case "fire": {
      const burst = (cx: number, cy: number, r: number, n: number, col: string) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return (
            <g key={`${cx}-${i}`}>
              <line x1={cx + Math.cos(a) * r * 0.3} y1={cy + Math.sin(a) * r * 0.3} x2={cx + Math.cos(a) * r * 0.85} y2={cy + Math.sin(a) * r * 0.85} stroke={col} strokeWidth="2.6" strokeLinecap="round" />
              <circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r="1.9" fill={col} />
            </g>
          );
        });
      return (
        <g>
          <rect x="4" y="4" width="92" height="92" rx="14" fill="#1b2350" />
          {[[16, 18], [84, 14], [12, 60], [88, 52], [70, 88], [30, 90]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#fff" opacity=".8" />)}
          {burst(48, 38, 26, 16, "#ffcc33")}
          {burst(25, 68, 15, 12, "#ff5a3c")}
          {burst(74, 70, 16, 12, "#ff9a2e")}
          <circle cx="48" cy="38" r="4" fill="#fff6c8" />
          <path d="M48 96 Q 47 70 48 46 M25 96 Q 25 85 25 75 M74 96 Q 75 86 74 78" stroke="#ffffff55" strokeWidth="1.2" strokeDasharray="2 2.5" fill="none" />
        </g>
      );
    }
    case "street":
      return (
        <g>
          {/* Sechs Würfel 1–6, leicht versetzt wie eine Straße */}
          {[1, 2, 3, 4, 5, 6].map((n, i) => <Die key={n} n={n} x={5 + (i % 3) * 31} y={(i < 3 ? 16 : 54) + (i % 3) * 3 - (i < 3 ? 0 : 3)} s={27} c={c} rot={i % 2 ? 7 : -7} />)}
        </g>
      );
    case "x2":
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={c} />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity=".5" />
          <text x="50" y="65" textAnchor="middle" fontSize="44" fontWeight="900" fill="#fff">×2</text>
        </g>
      );
    case "torte":
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={tint(c, 0.12)} />
          <rect x="20" y="56" width="60" height="24" rx="4" fill={c} />
          <rect x="29" y="37" width="42" height="19" rx="3.5" fill="#ffd2e0" stroke={c} strokeWidth="2" />
          <path d="M20 62 q7.5 6 15 0 t15 0 t15 0 t15 0" stroke="#fff" strokeWidth="3" fill="none" />
          {[38, 50, 62].map((x) => (
            <g key={x}>
              <rect x={x - 1.8} y="24" width="3.6" height="13" rx="1.2" fill="#6aa8e8" />
              <path d={`M${x} 15 q4.5 5 0 8.5 q-4.5 -3.5 0 -8.5 Z`} fill="#ffb21f" />
            </g>
          ))}
        </g>
      );
    case "pm":
      return (
        <g>
          <circle cx="34" cy="36" r="25" fill="#2e9a48" />
          <path d="M34 24 V48 M22 36 H46" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <circle cx="66" cy="66" r="25" fill={RED} stroke="#fff" strokeWidth="3" />
          <path d="M54 66 H78" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        </g>
      );
    default:
      // Bonus: goldener Stern mit großem Wert
      return (
        <g>
          <polygon points={star(50, 50, 47, 36, 16)} fill="#ffd23f" stroke={c} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="50" r="30" fill="#fff" stroke={c} strokeWidth="2.5" />
          <text x="50" y="60" textAnchor="middle" fontSize="28" fontWeight="900" fill="#b97800" letterSpacing="-1">{card.big}</text>
        </g>
      );
  }
}

const TITLE: Partial<Record<CardType["id"], string>> = { b200: "Bonus", b300: "Bonus", b400: "Bonus", b500: "Bonus", b600: "Bonus", pm: "Plus / Minus", x2: "Verdoppeln" };

/** Kurztext unten auf Karten ohne Punktwert – Bonus und ×2 zeigen unten ihren Wert wie auf der echten Karte */
const FOOT: Partial<Record<CardType["id"], string>> = { fire: "Bis zur Niete", stop: "Zug vorbei", clover: "Sofort-Sieg", x2: "Punkte ×2" };

/**
 * Vorderseite im Stil der Tutto-Karten: kräftiger farbiger Rahmen, weißes Feld mit Titel oben,
 * großes Bild in der Mitte und unten immer an derselben Stelle Punktwert oder Kurztext.
 */
export function CardFace({ card }: { card: CardType }) {
  const c = card.name === "Chance" ? card.color : COLOR[card.id] ?? card.color;
  const title = TITLE[card.id] ?? card.name;
  const foot = FOOT[card.id];
  // Plus/Minus: Rahmen halb grün, halb rot
  const frame = card.id === "pm" ? `linear-gradient(135deg, ${c} 50%, ${RED} 50%)` : c;
  // Gold ist für weiße Schrift zu hell – Leiste unten dunkler
  const bar = c === COLOR.b200 ? "#b97800" : frame;
  return (
    // Eigener Container: alle Maße wachsen mit der Kartenbreite, egal wo die Karte steckt
    <div className="@container size-full">
    <div className="size-full rounded-[7cqw] p-[4.5cqw] shadow-[inset_0_0_0_0.6cqw_rgba(0,0,0,.12)]" style={{ background: frame }}>
      <div className="flex size-full flex-col items-center rounded-[4cqw] bg-white px-[4cqw] pt-[6cqw] pb-[5cqw] text-paper-ink">
        <div className="text-[9.5cqw] leading-none font-black tracking-[0.06em] uppercase" style={{ color: card.id === "pm" ? "#1f2937" : c }}>{title}</div>
        <svg viewBox="0 0 100 100" className="my-[3cqw] min-h-0 w-[86%] flex-1" aria-hidden="true">
          <Art card={card} c={c} />
        </svg>
        <div className="flex h-[15cqw] min-w-[60%] items-center justify-center gap-[1.5cqw] rounded-full px-[5cqw] whitespace-nowrap text-white" style={{ background: bar }}>
          {foot ? (
            <span className="text-[7.5cqw] leading-none font-extrabold">{foot}</span>
          ) : (
            <>
              <b className="text-[10.5cqw] leading-none font-black tabular-nums">{card.value}</b>
              <span className="text-[6cqw] leading-none font-bold opacity-90">Punkte</span>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
