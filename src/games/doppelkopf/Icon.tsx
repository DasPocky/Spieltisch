import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – zwei gleiche Damen, klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="5" y="9" width="16" height="24" rx="2.5" fill="#fdfdfb" transform="rotate(-10 13 21)" />
      <rect x="19" y="7" width="16" height="24" rx="2.5" fill="#fdfdfb" transform="rotate(8 27 19)" />
      <g transform="rotate(-10 13 21)" fill={MUTED.ink}>
        <circle cx="13" cy="17.5" r="2.2" /><circle cx="10.4" cy="21" r="2.2" /><circle cx="15.6" cy="21" r="2.2" /><path d="M12.4 20 h1.2 l0.8 5 h-2.8 z" />
      </g>
      <g transform="rotate(8 27 19)" fill={MUTED.red}>
        <path d="M27 13 l1.6 3.4 3.4 -1.6 -1.2 6.2 h-7.6 l-1.2 -6.2 3.4 1.6 z" />
        <rect x="23.2" y="22.4" width="7.6" height="1.8" rx="0.6" />
      </g>
    </svg>
  );
}
