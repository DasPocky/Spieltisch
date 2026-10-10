import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="18" r="11" fill={MUTED.blue} />
      <circle cx="16" cy="14" r="3" fill="#fdfdfb" opacity="0.35" />
      <path transform="translate(22 19) scale(4.5)" fill={MUTED.ochre} d="M0-1L.29-.4L.95-.31L.48.15L.59.81L0 .5L-.59.81L-.48.15L-.95-.31L-.29-.4Z" />
      <path d="M11 33H29L26 28H14Z" fill={MUTED.ink} stroke="#fdfdfb" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}
