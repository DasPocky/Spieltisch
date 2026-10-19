import { createContext, useContext, useState } from "react";
import { Check, ChevronRight, PartyPopper, Trophy } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { accessFor, orderGames } from "@shared/platform/access";
import { eveningRanking, planStatus, PLAN_MAX, type RoomAction, type RoomState } from "@shared/platform/room";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { gameIcon } from "@/games";
import { IconTile } from "./Logo";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Spielabend für Ergebnis-Bildschirme (die Spiele kennen den Raum nicht – der Rahmen reicht ihn durch) */
export const EveningContext = createContext<{ room: RoomState; isHost: boolean; dispatch: (a: RoomAction) => void } | null>(null);

/**
 * Spielabend: Siege über alle Partien in diesem Raum, auch über verschiedene Spiele.
 * Eine Zeile mit den Besten, antippen öffnet die ganze Liste.
 */
export function EveningLine({ className }: { className?: string }) {
  const ctx = useContext(EveningContext);
  const [open, setOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const e = ctx?.room.evening;
  const plan = planStatus(e);
  if (!ctx) return null;
  // Noch nichts gespielt, kein Plan: der Host kann einen Partyabend planen
  if (!e?.log.length && !plan) {
    if (!ctx.isHost || ctx.room.phase !== "lobby") return null;
    return (
      <>
        <button type="button" onClick={() => setPlanning(true)} data-testid="plan-open"
          className={cn("flex w-full items-center justify-center gap-2 rounded-xl py-1.5 text-sm font-semibold text-primary", className)}>
          <PartyPopper className="size-4" />Partyabend planen – mehrere Spiele mit Gesamtwertung
        </button>
        <PlanSheet open={planning} onOpenChange={setPlanning} />
      </>
    );
  }
  const ranking = eveningRanking(e);
  const top = ranking.filter((r) => r.wins > 0).slice(0, 3);
  const label = plan
    ? plan.done ? "Partyabend · durch!" : `Partyabend · Spiel ${plan.played + 1} von ${plan.games.length}`
    : `Spielabend · ${e!.log.length} ${e!.log.length === 1 ? "Partie" : "Partien"}`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="evening"
        className={cn("glass flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring", className)}>
        {plan ? <PartyPopper className="size-4 shrink-0 text-primary" /> : <Trophy className="size-4 shrink-0 text-primary" />}
        <span className="min-w-0 flex-1 truncate">
          <b>{label.split(" · ")[0]}</b> <span className="text-muted-foreground">· {label.split(" · ").slice(1).join(" · ")}</span>
          {top.length > 0 && <span className="text-muted-foreground"> · {top.map((r) => `${r.name} ${r.wins}`).join(" · ")}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <EveningSheet open={open} onOpenChange={setOpen} onPlan={() => { setOpen(false); setPlanning(true); }} />
      <PlanSheet open={planning} onOpenChange={setPlanning} />
    </>
  );
}

/** Partyabend planen: Spiele antippen in der gewünschten Reihenfolge */
function PlanSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const ctx = useContext(EveningContext);
  const config = useSiteConfig();
  const [picked, setPicked] = useState<string[]>([]);
  if (!ctx) return null;
  const ids = orderGames(GAME_IDS, config?.order ?? []).filter((id) => !config || accessFor(config, id) !== "off");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PLAN_MAX ? [...p, id] : p));
  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPicked([]); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Partyabend planen</SheetTitle>
          <SheetDescription>Spiele in der gewünschten Reihenfolge antippen. Nach jeder Partie ist das nächste dran – am Ende gibt es eine Siegerehrung.</SheetDescription>
        </SheetHeader>
        {/* Kacheln im Raster: alle Spiele auf einen Blick, ohne Scrollen */}
        <div className="grid grid-cols-4 gap-1.5 overflow-y-auto px-5 pt-1" data-testid="plan-games">
          {ids.map((id) => {
            const n = picked.indexOf(id);
            const GIcon = gameIcon(id);
            return (
              <button key={id} type="button" onClick={() => toggle(id)} aria-pressed={n >= 0} data-testid={`plan-${id}`}
                className={cn("relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring", n >= 0 ? "bg-primary/12 ring-1 ring-inset ring-primary/35" : "glass")}>
                <IconTile className="size-9"><GIcon className="size-6" /></IconTile>
                <span className="line-clamp-2 w-full text-[0.7rem] leading-tight font-semibold">{getGame(id).info.name}</span>
                {n >= 0 && <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n + 1}</span>}
              </button>
            );
          })}
        </div>
        <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button className="w-full" disabled={picked.length < 2} data-testid="plan-start"
            onClick={() => { ctx.dispatch({ type: "setPlan", games: picked }); onOpenChange(false); setPicked([]); }}>
            <PartyPopper />{picked.length < 2 ? "Mindestens 2 Spiele wählen" : `Partyabend starten · ${picked.length} Spiele`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EveningSheet({ open, onOpenChange, onPlan }: { open: boolean; onOpenChange: (o: boolean) => void; onPlan: () => void }) {
  const ctx = useContext(EveningContext);
  const e = ctx?.room.evening;
  if (!ctx || !e) return null;
  const plan = planStatus(e);
  const ranking = eveningRanking(e);
  const places = ranking.map((r, i) => (i > 0 && ranking[i - 1].wins === r.wins ? -1 : i + 1));
  for (let i = 1; i < places.length; i++) if (places[i] === -1) places[i] = places[i - 1];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{plan ? "Partyabend" : "Spielabend"}</SheetTitle>
          <SheetDescription>Siege über alle Partien hier – auch über verschiedene Spiele.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {plan && (
            <ol className="mb-4 flex flex-wrap gap-1.5" data-testid="plan-progress">
              {plan.games.map((id, i) => (
                <li key={i} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", i < plan.played ? "bg-primary/14 text-primary" : i === plan.played ? "bg-primary text-primary-foreground" : "glass text-muted-foreground")}>
                  {i < plan.played && <Check className="size-3" />}{i + 1}. {getGame(id).info.name}
                </li>
              ))}
            </ol>
          )}
          <ol className="grid gap-1.5" data-testid="evening-ranking">
            {ranking.map((r, i) => (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", places[i] === 1 && r.wins > 0 ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "glass")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums", places[i] === 1 && r.wins > 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{places[i]}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{r.wins} <span className="text-xs font-normal text-muted-foreground">{r.wins === 1 ? "Sieg" : "Siege"}</span></span>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Partien</h3>
          <ul className="grid gap-1 text-sm">
            {[...e.log].reverse().map((g, i) => (
              <li key={i} className="flex justify-between gap-3 rounded-lg px-1 py-1">
                <span className="text-muted-foreground">{getGame(g.gameId).info.name}</span>
                <span className="truncate font-semibold">{g.winners.map((id) => e.names[id] ?? "?").join(" & ") || "–"}</span>
              </li>
            ))}
          </ul>
          {ctx.isHost && plan && (
            <Button variant="secondary" className="mt-5 w-full" onClick={() => { ctx.dispatch({ type: "setPlan", games: null }); onOpenChange(false); }} data-testid="plan-end">Partyabend beenden</Button>
          )}
          {ctx.isHost && !plan && ctx.room.phase === "lobby" && (
            <Button variant="secondary" className="mt-5 w-full" onClick={onPlan}><PartyPopper />Partyabend planen</Button>
          )}
          {ctx.isHost && (
            <Confirm title="Spielabend neu beginnen?" description="Alle Siege dieses Abends werden auf 0 gesetzt." confirmLabel="Zurücksetzen"
              onConfirm={() => { ctx.dispatch({ type: "resetEvening" }); onOpenChange(false); }}>
              <Button variant="secondary" className="mt-5 w-full">Neuen Spielabend beginnen</Button>
            </Confirm>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
