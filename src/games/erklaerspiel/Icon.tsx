/** Symbol für Spielauswahl und Kopfzeile: zwei Sprechblasen und eine Sanduhr */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M4 8.5A4.5 4.5 0 0 1 8.5 4h15A4.5 4.5 0 0 1 28 8.5v7a4.5 4.5 0 0 1-4.5 4.5H12l-5.5 4.5V20A4.5 4.5 0 0 1 4 15.5z" fill="#e8553d" />
      <rect x="9" y="9.5" width="14" height="2.4" rx="1.2" fill="#fff6e8" />
      <rect x="9" y="13.6" width="9" height="2.4" rx="1.2" fill="#fff6e8" />
      <path d="M36 21.5a4.5 4.5 0 0 0-4.5-4.5h-11a4.5 4.5 0 0 0-4.5 4.5v6a4.5 4.5 0 0 0 4.5 4.5h7l5 4v-4.3A4.5 4.5 0 0 0 36 27.5z" fill="#2f6fb5" />
      <text x="26" y="28.6" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff6e8" fontFamily="system-ui, sans-serif">!</text>
      <path d="M8 28h7M8 38h7M9 28c0 3 4 3 4 5s-4 2-4 5M14 28c0 3-4 3-4 5s4 2 4 5" stroke="#5a3b26" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
