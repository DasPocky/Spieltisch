/** Symbol: zwei Zettel mit Pfeil – oben ein Satz, unten ein Kritzel */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="4" y="4" width="21" height="15" rx="2.5" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.6" />
      <path d="M8 9.5h13M8 13.5h9" stroke="#2b2118" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="15" y="21" width="21" height="15" rx="2.5" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.6" />
      <path d="M19 32c2-5 4-6 5.5-3s3 1 5-4" stroke="#e11d48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 22v6a3 3 0 0 0 3 3h2" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M11.5 28.5l2.5 2.5-2.5 2.5" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
