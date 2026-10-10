/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M8 5 H24 L27 31 Q27 34 24 34 H8 Q5 34 5 31 Z" fill="#2c5aa6" transform="rotate(-10 16 20)" />
      <rect x="7" y="3.5" width="18" height="4" rx="2" fill="#86aee8" transform="rotate(-10 16 20)" />
      <rect x="20" y="15" width="13" height="13" rx="3" fill="#fdfdfb" transform="rotate(12 26.5 21.5)" />
      <circle cx="26.5" cy="21.5" r="1.7" fill="#a84a57" />
      <rect x="23" y="26" width="13" height="13" rx="3" fill="#bcd3f5" transform="rotate(-6 29.5 32.5)" />
      <g fill="#1f437f" transform="rotate(-6 29.5 32.5)"><circle cx="26.5" cy="29.5" r="1.5" /><circle cx="32.5" cy="35.5" r="1.5" /></g>
    </svg>
  );
}
