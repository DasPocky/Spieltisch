import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, PartyPopper, Trophy, X } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { accessFor, orderGames } from "@shared/platform/access";
import { eveningRanking, planStatus, PLAN_MAX, type RoomAction, type RoomState } from "@shared/platform/room";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { gameIcon } from "@/games";
import { IconTile } from "./Logo";
import { filterGames, GameSearch, NoGames, NO_FILTER } from "./GameSearch";
import { fitsPlayers, planDuration } from "@/lib/gameSearch";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PLAN_NOW_KEY } from "@/lib/createRoom";
import { favoritesFirst, useFavorites } from "@/lib/favorites";

/** Spielabend für Ergebnis-Bildschirme (die Spiele kennen den Raum nicht – der Rahmen reicht ihn durch) */
export const EveningContext = createContext<{ room: RoomState; isHost: boolean; dispatch: (a: RoomAction) => void } | null>(null);

/**
 * Spielabend: Siege über alle Partien in diesem Raum, auch über verschiedene Spiele.
 * Eine Zeile mit den Besten, antippen öffnet die ganze Liste.
 */
export function EveningLine({ className, beside }: { className?: string; beside?: ReactNode }) {
  const ctx = useContext(EveningContext);
  const [open, setOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const e = ctx?.room.evening;
  const plan = planStatus(e);
  // Gerade als Partyabend veranstaltet: die Planung öffnet sich gleich
  const fresh = !!ctx?.isHost && ctx.room.phase === "lobby" && !plan;
  useEffect(() => {
    if (!fresh) return;
    try {
      const want = sessionStorage.getItem(PLAN_NOW_KEY);
      if (want && location.pathname.endsWith(`/r/${want}`)) { sessionStorage.removeItem(PLAN_NOW_KEY); setPlanning(true); }
    } catch { /* egal */ }
  }, [fresh]);
  if (!ctx) return null;
  // Noch nichts gespielt, kein Plan: der Host kann einen Partyabend planen
  if (!e?.log.length && !plan) {
    if (!ctx.isHost || ctx.room.phase !== "lobby") return beside ? <div className={className}>{beside}</div> : null;
    return (
      <div className={cn("grid gap-2", beside && "grid-cols-2", className)}>
        {beside}
        <Button variant="outline" size="sm" onClick={() => setPlanning(true)} data-testid="plan-open" className="min-w-0" aria-label="Partyabend planen">
          <PartyPopper className="size-4 text-primary" />Partyabend
        </Button>
        <PlanSheet open={planning} onOpenChange={setPlanning} />
      </div>
    );
  }
  const ranking = eveningRanking(e);
  const top = ranking.filter((r) => r.wins > 0).slice(0, 3);
  const label = plan
    ? plan.done ? "Partyabend · durch!" : `Partyabend · Spiel ${plan.played + 1} von ${plan.games.length}`
    : `Spielabend · ${e!.log.length} ${e!.log.length === 1 ? "Partie" : "Partien"}`;
  return (
    <>
      {beside && <div className={cn("mb-2", className)}>{beside}</div>}
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
/**
 * Partyabend planen in zwei Schritten: erst Spiele wählen (Suche, passend zur Spielerzahl),
 * dann die Reihenfolge festlegen. Bis „Starten“ ist alles nur ein Entwurf.
 */
function PlanSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const ctx = useContext(EveningContext);
  const config = useSiteConfig();
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<"pick" | "order">("pick");
  const [filter, setFilter] = useState(NO_FILTER);
  const favs = useFavorites();
  // Jedes Öffnen beginnt mit einem leeren Entwurf
  useEffect(() => { if (open) { setPicked([]); setStep("pick"); setFilter(NO_FILTER); } }, [open]);
  if (!ctx) return null;
  const players = ctx.room.players.length;
  const ids = orderGames(GAME_IDS, config?.order ?? []).filter((id) => !config || accessFor(config, id) !== "off");
  // Gemerkte Spiele (aus der Spielauswahl) zuerst
  const shown = favoritesFirst(filterGames(ids, filter, players), favs);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PLAN_MAX ? [...p, id] : p));
  const move = (i: number, d: -1 | 1) => setPicked((p) => { const q = [...p]; [q[i], q[i + d]] = [q[i + d], q[i]]; return q; });
  const full = picked.length >= PLAN_MAX;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Partyabend planen</SheetTitle>
          <SheetDescription>
            {step === "pick"
              ? `Schritt 1 von 2: Spiele wählen (2 bis ${PLAN_MAX}). Nach jeder Partie ist das nächste dran – am Ende gibt es eine Siegerehrung.`
              : "Schritt 2 von 2: Reihenfolge festlegen. Mit den Pfeilen verschieben."}
          </SheetDescription>
        </SheetHeader>
        {step === "pick" ? (
          <>
            <GameSearch value={filter} onChange={setFilter} players={players} className="shrink-0 px-5 pt-1" />
            {/* Zwei gut lesbare Spalten statt winziger Kacheln */}
            <div className="grid grid-cols-2 content-start gap-1.5 overflow-y-auto px-5 pt-2" data-testid="plan-games">
              {!shown.length && <div className="col-span-2"><NoGames onReset={() => setFilter(NO_FILTER)} /></div>}
              {shown.map((id) => {
                const n = picked.indexOf(id);
                const g = getGame(id).info;
                const GIcon = gameIcon(id);
                return (
                  <button key={id} type="button" onClick={() => toggle(id)} aria-pressed={n >= 0} disabled={n < 0 && full} data-testid={`plan-${id}`}
                    className={cn("relative flex min-h-12 items-center gap-2 rounded-xl px-2 py-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-45", n >= 0 ? "bg-primary/12 ring-1 ring-inset ring-primary/35" : "glass")}>
                    <IconTile className="size-8 shrink-0"><GIcon className="size-5" /></IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-tight font-semibold">{g.name}</span>
                      <span className="block truncate text-[0.7rem] text-muted-foreground">{g.duration}</span>
                    </span>
                    {n >= 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n + 1}</span>}
                  </button>
                );
              })}
            </div>
            <div className="shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button className="w-full" disabled={picked.length < 2} data-testid="plan-next" onClick={() => setStep("order")}>
                {picked.length < 2 ? "Mindestens 2 Spiele wählen" : <>Weiter: Reihenfolge · {picked.length} Spiele<ChevronRight /></>}
              </Button>
            </div>
          </>
        ) : (
          <>
            <ol className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-5 pt-1 pb-1" data-testid="plan-order">
              {picked.map((id, i) => {
                const g = getGame(id).info;
                const GIcon = gameIcon(id);
                const fits = fitsPlayers(g, players);
                return (
                  <li key={id} className="glass flex min-w-0 shrink-0 items-center gap-1 rounded-xl py-1.5 pr-1 pl-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                    <IconTile className="size-8 shrink-0"><GIcon className="size-5" /></IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{g.name}</span>
                      <span className={cn("block truncate text-[0.7rem]", fits ? "text-muted-foreground" : "text-destructive")}>
                        {g.duration}{fits ? "" : players < g.minPlayers ? ` · ab ${g.minPlayers} Spielern` : ` · höchstens ${g.maxPlayers} Spieler`}
                      </span>
                    </span>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${g.name} nach oben`} className={ICON_BTN}><ChevronUp className="size-5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label={`${g.name} nach unten`} className={ICON_BTN}><ChevronDown className="size-5" /></button>
                    <button type="button" onClick={() => setPicked((p) => p.filter((x) => x !== id))} disabled={picked.length <= 2} aria-label={`${g.name} entfernen`} className={ICON_BTN}><X className="size-4" /></button>
                  </li>
                );
              })}
            </ol>
            <p className="shrink-0 px-5 pt-2 text-center text-xs text-muted-foreground" data-testid="plan-duration">{picked.length} Spiele · {planDuration(picked.map((id) => getGame(id).info))}</p>
            <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2 px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button variant="secondary" onClick={() => setStep("pick")} data-testid="plan-back"><ChevronLeft />Zurück</Button>
              <Button data-testid="plan-start" onClick={() => { ctx.dispatch({ type: "setPlan", games: picked }); onOpenChange(false); }}>
                <PartyPopper />Partyabend starten
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const ICON_BTN = "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30";

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
