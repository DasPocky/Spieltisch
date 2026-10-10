/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="8" width="17" height="25" rx="3" fill="#fdfdfb" transform="rotate(-12 14.5 20.5)" />
      <path d="M13 23 C 9.5 20.2, 8 18.5, 8 16.6 A 2.4 2.4 0 0 1 13 15.5 A 2.4 2.4 0 0 1 18 16.6 C 18 18.5, 16.5 20.2, 13 23 Z" fill="#a8454f" transform="rotate(-12 14.5 20.5)" />
      <rect x="17" y="7" width="17" height="25" rx="3" fill="#fdfdfb" transform="rotate(10 25.5 19.5)" />
      <path d="M25.5 14 C 24 16, 21 17.8, 21 20 A 2.2 2.2 0 0 0 24.8 21.4 L 24 24 H 27 L 26.2 21.4 A 2.2 2.2 0 0 0 30 20 C 30 17.8, 27 16, 25.5 14 Z" fill="#1a2233" transform="rotate(10 25.5 19.5)" />
    </svg>
  );
}
