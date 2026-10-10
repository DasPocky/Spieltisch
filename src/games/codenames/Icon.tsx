/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  const cells = ["#a8454f", "#4b72b0", "#cdc4ae", "#4b72b0", "#a8454f", "#cdc4ae", "#1b1e25", "#a8454f", "#4b72b0"];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="6" width="28" height="28" rx="5" fill="#fdfdfb" />
      {cells.map((c, i) => <rect key={i} x={9 + (i % 3) * 8} y={9 + Math.floor(i / 3) * 8} width="6.5" height="6.5" rx="1.5" fill={c} />)}
    </svg>
  );
}
