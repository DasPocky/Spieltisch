import type { Mood } from "./lines";

/**
 * Moderator-Figuren zur Auswahl – alle als leichte Vektorgrafik (laufen auch auf schwachen Geräten).
 * Gemeinsame Eingänge: Mundöffnung 0…1, Augen zu (Blinzeln), Charakter (Augenbrauen, Lächeln).
 */
export interface FigureProps { mouth: number; blink: boolean; mood: Mood; className?: string }

/** Augenbrauen je Charakter: charmant gehoben, frech schief, böse zusammengezogen */
const brow = (mood: Mood, side: -1 | 1) => (mood === "charmant" ? -6 : mood === "frech" ? (side < 0 ? -8 : 2) : side * 7);

/** 1 · Papierschnitt: geschichtetes Papier mit leichtem Versatz, passend zum Standard-Look */
export function PaperHost({ mouth, blink, mood, className }: FigureProps) {
  const smile = mood === "boese" ? -4 : mood === "frech" ? 4 : 8;
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label="Papierschnitt-Moderatorin">
      <defs><filter id="pp" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="2" dy="3" stdDeviation="1.5" floodOpacity="0.22" /></filter></defs>
      <g filter="url(#pp)">
        <path d="M30 240 Q40 170 100 165 Q160 170 170 240 Z" fill="#e2725b" />
        <path d="M78 168 L100 196 L122 168 Z" fill="#f6efe2" />
        <rect x="88" y="140" width="24" height="30" rx="8" fill="#e8b48f" />
        <path d="M45 95 Q42 30 100 26 Q160 30 156 98 Q160 140 132 150 L68 150 Q40 140 45 95 Z" fill="#3b2a1f" />
        <ellipse cx="100" cy="100" rx="46" ry="54" fill="#f1c39b" />
        <path d="M54 82 Q70 40 112 44 Q148 50 148 84 Q126 62 96 66 Q72 68 54 82 Z" fill="#3b2a1f" />
      </g>
      <g stroke="#3b2a1f" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d={`M70 ${82 + brow(mood, -1) / 2} L88 ${80 + brow(mood, -1)}`} />
        <path d={`M112 ${80 + brow(mood, 1)} L130 ${82 + brow(mood, 1) / 2}`} />
      </g>
      {blink
        ? <g stroke="#3b2a1f" strokeWidth="3" strokeLinecap="round"><path d="M72 98 h14" /><path d="M114 98 h14" /></g>
        : <g fill="#2c2420"><ellipse cx="79" cy="98" rx="6" ry="7" /><ellipse cx="121" cy="98" rx="6" ry="7" /></g>}
      <circle cx="68" cy="118" r="7" fill="#e88f7a" opacity="0.45" /><circle cx="132" cy="118" r="7" fill="#e88f7a" opacity="0.45" />
      <path d={`M84 128 Q100 ${128 + smile} 116 128 Q100 ${130 + smile + mouth * 18} 84 128 Z`} fill="#8e3b3b" stroke="#6b2a2a" strokeWidth="2" />
    </svg>
  );
}

/** 2 · Holzfigur: gedrechselter Kopf mit Klappkiefer wie ein Nussknacker */
export function WoodHost({ mouth, blink, mood, className }: FigureProps) {
  const jaw = mouth * 14;
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label="Holzfigur">
      <defs>
        <linearGradient id="wd" x1="0" x2="1"><stop offset="0" stopColor="#b9834f" /><stop offset="0.5" stopColor="#d9a46c" /><stop offset="1" stopColor="#a8723f" /></linearGradient>
        <linearGradient id="wc" x1="0" x2="1"><stop offset="0" stopColor="#3f6b5c" /><stop offset="1" stopColor="#2c5145" /></linearGradient>
      </defs>
      <rect x="40" y="168" width="120" height="72" rx="22" fill="url(#wc)" />
      <rect x="86" y="150" width="28" height="24" rx="6" fill="url(#wd)" />
      <rect x="52" y="20" width="96" height="22" rx="8" fill="#2c2420" />
      <rect x="62" y="0" width="76" height="30" rx="10" fill="#2c2420" />
      <rect x="54" y="40" width="92" height="76" rx="30" fill="url(#wd)" />
      <g stroke="#6b4423" strokeOpacity="0.25" strokeWidth="1.5" fill="none"><path d="M62 60 Q100 52 138 62" /><path d="M60 84 Q100 76 140 86" /></g>
      <g stroke="#2c2420" strokeWidth="5" strokeLinecap="round"><path d={`M70 ${70 + brow(mood, -1) / 2} L90 ${68 + brow(mood, -1)}`} /><path d={`M110 ${68 + brow(mood, 1)} L130 ${70 + brow(mood, 1) / 2}`} /></g>
      {blink ? <g stroke="#2c2420" strokeWidth="4" strokeLinecap="round"><path d="M74 84 h12" /><path d="M114 84 h12" /></g>
        : <g fill="#fff"><circle cx="80" cy="84" r="8" /><circle cx="120" cy="84" r="8" /><circle cx="81" cy="85" r="4" fill="#2c2420" /><circle cx="121" cy="85" r="4" fill="#2c2420" /></g>}
      <circle cx="100" cy="100" r="6" fill="#c0703f" />
      <path d="M70 112 Q100 120 130 112" stroke="#f6efe2" strokeWidth="6" fill="none" strokeLinecap="round" />
      <g transform={`translate(0 ${jaw})`}>
        <rect x="62" y="116" width="76" height="32" rx="12" fill="url(#wd)" />
        <path d="M70 118 Q100 124 130 118" stroke="#f6efe2" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      {jaw > 1 && <rect x="68" y="114" width="64" height={jaw + 4} fill="#3a1e14" />}
    </svg>
  );
}

/** 3 · Showmaster: kräftige Formen, Fliege und Mikrofon */
export function ShowHost({ mouth, blink, mood, className }: FigureProps) {
  const grin = mood === "boese" ? 0 : mood === "frech" ? 6 : 10;
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label="Showmaster">
      <path d="M24 240 Q34 168 100 162 Q166 168 176 240 Z" fill="#1f3c88" />
      <path d="M86 172 L100 182 L86 192 Z M114 172 L100 182 L114 192 Z" fill="#e8c13a" />
      <circle cx="100" cy="182" r="5" fill="#d0453b" />
      <rect x="88" y="136" width="24" height="30" rx="8" fill="#c98f6a" />
      <circle cx="100" cy="94" r="56" fill="#d9a07a" />
      <path d="M44 84 Q48 30 100 30 Q156 30 158 84 Q146 54 118 56 Q120 44 100 46 Q80 48 70 60 Q52 66 44 84 Z" fill="#c45a2c" />
      <g stroke="#5a2c14" strokeWidth="6" strokeLinecap="round"><path d={`M66 ${76 + brow(mood, -1) / 2} L88 ${72 + brow(mood, -1)}`} /><path d={`M112 ${72 + brow(mood, 1)} L134 ${76 + brow(mood, 1) / 2}`} /></g>
      {blink ? <g stroke="#2c2420" strokeWidth="4" strokeLinecap="round"><path d="M70 92 h16" /><path d="M114 92 h16" /></g>
        : <g><ellipse cx="78" cy="92" rx="9" ry="10" fill="#fff" /><ellipse cx="122" cy="92" rx="9" ry="10" fill="#fff" /><circle cx="80" cy="94" r="5" fill="#1f2a44" /><circle cx="124" cy="94" r="5" fill="#1f2a44" /></g>}
      <path d={`M72 120 Q100 ${120 + grin} 128 120 Q100 ${124 + grin + mouth * 22} 72 120 Z`} fill="#7a2626" />
      <path d="M78 121 Q100 125 122 121" stroke="#fff" strokeWidth="3" fill="none" />
      <g transform="rotate(-18 150 190)"><rect x="146" y="170" width="10" height="56" rx="4" fill="#2c2c2c" /><circle cx="151" cy="166" r="12" fill="#555" /></g>
    </svg>
  );
}

/** 4 · Leuchtkugel: abstrakt, pulsiert mit der Stimme – die leichteste Figur für schwache Geräte */
export function OrbHost({ mouth, blink, mood, className }: FigureProps) {
  const hue = mood === "charmant" ? "#ff9f7a" : mood === "frech" ? "#8fd36a" : "#b07cff";
  const r = 58 + mouth * 14;
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label="Leuchtkugel">
      <defs><radialGradient id="og"><stop offset="0" stopColor="#fff" /><stop offset="0.45" stopColor={hue} /><stop offset="1" stopColor={hue} stopOpacity="0" /></radialGradient></defs>
      <circle cx="100" cy="110" r={r + 30} fill="url(#og)" opacity="0.35" />
      <circle cx="100" cy="110" r={r} fill="url(#og)" />
      {!blink && <g fill="#1f2a44" opacity="0.75"><ellipse cx="84" cy="104" rx="5" ry="7" /><ellipse cx="116" cy="104" rx="5" ry="7" /></g>}
      <path d={`M86 ${124} Q100 ${126 + mouth * 14} 114 124`} stroke="#1f2a44" strokeOpacity="0.7" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const FIGURES = [
  { id: "papier", name: "Paula", look: "Papierschnitt", pitch: 1.15, Figure: PaperHost },
  { id: "holz", name: "Holger", look: "Holzfigur", pitch: 0.8, Figure: WoodHost },
  { id: "show", name: "Mo", look: "Showmaster", pitch: 1, Figure: ShowHost },
  { id: "kugel", name: "Lumi", look: "Leuchtkugel – am leichtesten", pitch: 1.3, Figure: OrbHost },
] as const;
