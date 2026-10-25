/** Symbol: Kopf mit Fragezeichen-Kärtchen und Sprechblase */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="16" cy="25" r="10" fill="#f2c9a0" />
      <path d="M6.3 22.5c.6-5.8 4.6-9 9.7-9s9.1 3.2 9.7 9c-2.9-2.1-6.2-3-9.7-3s-6.8.9-9.7 3z" fill="#5a3b26" />
      <circle cx="12.6" cy="26" r="1.3" fill="#2a1d14" />
      <circle cx="19.4" cy="26" r="1.3" fill="#2a1d14" />
      <path d="M13.2 30c1.8 1.2 3.8 1.2 5.6 0" stroke="#2a1d14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <rect x="8" y="4" width="16" height="9" rx="2" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.4" transform="rotate(-6 16 8.5)" />
      <text x="16" y="11.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#c2492e" fontFamily="system-ui, sans-serif" transform="rotate(-6 16 8.5)">?</text>
      <path d="M27 6h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-5l-3 3v-3h-1a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#0ea5e9" />
      <text x="31.5" y="13.6" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">Ja</text>
    </svg>
  );
}
