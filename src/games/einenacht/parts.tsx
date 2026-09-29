import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ON_ROLES, type ONRole, type ONState } from "@shared/games/einenacht/logic";
import { cn } from "@/lib/utils";

/** Rollenkarte (verdeckt, bis man sie antippt) */
export function ONCard({ role, compact, label = "Deine Karte" }: { role: ONRole; compact?: boolean; label?: string }) {
  const [hidden, setHidden] = useState(true);
  const r = ON_ROLES[role];
  if (!r) return null;
  return (
    <button type="button" onClick={() => setHidden((h) => !h)} aria-label={hidden ? `${label} aufdecken` : `${label}: ${r.name}`}
      className={cn("w-full rounded-2xl text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring", compact ? "px-3 py-2.5" : "px-4 py-5",
        hidden ? "card-back text-paper" : r.team === "werwolf" ? "bg-gradient-to-b from-[#6b2430] to-[#3a1119] text-white" : "bg-paper text-paper-ink")}>
      {hidden ? <span className="flex items-center justify-center gap-2 font-bold"><Eye className="size-5" />{label} ansehen</span> : (
        <span className={cn("flex items-center gap-3", compact ? "text-left" : "flex-col")}>
          <span className={compact ? "text-3xl" : "text-6xl"} aria-hidden="true">{r.emoji}</span>
          <span>
            <span className={cn("block font-extrabold", compact ? "text-lg" : "text-3xl")} data-testid="on-role">{r.name}</span>
            <span className="block text-sm opacity-75">{r.short}</span>
          </span>
          {!compact && <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold opacity-60"><EyeOff className="size-3.5" />Tippen zum Verdecken</span>}
        </span>
      )}
    </button>
  );
}

/** Die drei Karten in der Mitte (aufgedeckte mit Namen) */
export function CenterCards({ cards, selected, onPick, pickable }: { cards: (ONRole | "?")[]; selected?: number[]; onPick?: (i: number) => void; pickable?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Karten in der Mitte">
      {cards.map((c, i) => (
        <button key={i} type="button" disabled={!pickable} onClick={() => onPick?.(i)} aria-pressed={selected?.includes(i)}
          className={cn("flex aspect-[5/7] flex-col items-center justify-center rounded-xl text-center text-sm font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
            c === "?" ? "card-back text-paper" : "bg-paper text-paper-ink", selected?.includes(i) && "ring-[3px] ring-gold")}>
          {c === "?" ? <span>Karte {i + 1}</span> : <><span className="text-3xl">{ON_ROLES[c].emoji}</span><span>{ON_ROLES[c].name}</span></>}
        </button>
      ))}
    </div>
  );
}

/** Restzeit der Diskussion */
export function Countdown({ s }: { s: ONState }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!s.dayStartedAt) return null;
  const left = Math.max(0, s.dayStartedAt + s.minutes * 60_000 - now);
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  return (
    <div className={cn("shrink-0 rounded-2xl px-4 py-2 text-center", left ? "bg-navy-950/50" : "bg-gold/20 text-gold")} data-testid="countdown">
      <span className="text-3xl font-extrabold tabular-nums">{mm}:{String(ss).padStart(2, "0")}</span>
      <span className="ml-2 text-sm">{left ? "Diskussion" : "Zeit ist um – abstimmen!"}</span>
    </div>
  );
}
