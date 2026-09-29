import { useEffect, useRef } from "react";
import { cn, fmt } from "@/lib/utils";

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  /** Fortschritt 0..1 (z. B. Richtung Spielziel), optional */
  progress?: number;
}

/**
 * Kompakte Punkteleiste – bis 4 Spieler als Raster, darüber wischbar.
 * Der Spieler am Zug ist blau hervorgehoben, der Führende bekommt einen Stern.
 */
export function Scoreboard({ entries, currentId, me, online, selectedId, onSelect }: {
  entries: ScoreEntry[];
  currentId: string | null;
  me: string | null;
  online: Set<string> | null;
  /** optional: antippbar, z. B. um den Block eines Spielers anzuzeigen */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(...entries.map((p) => p.score));
  const fits = entries.length <= 4;

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-cur=true]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [currentId]);

  return (
    <div
      ref={ref}
      className={cn("shrink-0 gap-1.5 pt-1 pb-1", fits ? "grid" : "no-scrollbar -mx-4 flex snap-x overflow-x-auto px-4")}
      style={fits ? { gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` } : undefined}
    >
      {entries.map((p) => {
        const cur = p.id === currentId;
        const lead = p.score === max && max > 0;
        return (
          <div
            key={p.id}
            data-cur={cur}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-pressed={onSelect ? selectedId === p.id : undefined}
            onClick={onSelect ? () => onSelect(p.id) : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } } : undefined}
            className={cn(
              "relative min-w-0 rounded-xl px-2.5 pt-1.5 pb-2 text-left transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              onSelect && "cursor-pointer",
              selectedId === p.id && !cur && "ring-2 ring-inset ring-navy-300/70",
              selectedId === p.id && cur && "ring-2 ring-inset ring-white/70",
              !fits && "w-26 shrink-0 snap-start",
              cur ? "bg-gradient-to-b from-navy-400 to-primary text-white shadow-[0_6px_18px_rgb(63_122_224/0.4)]" : "glass",
            )}
          >
            <div className="flex items-center gap-1 text-xs font-semibold">
              {online && (
                <span className={cn("size-1.5 shrink-0 rounded-full", online.has(p.id) ? "bg-emerald-400" : "bg-current opacity-30")}
                  aria-label={online.has(p.id) ? "online" : "offline"} />
              )}
              <span className={cn("truncate", !cur && "text-muted-foreground")}>{p.name}{p.id === me ? " (du)" : ""}</span>
              {lead && <span className="ml-auto text-[0.7rem] text-gold" aria-label="Führt">★</span>}
            </div>
            <div className="text-lg font-extrabold leading-tight tracking-tight tabular-nums">{fmt(p.score)}</div>
            {p.progress !== undefined && (
              <div className={cn("mt-1 h-1 overflow-hidden rounded-full", cur ? "bg-white/25" : "bg-navy-950/60")}>
                <i className={cn("block h-full rounded-full", cur ? "bg-white" : "bg-navy-300")} style={{ width: `${Math.min(100, Math.max(0, p.progress) * 100)}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
