/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="9" width="15" height="22" rx="3" fill="#bcd3f5" transform="rotate(-16 13.5 20)" />
      <rect x="19" y="9" width="15" height="22" rx="3" fill="#86aee8" transform="rotate(16 26.5 20)" />
      <rect x="12.5" y="7" width="15" height="23" rx="3" fill="#fdfdfb" />
      <text x="20" y="24.5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1f437f">7</text>
    </svg>
  );
}
