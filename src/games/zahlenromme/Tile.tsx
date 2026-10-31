import { colorOf, isJoker, numOf, type Tile as TileId, type TileColor } from "@shared/games/zahlenromme/logic";
import { cn } from "@/lib/utils";

/** Farbe der Zahl je Steinfarbe – kräftig genug auf Elfenbein, dazu ein eigenes Zeichen (farbblind-tauglich) */
export const TILE_INK: Record<TileColor, string> = { r: "#c23b2e", b: "#1f5fbf", g: "#b06f00", s: "#22252c" };
export const TILE_MARK: Record<TileColor, string> = { r: "●", b: "■", g: "▲", s: "◆" };
export const TILE_MARK_NAME: Record<TileColor, string> = { r: "Kreis", b: "Quadrat", g: "Dreieck", s: "Raute" };

/** Zeichen der Farbe als SVG (gleich groß, unabhängig von der Schrift) */
export function Mark({ c, className }: { c: TileColor; className?: string }) {
  const fill = TILE_INK[c];
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden="true">
      {c === "r" ? <circle cx="5" cy="5" r="4" fill={fill} />
        : c === "b" ? <rect x="1.4" y="1.4" width="7.2" height="7.2" rx="0.8" fill={fill} />
        : c === "g" ? <path d="M5 0.8 L9.4 9 H0.6 Z" fill={fill} />
        : <path d="M5 0.4 L9.6 5 L5 9.6 L0.4 5 Z" fill={fill} />}
    </svg>
  );
}

/** Joker: ein lachendes Gesicht in den vier Farben */
function JokerFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M10 1 A9 9 0 0 1 19 10 H10 Z" fill={TILE_INK.r} />
      <path d="M19 10 A9 9 0 0 1 10 19 V10 Z" fill={TILE_INK.b} />
      <path d="M10 19 A9 9 0 0 1 1 10 H10 Z" fill={TILE_INK.g} />
      <path d="M1 10 A9 9 0 0 1 10 1 V10 Z" fill={TILE_INK.s} />
      <circle cx="10" cy="10" r="6.4" fill="#fbf6ea" />
      <circle cx="7.6" cy="8.6" r="1.1" fill="#22252c" />
      <circle cx="12.4" cy="8.6" r="1.1" fill="#22252c" />
      <path d="M6.6 11.4 Q10 15.2 13.4 11.4" stroke="#22252c" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Vorlesetext eines Steins */
export function tileLabel(t: TileId): string {
  if (isJoker(t)) return "Joker";
  const c = colorOf(t)!;
  return `${({ r: "Rot", b: "Blau", g: "Gelb", s: "Schwarz" } as const)[c]} ${numOf(t)} (${TILE_MARK_NAME[c]})`;
}

/**
 * Ein Zahlenstein: Elfenbein mit leichter Kante, die Zahl in Farbe, darunter das Zeichen der Farbe.
 * Größe über `style`/Klassen von außen (Breite), Höhe folgt dem Seitenverhältnis 3:4.
 */
export function TileFace({ tile, className, style, dim }: { tile: TileId; className?: string; style?: React.CSSProperties; dim?: boolean }) {
  const joker = isJoker(tile);
  const c = colorOf(tile);
  return (
    <span className={cn("zr-tile relative flex aspect-[3/4] flex-col items-center justify-center rounded-[18%] select-none [container-type:inline-size]", dim && "opacity-45", className)} style={style}>
      {joker ? <JokerFace className="w-[74cqw]" /> : (
        <>
          <span className="text-[58cqw] leading-[0.95] font-black tabular-nums tracking-tight" style={{ color: TILE_INK[c!] }}>{numOf(tile)}</span>
          <Mark c={c!} className="mt-[4cqw] w-[26cqw]" />
        </>
      )}
    </span>
  );
}
