/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="20" y="5" width="14" height="20" rx="2.5" fill="#fdfdfb" transform="rotate(12 27 15)" />
      <path d="M26 11 C 23.5 9, 22.5 11.5, 26 14.5 C 29.5 11.5, 28.5 9, 26 11 Z" fill="#a8454f" transform="rotate(12 27 15)" />
      <path d="M5 25 C 10 17, 20 17, 25 25 C 20 33, 10 33, 5 25 Z" fill="#86aee8" />
      <path d="M25 25 L 33 19 L 33 31 Z" fill="#86aee8" />
      <circle cx="11" cy="23.5" r="1.6" fill="#0a1730" />
    </svg>
  );
}
