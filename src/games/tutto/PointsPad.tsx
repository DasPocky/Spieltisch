import { CARD_BY_ID, type TuttoAction, type TuttoState } from "@shared/games/tutto/logic";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import type { ViewMode } from "@/hooks/useViewMode";
import { cn, fmt, vibrate } from "@/lib/utils";

const BASE = [50, 100, 200, 500];

/**
 * Punkte-Eingabe per großer Tasten – passend zur gezogenen Karte gibt es Extra-Tasten.
 * Einfach: 3 große Tasten pro Reihe. Voll: 4 kleinere Tasten mit −50 und Löschen.
 */
export function PointsPad({ state, onAction, disabled, mode }: { state: TuttoState; onAction: (a: TuttoAction) => void; disabled: boolean; mode: ViewMode }) {
  const simple = mode === "simple";
  const base = BASE;
  const latest = state.turnCards[state.turnCards.length - 1];
  const extra = latest ? CARD_BY_ID[latest].quick : undefined;
  const showExtra = extra !== undefined && !base.includes(extra) && extra !== 1000;
  const canDouble = state.turnCards.includes("x2") && state.turnPts > 0;

  const keyCls = cn(
    "rounded-xl font-bold outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-40",
    simple ? "h-14 text-xl" : "h-12 text-[1.05rem]",
  );
  const key = (delta: number, label: string, hl = false) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      onClick={() => { vibrate(8); onAction({ type: "addPts", delta }); }}
      className={cn(keyCls, hl ? "bg-gold text-navy-950" : "bg-navy-700/80 ring-1 ring-inset ring-border active:bg-navy-600")}
    >
      {label}
    </button>
  );
  const quiet = cn(keyCls, "text-sm font-semibold text-muted-foreground ring-1 ring-inset ring-border active:bg-accent");

  return (
    <section className="glass rounded-2xl p-2.5">
      <div className="mb-2 flex items-center justify-between px-1.5">
        <span className="text-sm text-muted-foreground">Punkte dieser Runde</span>
        <div className="flex items-center gap-2">
          {simple && state.turnPts > 0 && (
            <button type="button" disabled={disabled} onClick={() => onAction({ type: "clearPts" })}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border disabled:opacity-40">
              Löschen
            </button>
          )}
          <b className="text-3xl font-extrabold tracking-tight tabular-nums">{fmt(state.turnPts)}</b>
        </div>
      </div>
      <div className={cn("grid gap-2", simple ? "grid-cols-3" : "grid-cols-4")}>
        {base.map((v) => key(v, `+${v}`))}
        {showExtra && key(extra!, `+${fmt(extra!)}`, true)}
        {key(1000, "+1.000", latest === "pm")}
        {canDouble && (
          <button
            type="button" disabled={disabled}
            onClick={() => { vibrate(15); onAction({ type: "double" }); }}
            className={cn(keyCls, "bg-gold text-navy-950")}
          >×2</button>
        )}
        {!simple && (
          <>
            <button type="button" disabled={disabled} onClick={() => onAction({ type: "addPts", delta: -50 })} className={quiet}>−50</button>
            <button type="button" disabled={disabled} onClick={() => onAction({ type: "clearPts" })} className={quiet}>Löschen</button>
          </>
        )}
      </div>

      {state.turnCards.includes("pm") && (
        <label className="mt-2.5 flex items-center gap-3 px-1.5 text-sm">
          <Checkbox checked={state.pmOn} disabled={disabled} onCheckedChange={(c) => onAction({ type: "setPm", on: c === true })} />
          Tutto geschafft: Führendem 1.000 abziehen
        </label>
      )}
      {latest === "clover" && (
        <Confirm
          title="Kleeblatt geschafft?"
          description="Zweimal hintereinander Tutto – damit ist das Spiel sofort gewonnen."
          confirmLabel="Sieg eintragen"
          onConfirm={() => { vibrate([30, 60, 30]); onAction({ type: "clover" }); }}
        >
          <Button variant="secondary" className="mt-2.5 h-11 w-full" disabled={disabled}>☘ Zweimal Tutto – Sieg eintragen</Button>
        </Confirm>
      )}
    </section>
  );
}
