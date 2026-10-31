import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – drei Zahlensteine einer Reihe, leicht versetzt */
export function Icon({ className }: { className?: string }) {
  const tile = (x: number, y: number, n: string, color: string, rot: number) => (
    <g transform={`rotate(${rot} ${x + 6} ${y + 8})`}>
      <rect x={x} y={y} width="12" height="16" rx="2.4" fill={MUTED.paper} stroke={MUTED.ink} strokeOpacity="0.18" strokeWidth="0.7" />
      <text x={x + 6} y={y + 10.5} textAnchor="middle" fontSize="8" fontWeight="800" fill={color} fontFamily="system-ui, sans-serif">{n}</text>
      <circle cx={x + 6} cy={y + 13.3} r="1.1" fill={color} />
    </g>
  );
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="2" y="25" width="36" height="9" rx="2.5" fill={MUTED.navy} />
      {tile(3, 11, "4", MUTED.red, -6)}
      {tile(14, 9, "5", MUTED.red, 0)}
      {tile(25, 11, "6", MUTED.red, 6)}
    </svg>
  );
}
