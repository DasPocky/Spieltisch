import { MUTED } from "@/lib/palette";
/** Symbol für Spielauswahl und Kopfzeile – ein Palast aus Karten mit drei Türmen, davor eine offene Karte */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M5 34 V16 L8.5 11 L12 16 V20 H15 V12 L20 5 L25 12 V20 H28 V16 L31.5 11 L35 16 V34 Z" fill={MUTED.navy} />
      <path d="M17.5 34 V27 A2.5 2.5 0 0 1 22.5 27 V34 Z" fill={MUTED.ice} opacity="0.85" />
      <circle cx="20" cy="15" r="1.6" fill={MUTED.ice} opacity="0.85" />
      <g transform="rotate(10 30 29)">
        <rect x="24" y="21" width="12" height="17" rx="2" fill={MUTED.paper} stroke={MUTED.ink} strokeOpacity="0.15" strokeWidth="0.6" />
        <text x="26" y="27.5" fontSize="6" fontWeight="700" fill={MUTED.red} fontFamily="system-ui, sans-serif">10</text>
        <path d="M30 37 C 27.5 35, 26.5 33.5, 26.5 32.3 A 1.8 1.8 0 0 1 30 31.4 A 1.8 1.8 0 0 1 33.5 32.3 C 33.5 33.5, 32.5 35, 30 37 Z" fill={MUTED.red} />
      </g>
    </svg>
  );
}
