import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal, Sparkles } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { orderGames, withDefaults, type Access } from "@shared/platform/access";
import { MODE_STATES, modeState, PLAY_MODES, type ModeState } from "@shared/platform/modes";
import { createRoom, type RoomAction } from "@shared/platform/room";
import type { Options } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gameIcon } from "@/games";
import { cn } from "@/lib/utils";
import { IconTile } from "@/platform/Logo";
import { SettingsPanel } from "@/platform/SettingsPanel";
import { useAdmin } from "./context";
import { gameName } from "./shared";

const ACCESS: { value: Access; label: string }[] = [{ value: "on", label: "An" }, { value: "code", label: "Code" }, { value: "off", label: "Aus" }];

/**
 * Spiele: je Spiel Freigabe (an, mit Zugangscode, aus), „Neu“-Markierung, Platz in der Auswahl
 * und eigene Standard-Einstellungen. Alles gilt sofort – mit „Rückgängig“ im Hinweis.
 */
export function GamesSection() {
  const { config, save } = useAdmin();
  const [edit, setEdit] = useState<string | null>(null);
  const order = orderGames(GAME_IDS, config.order);
  const counts = { on: 0, code: 0, off: 0 };
  for (const id of order) counts[config.games[id] ?? "on"]++;

  const move = (i: number, d: -1 | 1) => {
    const n = [...order];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    void save({ order: n }, `${gameName(order[i])} ${d < 0 ? "nach oben" : "nach unten"}`);
  };

  return (
    <div className="grid gap-3" data-testid="admin-games">
      <p className="text-sm text-muted-foreground">{counts.on} frei{counts.code ? ` · ${counts.code} mit Zugangscode` : ""}{counts.off ? ` · ${counts.off} aus` : ""}. Reihenfolge und „Neu“ gelten für die Spielauswahl und den Spiele-Tab.</p>
      <ol className="grid gap-1.5 lg:grid-cols-2">
        {order.map((id, i) => {
          const Icon = gameIcon(id);
          const access = config.games[id] ?? "on";
          const isNew = config.featured.includes(id);
          const custom = Object.keys(config.defaults?.[id] ?? {}).length > 0;
          return (
            <li key={id} className={cn("glass flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl p-2", access === "off" && "opacity-70")} data-testid={`admin-game-${id}`}>
              <IconTile className="size-9 rounded-xl"><Icon className="size-6" /></IconTile>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-semibold">{gameName(id)}</span>
                {custom && <span className="block text-xs text-primary">eigene Standards</span>}
              </span>
              <span className="flex shrink-0 rounded-full bg-navy-950/40 p-0.5 ring-1 ring-inset ring-border" role="radiogroup" aria-label={`Freigabe ${gameName(id)}`}>
                {ACCESS.map((a) => (
                  <button key={a.value} type="button" role="radio" aria-checked={access === a.value}
                    onClick={() => access !== a.value && void save({ games: { ...config.games, [id]: a.value } }, `${gameName(id)}: ${a.label}`)}
                    className={cn("h-7 rounded-full px-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      access === a.value ? (a.value === "off" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary") : "text-muted-foreground")}>
                    {a.label}
                  </button>
                ))}
              </span>
              <ModeRow id={id} />
              <span className="flex w-full items-center justify-end gap-0.5 sm:w-auto">
                <button type="button" aria-pressed={isNew} aria-label={`${gameName(id)} als neu markieren`}
                  onClick={() => void save({ featured: isNew ? config.featured.filter((x) => x !== id) : [...config.featured, id] }, isNew ? `${gameName(id)} nicht mehr neu` : `${gameName(id)} als neu markiert`)}
                  className={cn("mr-auto flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mr-0", isNew ? "bg-primary/14 text-primary" : "text-muted-foreground")}>
                  <Sparkles className="size-3.5" />Neu
                </button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => setEdit(id)} aria-label={`Standards ${gameName(id)}`}><SlidersHorizontal className="size-4" />Standards</Button>
                <Button variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${gameName(id)} nach oben`}><ArrowUp /></Button>
                <Button variant="ghost" size="icon" className="size-8" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`${gameName(id)} nach unten`}><ArrowDown /></Button>
              </span>
            </li>
          );
        })}
      </ol>
      <DefaultsSheet gameId={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

/** Spielweisen eines Spiels (Tisch, am Rechner, Bühne): an, Beta (nur Geräte der Verwaltung), aus */
function ModeRow({ id }: { id: string }) {
  const { config, save } = useAdmin();
  const modes = PLAY_MODES.filter((m) => modeState(config.modes, id, m.value) !== "none");
  if (!modes.length) return null;
  return (
    <span className="flex w-full flex-wrap gap-1.5" data-testid={`admin-modes-${id}`}>
      {modes.map((m) => {
        const st = modeState(config.modes, id, m.value) as ModeState;
        return (
          <span key={m.value} className="flex items-center gap-1 rounded-full bg-navy-950/30 py-0.5 pr-0.5 pl-2.5 text-xs ring-1 ring-inset ring-border" title={m.hint}>
            <span className="font-semibold">{m.label}</span>
            <span className="flex" role="radiogroup" aria-label={`${gameName(id)}: ${m.label}`}>
              {MODE_STATES.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={st === o.value}
                  onClick={() => st !== o.value && void save({ modes: { ...config.modes, [id]: { ...config.modes[id], [m.value]: o.value } } }, `${gameName(id)} ${m.label}: ${o.label}`)}
                  className={cn("h-6 rounded-full px-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    st === o.value ? (o.value === "off" ? "bg-destructive/15 text-destructive" : o.value === "beta" ? "bg-ice/20 text-ice" : "bg-primary/15 text-primary") : "text-muted-foreground")}>
                  {o.label}
                </button>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Standard-Einstellungen eines Spiels für neue Räume und lokale Partien – jede Änderung gilt sofort */
function DefaultsSheet({ gameId, onClose }: { gameId: string | null; onClose: () => void }) {
  const { config, saveDefaults } = useAdmin();
  const id = gameId ?? GAME_IDS[0];
  const logic = getGame(id);
  const mine = config.defaults?.[id] ?? {};
  const room = useMemo(() => {
    const r = createRoom(id);
    return { ...r, options: withDefaults(logic.settings, r.options, mine) };
  }, [id, logic, mine]);
  const dispatch = (a: RoomAction) => {
    if (a.type !== "setOption") return;
    const label = logic.settings.find((d) => d.key === a.key)?.label ?? a.key;
    void saveDefaults({ ...config.defaults, [id]: { ...mine, [a.key]: a.value } as Options }, `${logic.info.name}: ${label}`);
  };
  const reset = () => void saveDefaults(Object.fromEntries(Object.entries(config.defaults ?? {}).filter(([g]) => g !== id)), `${logic.info.name}: eingebaute Standards`);
  return (
    <Sheet open={!!gameId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent data-testid="defaults-sheet">
        <SheetHeader>
          <SheetTitle>Standards: {logic.info.name}</SheetTitle>
          <SheetDescription>Gilt für neue Räume und lokale Spiele, sofort. In der Lobby lässt sich alles weiter ändern.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-3 pb-4">
          {logic.settings.length ? <SettingsPanel key={id} room={room} editable online={false} dispatch={dispatch} title={false} presets={false} />
            : <p className="text-muted-foreground">{logic.info.name} hat keine Einstellungen.</p>}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="secondary" disabled={!Object.keys(mine).length} onClick={reset}>Eingebaute Standards</Button>
          <Button onClick={onClose}>Fertig</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
