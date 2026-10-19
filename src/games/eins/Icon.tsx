import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="7" y="8" width="16" height="23" rx="3" fill={MUTED.blue} stroke="#fdfdfb" strokeWidth="1.2" transform="rotate(-12 15 20)" />
      <rect x="17" y="8" width="16" height="23" rx="3" fill={MUTED.red} stroke="#fdfdfb" strokeWidth="1.2" transform="rotate(10 25 20)" />
      <text x="25" y="24" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fdfdfb" transform="rotate(10 25 20)">+2</text>
    </svg>
  );
}
