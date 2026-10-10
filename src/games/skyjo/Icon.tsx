import { cardColor } from "./colors";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  const cards: [number, number][] = [[-2, -14], [5, 0], [12, 14]];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {cards.map(([v, r], i) => (
        <g key={i} transform={`rotate(${r} 20 30)`}>
          <rect x="13" y="7" width="14" height="20" rx="3" fill={cardColor(v).bg} stroke="#fdfdfb" strokeWidth="1.2" />
          <text x="20" y="21" textAnchor="middle" fontSize="8" fontWeight="800" fill={cardColor(v).fg}>{v}</text>
        </g>
      ))}
    </svg>
  );
}
