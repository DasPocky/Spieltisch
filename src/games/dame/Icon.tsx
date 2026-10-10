import { Piece } from "./Piece";
/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="3" width="34" height="34" rx="4" fill="#efdcb8" />
      <path d="M3 3h11.3v11.3H3zM25.7 3H37v11.3H25.7zM14.3 14.3h11.4v11.4H14.3zM3 25.7h11.3V37H3zM25.7 25.7H37V37H25.7z" fill="#9a6a44" />
      <svg x="1" y="23" width="15" height="15" viewBox="0 0 100 100"><Piece side={0} king={false} cx={50} cy={48} r={44} /></svg>
      <svg x="23" y="1" width="15" height="15" viewBox="0 0 100 100"><Piece side={1} king cx={50} cy={48} r={44} /></svg>
    </svg>
  );
}
