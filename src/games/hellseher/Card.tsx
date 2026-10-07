import { cardLabel, isFool, isWizard, rankOf, suitOf, type HsCard, type Suit } from "@shared/games/hellseher/logic";
import { cn } from "@/lib/utils";

/** Farben wie bei den bekannten Zauberer-Karten: Blau, Rot, Grün, Gelb */
export const HS_BG: Record<Suit, string> = { b: "#2a62b6", r: "#c7372f", g: "#2f8f4a", y: "#e0a91c" };
const HS_DARK: Record<Suit, string> = { b: "#173d78", r: "#821d18", g: "#1b5a2d", y: "#9a6c06" };
const INK = "#16182a";

/** Kleines Farbzeichen (hilft bei Farbschwäche): Kreis, Dreieck, Blatt, Raute */
export function SuitMark({ suit, fill = "#fff", size = 1 }: { suit: Suit; fill?: string; size?: number }) {
  return (
    <g transform={`scale(${size})`} fill={fill}>
      {suit === "b" && <circle r={3.2} />}
      {suit === "r" && <path d="M0-3.8L3.6 2.8H-3.6Z" />}
      {suit === "g" && <path d="M0-4C3.4-1.6 3.4 1.8 0 4C-3.4 1.8-3.4-1.6 0-4Z" />}
      {suit === "y" && <path d="M0-4L3.4 0L0 4L-3.4 0Z" />}
    </g>
  );
}

const Star = ({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) => (
  <path transform={`translate(${x} ${y}) scale(${r})`} fill={fill} d="M0-1L.29-.4L.95-.31L.48.15L.59.81L0 .5L-.59.81L-.48.15L-.95-.31L-.29-.4Z" />
);

/** Vorderseite: weißer Rand, Farbfläche, große Zahl – Zauberer dunkelblau mit Sternen, Narr hell mit Narrenkappe */
export function HsCardView({ card, dim, className }: { card: HsCard; dim?: boolean; className?: string }) {
  const s = suitOf(card);
  const v = rankOf(card);
  const wiz = isWizard(card);
  const fool = isFool(card);
  const label = wiz ? "Z" : fool ? "N" : String(v);
  const fill = s ? HS_BG[s] : wiz ? "#25205a" : "#dfe6ee";
  const dark = s ? HS_DARK[s] : wiz ? "#0f0c33" : "#9aa8b8";
  const ink = fool ? INK : "#fff";
  const corner = (
    <g>
      <text textAnchor="middle" dominantBaseline="central" fontSize={label.length > 1 ? 11 : 13} fontWeight={800} fill={wiz ? "#f4cf5a" : ink}>{label}</text>
      {s && <g transform="translate(0 10)"><SuitMark suit={s} fill="#fff" size={0.75} /></g>}
    </g>
  );
  return (
    <div role="img" aria-label={cardLabel(card)}
      className={cn("relative aspect-[5/7] overflow-hidden rounded-[11%] bg-[#fbfaf6] shadow-md ring-1 ring-black/25 transition", dim && "card-dim", className)}>
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <linearGradient id={`hs-${card}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={fill} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
        </defs>
        <rect x={2.4} y={2.4} width={45.2} height={65.2} rx={4.4} fill={`url(#hs-${card})`} />
        {wiz && (
          <g>
            <Star x={14} y={24} r={2.4} fill="#f4cf5a" /><Star x={37} y={18} r={1.8} fill="#f4cf5a" /><Star x={36} y={52} r={2.2} fill="#f4cf5a" />
            <Star x={15} y={50} r={1.5} fill="#cfd6ff" /><Star x={25} y={14} r={1.3} fill="#cfd6ff" />
            <text x={25} y={36} textAnchor="middle" dominantBaseline="central" fontSize={28} fontWeight={800} fill="#f4cf5a" fontFamily="Georgia, serif" style={{ fontStyle: "italic" }}>Z</text>
          </g>
        )}
        {fool && (
          <g>
            {/* Narrenkappe mit drei Zipfeln */}
            <path d="M14 46Q16 34 12 26Q20 30 25 22Q30 30 38 26Q34 34 36 46Z" fill="#c7372f" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
            <path d="M25 22Q27 32 25 46" fill="none" stroke={INK} strokeWidth={0.7} />
            <circle cx={12} cy={26} r={2} fill="#e0a91c" stroke={INK} strokeWidth={0.7} />
            <circle cx={25} cy={21.5} r={2} fill="#2f8f4a" stroke={INK} strokeWidth={0.7} />
            <circle cx={38} cy={26} r={2} fill="#2a62b6" stroke={INK} strokeWidth={0.7} />
            <rect x={13} y={45} width={24} height={4.5} rx={2} fill="#e0a91c" stroke={INK} strokeWidth={0.8} />
          </g>
        )}
        {s && (
          <g transform="translate(25 35)">
            <ellipse rx={14.5} ry={19} fill="#fff" opacity={0.94} />
            <text y={1} textAnchor="middle" dominantBaseline="central" fontSize={v >= 10 ? 19 : 23} fontWeight={800} fill={HS_DARK[s]}>{v}</text>
          </g>
        )}
        <g transform="translate(8.5 10)">{corner}</g>
        <g transform="translate(41.5 60) rotate(180)">{corner}</g>
      </svg>
    </div>
  );
}

/** Rückseite: Nachthimmel mit Mondsichel und Sternen – ohne Schriftzug */
export function HsBack({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative aspect-[5/7] overflow-hidden rounded-[11%] bg-[#fbfaf6] shadow-md ring-1 ring-black/25", className)}>
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        <rect x={2.4} y={2.4} width={45.2} height={65.2} rx={4.4} fill="#1c2f6e" />
        <rect x={5} y={5} width={40} height={60} rx={3} fill="none" stroke="#f4cf5a" strokeWidth={0.7} opacity={0.7} />
        <path d="M30 22A13 13 0 1 0 30 48A10 10 0 1 1 30 22Z" fill="#f4cf5a" />
        <Star x={34} y={30} r={2.2} fill="#f4cf5a" /><Star x={14} y={16} r={1.6} fill="#cfd6ff" /><Star x={37} y={56} r={1.6} fill="#cfd6ff" /><Star x={13} y={56} r={1.2} fill="#f4cf5a" />
      </svg>
      {children}
    </div>
  );
}
