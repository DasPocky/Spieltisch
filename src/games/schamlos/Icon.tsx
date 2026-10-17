/** Symbol für Spielauswahl und Kopfzeile: schwarze Karte mit Lücke, weiße Karte schräg davor */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="5" width="19" height="27" rx="3" fill="#1b1e25" transform="rotate(-8 15.5 18.5)" />
      <rect x="9" y="12" width="9" height="2" rx="1" fill="#fdfdfb" transform="rotate(-8 15.5 18.5)" />
      <rect x="9" y="17" width="12" height="2" rx="1" fill="#ff7a59" transform="rotate(-8 15.5 18.5)" />
      <rect x="17" y="10" width="17" height="25" rx="3" fill="#fdfdfb" transform="rotate(9 25.5 22.5)" />
      <rect x="20" y="16" width="10" height="2" rx="1" fill="#1b1e25" opacity=".75" transform="rotate(9 25.5 22.5)" />
      <rect x="20" y="21" width="7" height="2" rx="1" fill="#1b1e25" opacity=".5" transform="rotate(9 25.5 22.5)" />
    </svg>
  );
}
