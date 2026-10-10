/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M28 5c-3.9 0-7 3-7 6.9 0 4.8 7 11.1 7 11.1s7-6.3 7-11.1C35 8 31.9 5 28 5z" fill="#cfe0fa" />
      <circle cx="28" cy="11.8" r="2.6" fill="#1f437f" />
      <path d="M8 22.5c0-5 2.6-8.5 6.5-8.5 1.5 0 2.3.8 3.5.8s2-.8 3.5-.8c3.9 0 6.5 3.5 6.5 8.5z" fill="#1b1e25" />
      <rect x="4" y="22" width="28" height="3.2" rx="1.6" fill="#1b1e25" />
      <rect x="9" y="17.5" width="18" height="2.3" fill="#a8454f" />
      <path d="M9 28h7.5a1 1 0 0 1 1 1v.8a3.6 3.6 0 0 1-3.6 3.6h-.3A4.6 4.6 0 0 1 9 28.8z M27 28h-7.5a1 1 0 0 0-1 1v.8a3.6 3.6 0 0 0 3.6 3.6h.3a4.6 4.6 0 0 0 4.6-4.6z" fill="#fdfdfb" />
      <rect x="16" y="28.6" width="4" height="1.4" rx=".7" fill="#fdfdfb" />
    </svg>
  );
}
