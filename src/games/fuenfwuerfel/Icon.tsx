/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="18" y="5" width="17" height="17" rx="4" fill="#bcd3f5" transform="rotate(14 26.5 13.5)" />
      <g fill="#1f437f" transform="rotate(14 26.5 13.5)">
        {[[22, 9], [31, 9], [22, 13.5], [31, 13.5], [22, 18], [31, 18]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" />)}
      </g>
      <rect x="5" y="15" width="20" height="20" rx="5" fill="#fdfdfb" transform="rotate(-8 15 25)" />
      <g fill="#1f437f" transform="rotate(-8 15 25)">
        {[[10, 20], [20, 20], [15, 25], [10, 30], [20, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" />)}
      </g>
    </svg>
  );
}
