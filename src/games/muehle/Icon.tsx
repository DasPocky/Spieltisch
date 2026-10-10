/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="3" width="34" height="34" rx="5" fill="#dcb47e" />
      <g stroke="#5b3a1e" strokeWidth="1.6" fill="none">
        <rect x="8" y="8" width="24" height="24" />
        <rect x="13.5" y="13.5" width="13" height="13" />
        <path d="M20 8v5.5M20 26.5V32M8 20h5.5M26.5 20H32" />
      </g>
      <circle cx="8" cy="8" r="3.6" fill="#f7f2e7" stroke="#a99b82" strokeWidth="0.8" />
      <circle cx="20" cy="8" r="3.6" fill="#f7f2e7" stroke="#a99b82" strokeWidth="0.8" />
      <circle cx="26.5" cy="26.5" r="3.6" fill="#2b2522" />
      <circle cx="13.5" cy="20" r="3.6" fill="#2b2522" />
    </svg>
  );
}
