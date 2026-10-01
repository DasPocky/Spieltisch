import { Checkbox } from "@/components/ui/checkbox";
import type { ReactNode } from "react";
import { BookOpen, Crown, Menu, Wrench } from "lucide-react";
import { getGame } from "@shared/games";
import { skipLabel } from "@shared/platform/room";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import { getGameUI } from "@/games";
import type { BoardProps } from "@/games/types";
import { setViewMode, useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { PlayerManager } from "./PlayerManager";
import { RulesSheet } from "./RulesSheet";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeSwitch } from "./ThemeSwitch";
import { ShareCode } from "./ShareCode";

export interface MenuProps {
  board: BoardProps | null;
  code?: string;
  onAddLocal?: (name: string) => void;
  onLeave: () => void;
  onCloseRoom?: () => void;
  /** Host-Rolle übernehmen (online, wenn der Host offline ist) */
  onClaimHost?: () => void;
}

/** Menü für Lobby und Partie: Ansicht, Regeln, Einladen, Einstellungen, Host-Aktionen, Spieler, Verlassen. */
export function MenuSheet({ room, me, online, isHost, dispatch, board, code, onAddLocal, onLeave, onCloseRoom, onClaimHost }: MenuProps & Pick<BoardProps, "room" | "me" | "online" | "isHost" | "dispatch">) {
  const mode = useViewMode();
  const ui = getGameUI(room.gameId);
  const name = getGame(room.gameId).info.name;
  const Extras = ui.MenuExtras;
  const playing = room.phase === "playing";
  // Überspringen bleibt für den Host immer da – sonst könnte eine Partie hängen bleiben
  const skip = isHost ? skipLabel(room) : null;
  const hostAway = !!online && !!room.hostId && !online.has(room.hostId) && !isHost;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Menü"><Menu /></Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Menü</SheetTitle>
          <SheetDescription>{isHost ? "Du leitest das Spiel und legst die Einstellungen fest." : "Nur der Host kann Spieler, Einstellungen und Spielstand ändern."}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" role="radiogroup" aria-label="Ansicht">
            {([["simple", "Einfach", "Große Tasten"], ["full", "Voll", "Alle Infos"]] as const).map(([m, label, hint]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setViewMode(m)}
                className={cn("rounded-lg py-2 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                  mode === m ? "bg-navy-600 shadow-md" : "text-muted-foreground")}>
                <div className="font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
              </button>
            ))}
          </div>

          <ThemeSwitch className="mb-4" />

          <RulesSheet gameId={room.gameId}>
            <Button variant="secondary" className="mb-4 w-full justify-start"><BookOpen />Regeln: {name}</Button>
          </RulesSheet>

          {code && <ShareCode code={code} gameName={name} />}

          <SettingsPanel room={room} editable={isHost} online={!!code} dispatch={dispatch} className="mt-5" />

          {code && isHost && (
            <label className="mt-4 flex items-center gap-3 rounded-xl bg-navy-950/40 p-3 text-sm ring-1 ring-inset ring-border">
              <Checkbox checked={!!room.hostTools} onCheckedChange={(c) => dispatch({ type: "setHostTools", on: c === true })} />
              <span>
                <span className="flex items-center gap-1.5 font-semibold"><Wrench className="size-4 text-navy-300" />Spielleiter-Funktionen</span>
                <span className="block text-xs text-muted-foreground">Für andere spielen, Einträge zurücknehmen, Stapel mischen. Aus: Du spielst ganz normal mit.</span>
              </span>
            </label>
          )}

          {hostAway && onClaimHost && (
            <Button variant="ice" className="mt-4 w-full justify-start" onClick={onClaimHost}><Crown />Host ist offline – Host übernehmen</Button>
          )}

          {isHost && playing && (
            <div className="mt-4 grid gap-2">
              {skip && (
                <Confirm title={`${skip}?`} description="Damit das Spiel weitergeht, wenn jemand nicht reagiert." confirmLabel="Ja, weiter" onConfirm={() => dispatch({ type: "skip" })}>
                  <Button variant="secondary" className="justify-start">⏭ {skip}</Button>
                </Confirm>
              )}
              <Confirm title="Neue Runde?" description="Alle Punkte werden auf 0 gesetzt. Spieler und Einstellungen bleiben." confirmLabel="Neue Runde" onConfirm={() => dispatch({ type: "restart" })}>
                <Button variant="secondary" className="justify-start">Neue Runde, gleiche Spieler</Button>
              </Confirm>
              <Confirm title="Partie beenden?" description="Ihr landet wieder in der Lobby und könnt ein anderes Spiel wählen. Der Spielstand geht verloren." confirmLabel="Beenden" onConfirm={() => dispatch({ type: "toLobby" })}>
                <Button variant="destructive" className="justify-start">Partie beenden – zur Lobby</Button>
              </Confirm>
            </div>
          )}

          {board && Extras && <Extras {...board} />}

          <Section title="Spieler">
            <PlayerManager room={room} me={me} online={online} editable={isHost} dispatch={dispatch} onAddLocal={onAddLocal} />
          </Section>

          <Button variant="ghost" className="mt-6 w-full text-muted-foreground" onClick={onLeave}>
            {code ? "Raum verlassen" : "Spiel verlassen"}
          </Button>
          {code && isHost && onCloseRoom && (
            <Confirm
              title="Raum endgültig löschen?"
              description="Spielstand, Namen und Verlauf werden sofort vom Server gelöscht. Alle Mitspieler fliegen raus."
              confirmLabel="Löschen"
              onConfirm={onCloseRoom}
            >
              <Button variant="destructive" className="mt-2 w-full">Raum löschen</Button>
            </Confirm>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 font-semibold">{title}</h3>
      {children}
    </section>
  );
}
