import { PALETTE, Pawn } from "./Pawn";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="3" width="34" height="34" rx="6" fill="#f3e2b4" />
      <path d="M16 6h8v10h10v8H24v10h-8V24H6v-8h10z" fill="#fffdf6" stroke="#8a7346" strokeWidth="1.2" strokeLinejoin="round" />
      {[[8, 8, 0], [32, 8, 1], [32, 32, 2], [8, 32, 3]].map(([x, y, c]) => <circle key={c} cx={x} cy={y} r="3" fill={PALETTE[c].fill} />)}
      <svg x="11" y="12" width="16" height="16" viewBox="-0.5 -0.5 1 1"><Pawn color={0} /></svg>
      <svg x="17" y="15" width="16" height="16" viewBox="-0.5 -0.5 1 1"><Pawn color={1} /></svg>
    </svg>
  );
}
