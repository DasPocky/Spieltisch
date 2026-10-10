import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  const cards: [string, string, number][] = [["1", MUTED.blue, -12], ["5", MUTED.teal, 0], ["9", MUTED.red, 12]];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {cards.map(([v, c, r], i) => (
        <g key={i} transform={`rotate(${r} 20 32)`}>
          <rect x="13" y="7" width="14" height="20" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" />
          <text x="20" y="21.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={c}>{v}</text>
        </g>
      ))}
    </svg>
  );
}
