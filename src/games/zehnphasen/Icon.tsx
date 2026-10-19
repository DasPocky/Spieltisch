import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="7" y="9" width="15" height="21" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" transform="rotate(-14 14 20)" />
      <rect x="18" y="9" width="15" height="21" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" transform="rotate(12 26 20)" />
      <rect x="12.5" y="8" width="15" height="22" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" />
      <text x="20" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fill={MUTED.blue}>10</text>
    </svg>
  );
}
