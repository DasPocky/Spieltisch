import type { TableModel } from "@/platform/table/model";
import { GAP, PAD, GAP_X, GAP_Y, fitWidth, useSize } from "./fit";
import { TileFace } from "./Tile";

type Tiles = NonNullable<TableModel["tiles"]>;

/** Zahlen-Rommé am Großen Tisch: alle Reihen und Gruppen groß auf dem Filz, sie werden kleiner, je voller der Tisch ist */
export function FeltTiles({ tiles }: { tiles: Tiles }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const w = fitWidth(tiles.groups.map((g) => g.length), size.w, size.h, Math.max(24, size.h / 4.2), 10);
  return (
    <div className="flex h-[92cqh] w-[94cqw] flex-col items-center gap-[2cqh]" data-testid="table-tiles">
      <div ref={ref} className="flex min-h-0 w-full flex-1 flex-wrap content-center items-center justify-center" style={{ columnGap: GAP_X * w, rowGap: GAP_Y * w }}>
        {tiles.groups.length ? tiles.groups.map((g, i) => (
          <div key={`${i}-${g.join()}`} className="flex rounded-[0.6em] bg-black/20" style={{ gap: GAP * w, padding: PAD * w }} data-testid="table-group">
            {g.map((t) => <TileFace key={t} tile={t} style={{ width: w }} />)}
          </div>
        )) : <span className="text-[4cqh] font-semibold text-white/70">Noch liegt nichts auf dem Tisch</span>}
      </div>
      <span className="shrink-0 rounded-full bg-black/35 px-[2cqh] py-[0.6cqh] text-[3cqh] font-semibold text-white/90" data-testid="table-tiles-note">{tiles.note}</span>
    </div>
  );
}
