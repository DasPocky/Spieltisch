/** Symbol: Blatt mit Kritzel und Stift */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="5" y="7" width="26" height="24" rx="3" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.6" />
      <path d="M10 25c3-7 6-9 8-5s4 2 6-6" stroke="#e11d48" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="13" r="2.4" fill="#facc15" />
      <path d="M26 33l10-14 2.6 1.8-10 14-3.4 1.2z" fill="#0ea5e9" stroke="#2b2118" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
