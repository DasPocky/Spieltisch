/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="9" y="4" width="22" height="32" rx="4" fill="#fdfdfb" transform="rotate(-8 20 20)" />
      <rect x="12.5" y="13" width="15" height="15" rx="3.5" fill="#1f437f" transform="rotate(-8 20 20)" />
      <g fill="#fdfdfb" transform="rotate(-8 20 20)">
        {[[16, 16.5], [24, 16.5], [20, 20.5], [16, 24.5], [24, 24.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" />)}
      </g>
    </svg>
  );
}
