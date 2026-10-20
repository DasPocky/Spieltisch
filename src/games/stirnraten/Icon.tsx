/** Symbol für Spielauswahl und Kopfzeile: Kopf mit Handy an der Stirn */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="24" r="11" fill="#f2c9a0" />
      <path d="M9.5 21c.6-6.4 5-10 10.5-10s9.9 3.6 10.5 10c-3.2-2.4-6.8-3.3-10.5-3.3S12.7 18.6 9.5 21z" fill="#5a3b26" />
      <circle cx="16" cy="25" r="1.4" fill="#2a1d14" />
      <circle cx="24" cy="25" r="1.4" fill="#2a1d14" />
      <path d="M16.5 29.5c2.2 1.6 4.8 1.6 7 0" stroke="#2a1d14" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <rect x="11" y="3" width="18" height="12" rx="2.4" fill="#1b1e25" />
      <rect x="12.6" y="4.6" width="14.8" height="8.8" rx="1.2" fill="#cfe0fa" />
      <text x="20" y="11.4" textAnchor="middle" fontSize="6.2" fontWeight="900" fill="#1f437f" fontFamily="system-ui, sans-serif">?</text>
    </svg>
  );
}
