import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="8" width="15" height="22" rx="2.5" fill="#fdfdfb" transform="rotate(-12 13 19)" />
      <path d="M13.5 13 C 11 16, 9 17.5, 9 19.6 C 9 21.4, 11 22.2, 12.8 21 L 12 24.5 H 15 L 14.2 21 C 16 22.2, 18 21.4, 18 19.6 C 18 17.5, 16 16, 13.5 13 Z" fill={MUTED.ink} transform="rotate(-12 13 19)" />
      <path d="M27 33 C 15 25, 14 15, 21 13.5 C 24.5 12.8, 26.5 15, 27 17 C 27.5 15, 29.5 12.8, 33 13.5 C 40 15, 39 25, 27 33 Z" fill={MUTED.red} />
      <circle cx="22.5" cy="17.5" r="2" fill="#fdfdfb" opacity="0.35" />
    </svg>
  );
}
