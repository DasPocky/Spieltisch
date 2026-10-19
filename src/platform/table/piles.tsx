import { cn } from "@/lib/utils";
import type { TableModel } from "./model";

/**
 * Bausteine für Zahlenkarten-Spiele am Tisch (über 3D- und flachem Tisch gleich):
 *  - Stapel in der Mitte (Aufbaustapel, Ablage, Nachziehstapel) – die oberste Karte groß, darunter die Beschriftung,
 *  - Auslage am Platz – kleines Raster offener Karten, verdeckte als „?“.
 * Maße in cqh/cqw (Stapel, wachsen mit der Tischfläche) bzw. rem (Auslage unter dem Platzschild).
 */

/** Eine Zahlenkarte: Farbe als Rand und Zahl, weißes Feld */
function NumCard({ text, tone, className }: { text: string; tone?: string; className?: string }) {
  return (
    <span className={cn("grid place-items-center rounded-[14%] border-[0.35em] bg-[#fbf7ef] font-bold text-[#1a1a1a] shadow-[0_4px_10px_rgb(0_0_0/0.35)]", className)}
      style={{ borderColor: tone ?? "#8a6f4e", color: tone ?? "#1a1a1a" }}>{text}</span>
  );
}

/** Stapel in der Mitte – leere als gestrichelter Platz, verdeckte (nur Anzahl) als Rückseite */
export function FeltPiles({ piles }: { piles: NonNullable<TableModel["piles"]> }) {
  return (
    <div className="flex items-end justify-center gap-[2.4cqw]" data-testid="table-piles">
      {piles.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-[1.4cqh]" data-testid="table-pile">
          {p.top !== null ? <NumCard text={p.top} tone={p.tone} className="h-[30cqh] w-[21cqh] text-[13cqh]" />
            : p.count !== undefined ? (
              <span className="grid h-[30cqh] w-[21cqh] place-items-center rounded-[14%] border-[0.6cqh] border-white bg-gradient-to-br from-[#2f6fb3] to-[#173a6b] text-[6cqh] font-bold text-white shadow-[0_4px_10px_rgb(0_0_0/0.35)]">{p.count}</span>
            ) : <span className="h-[30cqh] w-[21cqh] rounded-[14%] border-[0.5cqh] border-dashed border-white/35" />}
          <span className="text-[3.6cqh] font-semibold text-white/85 drop-shadow">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Auslage eines Spielers unter seinem Platz: offene Karten im Raster, verdeckte als „?“, leere Lücken bleiben frei */
export function SeatBoard({ board }: { board: NonNullable<TableModel["boards"]>[string] }) {
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${board.cols}, 1.7rem)` }} data-testid="seat-board">
      {board.cells.map((c, i) => c === null ? <span key={i} className="h-[2.3rem]" />
        : c === "?" ? <span key={i} className="grid h-[2.3rem] place-items-center rounded-[5px] border-2 border-white bg-[#24508f] text-xs font-bold text-white/70">?</span>
        : <NumCard key={i} text={c.text} tone={c.tone} className="h-[2.3rem] text-sm" />)}
    </div>
  );
}
