import { Checkbox } from "@/components/ui/checkbox";
import { cloneElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { BookOpen, ChevronRight, Crown, History, Menu, Undo2, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";
import { getGame } from "@shared/games";
import { currentPlayerId, skipLabel, type RoomState } from "@shared/platform/room";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import { getGameUI } from "@/games";
import type { BoardProps } from "@/games/types";
import { navigate } from "@/hooks/useRoute";
import { setViewMode, useViewMode } from "@/hooks/useViewMode";
import { setPref, usePrefs, type Prefs } from "@/lib/prefs";
import { RETURN_KEY } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { RulesSheet } from "./RulesSheet";
import { hasInGameSettings, HINT_GAMES, SettingsPanel } from "./SettingsPanel";
import { ThemeSwitch } from "./ThemeSwitch";
import { ShareCode } from "./ShareCode";
import { Collapsible, lastLog, PlayersSheet } from "./PlayersHistory";

export interface MenuProps {
  board: BoardProps | null;
  code?: string;
  onAddLocal?: (name: string) => void;
  onLeave: () => void;
  onCloseRoom?: () => void;
  /** Host-Rolle übernehmen (online, wenn der Host offline ist) */
  onClaimHost?: () => void;
}

/** So lange ohne Änderung am Spielstand gilt eine Partie als „hängt“ – dann steht Überspringen gleich da */
const STALL_MS = 20_000;

/**
 * Ein Menü für Lobby und Partie, feste Abschnitte nach Häufigkeit:
 * Partie · Spieler & Verlauf · Regeln · Einladen · Mein Gerät · Verlassen. Leere Abschnitte fallen weg.
 * Raum-Einstellungen stehen in der Lobby; hier nur, was sich während der Partie ändern lässt.
 */
export function MenuSheet({ room, online, isHost, dispatch, board, code, onLeave, onCloseRoom, onClaimHost, manage }: MenuProps & Pick<BoardProps, "room" | "me" | "online" | "isHost" | "dispatch"> & {
  /** „Spieler verwalten“ für „Spieler & Verlauf“ (Host) */
  manage?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState(false);
  const ui = getGameUI(room.gameId);
  const name = getGame(room.gameId).info.name;
  const Extras = ui.MenuExtras;
  const host = room.players.find((p) => p.id === room.hostId);
  const hostAway = !!online && !!room.hostId && !online.has(room.hostId) && !isHost;
  const last = board ? lastLog(ui, board) : undefined;
  // Alle sehen kurz, wenn der Host etwas zurückgenommen hat
  const undone = useRef(room.undone ?? 0);
  useEffect(() => {
    if ((room.undone ?? 0) > undone.current) toast("Letzter Zug wurde zurückgenommen.");
    undone.current = room.undone ?? 0;
  }, [room.undone]);
  const role = !code ? "Ein Handy für alle" : isHost ? `Du bist Host · Raum ${code}` : `Gast · Host ist ${host?.name ?? "weg"}`;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Menü"><Menu /></Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Menü</SheetTitle>
            <SheetDescription>{role}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {board && (isHost || hostAway) && (
              <Section title="Partie">
                {isHost && <HostActions room={room} board={board} online={online} dispatch={dispatch} />}
                {hostAway && onClaimHost && (
                  <Button variant="ice" className="justify-start" onClick={onClaimHost}><Crown />Host ist offline – Host übernehmen</Button>
                )}
                {isHost && Extras && <Extras {...board} />}
                {code && isHost && (
                  <label className="flex items-center gap-3 rounded-xl p-3 text-sm ring-1 ring-inset ring-border">
                    <Checkbox checked={!!room.hostTools} onCheckedChange={(c) => dispatch({ type: "setHostTools", on: c === true })} />
                    <span>
                      <span className="flex items-center gap-1.5 font-semibold"><Wrench className="size-4 text-navy-300" />Host darf für alle spielen</span>
                      <span className="block text-xs text-muted-foreground">Für andere eintragen, zurücknehmen, mischen – z. B. wenn jemand kein Handy hat. Aus: Du spielst ganz normal mit.</span>
                    </span>
                  </label>
                )}
                {isHost && hasInGameSettings(room) && (
                  <Collapsible title="Während des Spiels" testId="ingame-settings">
                    <SettingsPanel room={room} editable={isHost} online={!!code} dispatch={dispatch} inGame title={false} />
                  </Collapsible>
                )}
              </Section>
            )}

            {/* Spieleigenes für alle, z. B. Codenames „Dein Team“ */}
            {board && !isHost && Extras && <Extras {...board} />}

            {board && (
              <Section title="Spieler & Verlauf" hideTitle>
                <Row icon={History} label="Spieler & Verlauf" sub={last} onClick={() => { setOpen(false); setPlayers(true); }} />
              </Section>
            )}

            <Section title="Regeln" hideTitle>
              <RulesSheet gameId={room.gameId}>
                <Row icon={BookOpen} label={`Regeln: ${name}`} />
              </RulesSheet>
            </Section>

            {/* In der Lobby steht der Raumcode schon auf der Seite */}
            {code && board && (
              <Section title="Einladen">
                <ShareCode code={code} gameName={name} />
                <p className="px-1 text-xs text-muted-foreground">Die PIN steht nicht im Link – sag sie dazu.</p>
              </Section>
            )}

            <Section title="Mein Gerät">
              <MyDevice room={room} />
            </Section>

            <Section title="Verlassen">
              <Leave code={code} isHost={isHost} onLeave={onLeave}>
                <Button variant="secondary" className="w-full">{code ? "Raum verlassen" : "Zur Startseite"}</Button>
              </Leave>
              {!code && <p className="px-1 text-xs text-muted-foreground">Die Partie bleibt auf diesem Handy gespeichert.</p>}
              {code && isHost && onCloseRoom && (
                <div className="mt-3 grid gap-1.5 border-t border-border pt-3">
                  <Confirm title="Raum schließen?" description="Die Partie endet für alle. Spielstand, Namen und Verlauf werden sofort vom Server gelöscht." confirmLabel="Schließen" onConfirm={onCloseRoom}>
                    <Button variant="destructive" className="w-full">Raum schließen</Button>
                  </Confirm>
                  <p className="px-1 text-xs text-muted-foreground">Nur der Host kann den Raum für alle schließen.</p>
                </div>
              )}
            </Section>
          </div>
        </SheetContent>
      </Sheet>
      {board && <PlayersSheet open={players} onOpenChange={setPlayers} ui={ui} board={board} manage={manage} />}
    </>
  );
}

/** Host: Nochmal, anderes Spiel, ein Rückgängig-Knopf und – nur wenn etwas hängt – Überspringen */
function HostActions({ room, board, online, dispatch }: { room: RoomState; board: BoardProps; online: Set<string> | null; dispatch: BoardProps["dispatch"] }) {
  const ui = getGameUI(room.gameId);
  const skip = skipLabel(room);
  const [showSkip, setShowSkip] = useState(false);
  const stalled = useStalled(room.game);
  const cur = currentPlayerId(room);
  const stuck = stalled || (!!online && !!cur && !online.has(cur));
  // Rückgängig: zuerst die Plattform (letzte Züge), danach das Zurücknehmen des Spiels (z. B. Kniffel-Einträge)
  const undoable = room.undo?.length ?? room.undoCount ?? 0;
  const entry = board.hostTools && !!ui.undoEntry?.(board.game);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Confirm title="Nochmal spielen?" description="Alle Punkte werden auf 0 gesetzt. Spieler und Einstellungen bleiben." confirmLabel="Nochmal" onConfirm={() => dispatch({ type: "restart" })}>
          <Button variant="secondary" className="px-2 text-[0.95rem] whitespace-nowrap">Nochmal spielen</Button>
        </Confirm>
        <Confirm title="Anderes Spiel?" description="Die Partie endet, ihr landet in der Lobby und wählt ein anderes Spiel. Alle bleiben dabei." confirmLabel="Zur Lobby" onConfirm={() => dispatch({ type: "toLobby" })}>
          <Button variant="secondary" className="px-2 text-[0.95rem] whitespace-nowrap">Anderes Spiel</Button>
        </Confirm>
      </div>
      <Button variant="secondary" className="justify-start text-[0.95rem] whitespace-nowrap" disabled={!undoable && !entry}
        onClick={() => (undoable ? dispatch({ type: "undo" }) : board.act({ type: "undo" }))}>
        <Undo2 />Letzten Zug zurücknehmen{undoable > 0 && <span className="ml-auto text-xs font-normal text-muted-foreground" aria-label={`noch ${undoable}-mal`}>{undoable}×</span>}
      </Button>
      {skip && (stuck || showSkip ? (
        <Confirm title={`${skip}?`} description="Damit das Spiel weitergeht, wenn jemand nicht reagiert." confirmLabel="Ja, weiter" onConfirm={() => dispatch({ type: "skip" })}>
          <Button variant="secondary" className="justify-start">⏭ {skip}</Button>
        </Confirm>
      ) : (
        <button type="button" onClick={() => setShowSkip(true)} className="justify-self-start px-1 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
          Hängt etwas?
        </button>
      ))}
    </>
  );
}

/** Wird true, wenn sich der Spielstand eine Weile nicht geändert hat */
function useStalled(game: unknown) {
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    setStalled(false);
    const t = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(t);
  }, [game]);
  return stalled;
}

const QUICK: [keyof Prefs, string][] = [["sound", "Töne"], ["vibration", "Vibration"], ["hints", "Spielhilfen für mich"]];

/** Nur für dieses Handy: Ansicht, hell/dunkel, Töne – der Rest steht im Profil */
function MyDevice({ room }: { room: RoomState }) {
  const mode = useViewMode();
  const p = usePrefs();
  const quick = QUICK.filter(([k]) => k !== "hints" || HINT_GAMES.has(room.gameId));
  return (
    <>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" role="radiogroup" aria-label="Ansicht">
        {([["simple", "Einfach", "große Tasten"], ["full", "Voll", "alle Infos"]] as const).map(([m, label, hint]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setViewMode(m)}
            className={cn("rounded-lg py-2 text-center text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
              mode === m ? "bg-navy-600 shadow-md" : "text-muted-foreground")}>
            <span className="font-semibold">{label}</span> <span className="text-xs text-muted-foreground">· {hint}</span>
          </button>
        ))}
      </div>
      <ThemeSwitch />
      <div className="flex flex-wrap gap-1.5">
        {quick.map(([key, label]) => {
          const blocked = key === "hints" && !!room.noHints;
          const on = p[key] && !blocked;
          return (
            <button key={key} type="button" role="switch" aria-checked={on} disabled={blocked} onClick={() => setPref(key, !p[key])}
              title={blocked ? "Im Raum ausgeschaltet" : undefined}
              className={cn("h-9 rounded-full px-2.5 text-[0.8125rem] font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50",
                on ? "bg-primary/14 text-primary ring-primary/35" : "text-muted-foreground ring-border")}>
              {label}
            </button>
          );
        })}
      </div>
      <Row icon={UserRound} label="Mehr in „Mein Profil“" sub="Vorlesen, Stimme, Name und Avatar"
        onClick={() => { try { sessionStorage.setItem(RETURN_KEY, location.pathname); } catch { /* egal */ } navigate("/profil"); }} />
    </>
  );
}

/** Verlassen – online mit Rückfrage, weil man danach Code und PIN wieder braucht */
export function Leave({ code, isHost, onLeave, children }: { code?: string; isHost: boolean; onLeave: () => void; children: ReactElement<{ onClick?: () => void }> }) {
  if (!code) return cloneElement(children, { onClick: onLeave });
  return (
    <Confirm title="Raum verlassen?" confirmLabel="Verlassen" onConfirm={onLeave}
      description={isHost ? "Zum Zurückkommen brauchst du wieder Raumcode und PIN. Solange du weg bist, kann jemand anderes Host werden." : "Zum Zurückkommen brauchst du wieder Raumcode und PIN."}>
      {children}
    </Confirm>
  );
}

/** Eine Zeile mit Pfeil, die etwas öffnet */
function Row({ icon: Icon, label, sub, onClick, ...rest }: { icon: typeof History; label: string; sub?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} {...rest}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset ring-border outline-none transition active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring">
      <Icon className="size-4.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      <ChevronRight className="size-4.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Abschnitt mit kleiner Überschrift (auch für Spiele in MenuExtras) */
export function Section({ title, hideTitle, children }: { title: string; hideTitle?: boolean; children: ReactNode }) {
  return (
    <section className={cn("mt-5 grid gap-2 first:mt-2", hideTitle && "mt-3")} aria-label={hideTitle ? title : undefined}>
      {!hideTitle && <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>}
      {children}
    </section>
  );
}
