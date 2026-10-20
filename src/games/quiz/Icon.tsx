/** Symbol: Sprechblase mit Fragezeichen und vier Antwortpunkten */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M6 7h28a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H17l-7 6v-6H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.6" strokeLinejoin="round" />
      <text x="20" y="22.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#2563eb" fontFamily="system-ui, sans-serif">?</text>
      <circle cx="9" cy="35" r="2.4" fill="#e11d48" /><circle cx="16" cy="35" r="2.4" fill="#2563eb" /><circle cx="23" cy="35" r="2.4" fill="#d97706" /><circle cx="30" cy="35" r="2.4" fill="#16a34a" />
    </svg>
  );
}
