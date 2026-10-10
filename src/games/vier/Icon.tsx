import { DISC } from "./colors";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  const cells = [
    [0, 2, 1], [1, 2, 0], [2, 2, 0], [3, 2, 1],
    [1, 1, 1], [2, 1, 0], [3, 1, -1], [0, 1, -1],
    [2, 0, 1], [0, 0, -1], [1, 0, -1], [3, 0, -1],
  ];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="4" y="8" width="32" height="25" rx="4" fill="#2559c4" />
      {cells.map(([c, r, v]) => (
        <circle key={`${c}${r}`} cx={9.5 + c * 7} cy={28 - r * 7.2} r="2.7" fill={v === 0 ? DISC[0] : v === 1 ? DISC[1] : "#0b1f4a"} />
      ))}
    </svg>
  );
}
