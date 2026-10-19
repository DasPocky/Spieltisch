export { PALETTE } from "./colors";
import { PALETTE } from "./colors";

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
