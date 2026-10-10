/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="17" y="8" width="16" height="23" rx="3" fill="#fdfdfb" transform="rotate(10 25 19.5)" />
      <g fill="#1f437f" transform="rotate(10 25 19.5)">
        <ellipse cx="25" cy="22.5" rx="3.2" ry="2.6" />
        <circle cx="21.8" cy="18.6" r="1.3" /><circle cx="24" cy="16.8" r="1.3" /><circle cx="26.4" cy="16.8" r="1.3" /><circle cx="28.4" cy="18.6" r="1.3" />
      </g>
      <circle cx="14" cy="18" r="10" fill="#cfe0fa" />
      <circle cx="18.5" cy="14.5" r="8.5" fill="#1f437f" />
    </svg>
  );
}
