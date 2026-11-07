import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – drei Karten im Fächer, vorn ein Bube mit Kreuz, klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="10" width="15" height="22" rx="2.5" fill="#fdfdfb" opacity="0.75" transform="rotate(-16 13 21)" />
      <rect x="19" y="10" width="15" height="22" rx="2.5" fill="#fdfdfb" opacity="0.75" transform="rotate(16 27 21)" />
      <rect x="12.5" y="7" width="15" height="23" rx="2.5" fill="#fdfdfb" />
      <g fill={MUTED.ink}>
        <circle cx="20" cy="13.4" r="2.1" /><circle cx="17.6" cy="16.8" r="2.1" /><circle cx="22.4" cy="16.8" r="2.1" /><path d="M19.4 15.8 h1.2 l0.8 4.4 h-2.8 z" />
      </g>
      <path d="M16.2 26.5 h7.6 M17.5 24 h5" stroke={MUTED.red} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
