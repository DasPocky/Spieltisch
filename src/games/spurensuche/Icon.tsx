/** Symbol für Spielauswahl und Kopfzeile – Lupe über einem Grundriss */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="5" width="26" height="26" rx="3" fill="#efe2c9" stroke="#8b7356" strokeWidth="1.4" />
      <path d="M3 15 H29 M3 23 H29 M12 5 V31 M20 5 V31" stroke="#a77b4a" strokeWidth="1.2" />
      <circle cx="16" cy="19" r="2.2" fill="#8c2f45" />
      <circle cx="25" cy="25" r="8" fill="#ffffff" fillOpacity="0.55" stroke="#27477d" strokeWidth="2.6" />
      <path d="M30.5 30.5 L37 37" stroke="#27477d" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}
