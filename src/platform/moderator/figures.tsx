import type { Mood } from "./lines";

/** Moderator ohne 3D – Eingänge: Mundöffnung 0…1, Augen zu (Blinzeln), Charakter (Farbe). */
export interface FigureProps { mouth: number; blink: boolean; mood: Mood; className?: string }

/** Leuchtkugel: abstrakt, pulsiert mit der Stimme – Ersatz, wenn ein Gerät kein 3D kann (Grafik „Ohne 3D“, kein WebGL) */
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
