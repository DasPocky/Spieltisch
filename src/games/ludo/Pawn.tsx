/** Spielfarben: Füllung, dunkle Kante, helles Feld */
export const PALETTE = [
  { fill: "#d7322d", dark: "#8f1d1a", light: "#f6c9c4" },
  { fill: "#2c63c9", dark: "#173b80", light: "#c8d8f5" },
  { fill: "#2d9645", dark: "#17602a", light: "#c6e8cd" },
  { fill: "#f0bf1f", dark: "#a07a06", light: "#f9e9b0" },
  { fill: "#8a4cc2", dark: "#55287e", light: "#e1cdf2" },
  { fill: "#ee7d21", dark: "#a14d0c", light: "#fad7b8" },
];

/** Kantenlänge der Figur in eigenen Einheiten (zentriert um 0,0) */
export const PAWN = 1;

/** Ein Pöppel von der Seite: Fuß, Körper, Kragen, Kopf – der Fuß steht auf der Feldmitte */
export function Pawn({ color, lift }: { color: number; lift?: boolean }) {
  const p = PALETTE[color] ?? PALETTE[0];
  return (
    <g style={{ transform: lift ? "translateY(-0.12px)" : undefined, transition: "transform 0.12s" }}>
      <ellipse cx="0" cy="0.38" rx="0.3" ry="0.08" fill="#000" fillOpacity="0.22" />
      <path d="M-0.28 0.3 Q-0.22 0.02 -0.1 -0.1 L0.1 -0.1 Q0.22 0.02 0.28 0.3 Q0 0.42 -0.28 0.3Z" fill={p.fill} stroke={p.dark} strokeWidth="0.04" strokeLinejoin="round" />
      <ellipse cx="0" cy="-0.1" rx="0.15" ry="0.05" fill={p.fill} stroke={p.dark} strokeWidth="0.035" />
      <circle cx="0" cy="-0.27" r="0.17" fill={p.fill} stroke={p.dark} strokeWidth="0.04" />
      <circle cx="-0.06" cy="-0.32" r="0.055" fill="#fff" fillOpacity="0.55" />
      <path d="M-0.17 0.22 Q-0.14 0.05 -0.07 -0.04" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.04" strokeLinecap="round" />
    </g>
  );
}
