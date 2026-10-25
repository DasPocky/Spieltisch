/** Symbol: Zettel mit drei Zeilen und ein großer Buchstabe */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="5" y="6" width="26" height="30" rx="2.5" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.6" />
      <path d="M9 14h8M9 21h12M9 28h9" stroke="#2b2118" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 14h7M23 21h4" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="22" y="2.5" width="15" height="15" rx="2.5" fill="#c2492e" transform="rotate(8 29.5 10)" />
      <text x="29.5" y="15" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fffdf8" fontFamily="system-ui, sans-serif" transform="rotate(8 29.5 10)">S</text>
    </svg>
  );
}
