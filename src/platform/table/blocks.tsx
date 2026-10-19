import { Die } from "@/platform/Die";
import { cn } from "@/lib/utils";
import type { TableModel } from "./model";

/**
 * Bausteine, die auf dem Filz liegen (über 3D- und flachem Tisch gleich): Würfel und Spielfeld.
 * Maße in cqh/cqw – sie wachsen mit der Tischfläche (Container auf dem Filz, siehe OnFelt).
 */

/** Würfel in der Mitte: gehaltene liegen etwas vorn und sind markiert, neue Würfe rollen kurz herein */
export function FeltDice({ dice }: { dice: NonNullable<TableModel["dice"]> }) {
  return (
    <div className="flex flex-col items-center gap-[3cqh]" data-testid="table-dice">
      <div className="flex items-end gap-[2.2cqw]">
        {dice.cup
          ? (
            // Becher (Mäxchen): der Wurf bleibt verdeckt
            <svg viewBox="0 0 40 44" className="h-[30cqh] drop-shadow-[0_8px_12px_rgb(0_0_0/0.4)]" role="img" aria-label="Becher" data-testid="table-cup">
              <path d="M8 4h24l4 36H4z" fill="#5a2a1c" /><rect x="3" y="37" width="34" height="5" rx="1.5" fill="#c9a25e" />
            </svg>
          )
          : dice.values.length
          ? dice.values.map((v, i) => (
            <div key={`${dice.n}-${i}`} className={cn("flex flex-col items-center gap-[1.2cqh] transition-transform", dice.held[i] ? "translate-y-[4cqh]" : "dice-in")}
              style={dice.held[i] ? undefined : { animationDelay: `${i * 60}ms` }} data-held={!!dice.held[i]}>
              <Die value={v} mark={dice.held[i] ? "selected" : undefined} className="size-[min(17cqh,11cqw)] drop-shadow-[0_6px_10px_rgb(0_0_0/0.35)]" />
            </div>
          ))
          : Array.from({ length: 5 }, (_, i) => <div key={i} className="size-[min(17cqh,11cqw)] rounded-[22%] border-2 border-dashed border-white/25" />)}
      </div>
      {dice.note && <span className="table-banner !static !translate-x-0 text-[4.2cqh]">{dice.note}</span>}
    </div>
  );
}

/** Spielfeld: Raster mit Steinen zweier Farben (z. B. Vier in einer Reihe) – letzter Stein mit Ring, Gewinnreihe leuchtet */
export function FeltGrid({ grid }: { grid: NonNullable<TableModel["grid"]> }) {
  const rows = grid.cells.length, cols = grid.cells[0]?.length ?? 0;
  const W = cols * 10 + 2, H = rows * 10 + 2;
  const inLine = (c: number, r: number) => grid.line?.some(([x, y]) => x === c && y === r);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[86cqh] max-w-[90cqw] drop-shadow-[0_10px_18px_rgb(0_0_0/0.45)]" role="img" aria-label="Spielfeld" data-testid="table-grid">
      <rect x="0" y="0" width={W} height={H} rx="2.5" fill="#2456a6" />
      {grid.cells.map((row, r) => row.map((v, c) => {
        const cx = 1 + c * 10 + 5, cy = 1 + r * 10 + 5;
        const last = grid.last && grid.last[0] === c && grid.last[1] === r;
        return (
          <g key={`${r}-${c}`}>
            <circle cx={cx} cy={cy} r="3.9" fill={v === null ? "#0f2a57" : grid.colors[v]} stroke={inLine(c, r) ? "#fff" : "none"} strokeWidth="0.9" />
            {v !== null && <circle cx={cx - 1.1} cy={cy - 1.2} r="1.3" fill="#fff" opacity="0.28" />}
            {last && <circle cx={cx} cy={cy} r="4.5" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="0.5" strokeDasharray="1.2 0.8" />}
          </g>
        );
      }))}
    </svg>
  );
}
