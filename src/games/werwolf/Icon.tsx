/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="14" fill="#fdfdfb" />
      <circle cx="26" cy="15" r="12" fill="#1f437f" />
      <path d="M9 33 L12 22 L15 25 L18 19 L21 25 L23 21 L25 33 Z" fill="#0a1730" />
      <circle cx="16.5" cy="26" r="1" fill="#cfe0fa" />
    </svg>
  );
}
