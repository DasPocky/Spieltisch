import { useEffect, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { canPlayTurn, currentPlayerId, playerLimits, skipLabel, type RoomAction, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getGameUI } from "@/games";
import type { BoardProps, GameUI } from "@/games/types";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { pickGameKey } from "@/lib/createRoom";
import { LAST_GAME_KEY } from "@/lib/storage";
import { savedAccess, useSiteConfig } from "@/hooks/useSiteConfig";
import { accessFor } from "@shared/platform/access";
import { IconTile } from "./Logo";
import { MenuSheet, type MenuProps } from "./MenuSheet";
import { PlayerManager } from "./PlayerManager";
import { SettingsPanel } from "./SettingsPanel";
import { ShareCode } from "./ShareCode";
import { ConnectionBar } from "./ConnectionBar";
import { InfoBar } from "./InfoBar";
import { CallButton, CallStrip, type CallControls } from "./call/CallBar";
import { useGameFeedback } from "./useGameFeedback";

interface Props extends Omit<MenuProps, "board"> {
  room: RoomState;
  /** null im lokalen Modus */
  me: string | null;
  online: Set<string> | null;
  reconnecting?: boolean;
  /** Züge, die noch unterwegs sind (online) */
  pending?: number;
  dispatch: (a: RoomAction) => void;
  /** Sprach-/Videochat (nur online und wenn eingerichtet) */
  call?: CallControls;
}

/** Gemeinsamer Rahmen für lokales und Online-Spiel: Kopfzeile, Lobby oder das Spielbrett des Moduls. */
export function RoomScreen(props: Props) {
  const { room, me, online, dispatch, reconnecting, code } = props;
  const mode = useViewMode();
  const ui = getGameUI(room.gameId);
  const info = getGame(room.gameId).info;
  const isHost = me === null || me === room.hostId;
  const hostTools = me === null || (isHost && !!room.hostTools);
  const playing = room.phase === "playing" && room.game !== null;
  const feedback = useGameFeedback(room, me);

  const board: BoardProps | null = playing
    ? { room, game: room.game, me, online, isHost, hostTools, canAct: canPlayTurn(room, me), mode, act: feedback((action) => dispatch({ type: "game", action: action as never })), dispatch }
    : null;
  const { Board, HeaderExtra, Icon } = ui;

  return (
    <div className={cn("mx-auto flex max-w-xl flex-col px-4", playing ? "h-dvh-safe overflow-clip" : "min-h-dvh-safe")}>
      <header className="flex h-14 shrink-0 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile><Icon className="size-6" /></IconTile>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-lg font-bold tracking-tight">{info.name}</div>
            {code && <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">{code}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {board && HeaderExtra && <HeaderExtra {...board} />}
          {props.call && <CallButton call={props.call} />}
          <MenuSheet {...props} isHost={isHost} board={board} />
        </div>
      </header>

      {props.call && <CallStrip call={props.call} players={room.players} me={me} />}
      {code && <ConnectionBar reconnecting={!!reconnecting} pending={props.pending ?? 0} />}
      <StuckBar {...props} isHost={isHost} />
      {board && (ui.log || ui.overview) && <InfoBar ui={ui as GameUI} board={board} />}
      {board ? <Board key={room.round} {...board} /> : <Lobby {...props} isHost={isHost} />}
    </div>
  );
}

function Lobby({ room, me, online, code, dispatch, onAddLocal, isHost }: Props & { isHost: boolean }) {
  // Frisch erstellter Raum: der Host wählt zuerst das Spiel
  const [pick, setPick] = useState(() => {
    if (!code || !isHost) return false;
    try { const v = sessionStorage.getItem(pickGameKey(code)); sessionStorage.removeItem(pickGameKey(code)); return v === "1"; } catch { return false; }
  });
  const config = useSiteConfig();
  const gameIds = GAME_IDS.filter((id) => !config || accessFor(config, id) !== "off");
  const locked = (id: string) => !!config && accessFor(config, id) === "code" && !savedAccess();
  useEffect(() => { if (code && isHost) try { localStorage.setItem(LAST_GAME_KEY, room.gameId); } catch { /* egal */ } }, [code, isHost, room.gameId]);
  const info = getGame(room.gameId).info;
  const { Icon } = getGameUI(room.gameId);
  const n = room.players.length;
  const limits = playerLimits(room);
  const countOk = n >= limits.min && n <= limits.max;
  const range = limits.min === limits.max ? `${limits.min}` : `${limits.min}–${limits.max}`;

  return (
    <section className="flex flex-1 flex-col pt-1">
      <button type="button" disabled={!isHost || gameIds.length < 2} onClick={() => setPick(true)}
        className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default">
        <IconTile className="size-11"><Icon className="size-7" /></IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Gespielt wird</span>
          <span className="block font-semibold">{info.name} <span className="font-normal text-muted-foreground">· {range} Spieler</span></span>
          {limits.note && <span className="block text-xs text-muted-foreground">{limits.note}</span>}
        </span>
        {isHost && gameIds.length > 1 && <span className="flex items-center text-sm font-semibold text-primary">Wechseln<ChevronRight className="size-4" /></span>}
      </button>
      {code && <div className="mt-2.5"><ShareCode code={code} gameName={info.name} /></div>}

      <h2 className="mt-5 mb-0.5 px-1 font-semibold">Mitspieler <span className="font-normal text-muted-foreground">· {n}</span></h2>
      <p className="mb-2.5 px-1 text-sm text-muted-foreground">
        {code ? "Link schicken und PIN sagen. Die Reihenfolge ist die Zugreihenfolge." : "Die Reihenfolge ist die Zugreihenfolge."}
      </p>
      <PlayerManager room={room} me={me} online={online} editable={isHost} dispatch={dispatch} onAddLocal={onAddLocal} />
      <SettingsPanel room={room} editable={isHost} online={!!code} dispatch={dispatch} className="mt-5" />
      <div className="min-h-4 flex-1" />
      {/* Start bleibt immer sichtbar unten */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-background/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        {isHost ? (
          <>
            <Button size="lg" className="w-full" disabled={!countOk} onClick={() => dispatch({ type: "start" })}>Spiel starten</Button>
            {!countOk && <p className="mt-1.5 text-center text-sm text-muted-foreground">{info.name} braucht {range} Spieler{limits.note ? ` (${limits.note})` : ""} – gerade {n}.</p>}
          </>
        ) : (
          <p className="glass rounded-xl py-3.5 text-center text-muted-foreground">Warte, bis der Host das Spiel startet …</p>
        )}
      </div>

      <Sheet open={pick} onOpenChange={setPick}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Was spielt ihr?</SheetTitle>
            <SheetDescription>Alle bleiben im Raum – das Spiel kannst du jederzeit in der Lobby wechseln.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 overflow-y-auto px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {gameIds.map((id) => {
              const g = getGame(id).info;
              const GIcon = getGameUI(id).Icon;
              return (
                <button key={id} type="button" onClick={() => { dispatch({ type: "selectGame", gameId: id }); setPick(false); }}
                  className={cn("flex items-center gap-3 rounded-2xl p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring", id === room.gameId ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
                  <IconTile className="size-11"><GIcon className="size-7" /></IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{g.name}{locked(id) && <Lock className="ml-1 inline size-3.5 align-[-1px] text-muted-foreground" aria-label="mit Zugangscode" />}</span>
                    <span className="block text-sm text-muted-foreground">{g.category} · {g.minPlayers}–{g.maxPlayers} Spieler · {g.duration}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

/**
 * Damit nichts hängen bleibt: Ist der Host offline, kann jemand anderes übernehmen.
 * Ist der Spieler am Zug offline, kann der Host seinen Zug überspringen.
 */
function StuckBar({ room, online, dispatch, onClaimHost, isHost }: Props & { isHost: boolean }) {
  if (!online) return null;
  const host = room.players.find((p) => p.id === room.hostId);
  if (!isHost && host && !online.has(host.id) && onClaimHost) {
    return (
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-ice/15 px-3 py-2 text-sm" role="status">
        <span><b>{host.name}</b> (Host) ist offline.</span>
        <Button size="sm" variant="ice" onClick={onClaimHost}>Host übernehmen</Button>
      </div>
    );
  }
  const curId = currentPlayerId(room);
  const cur = room.players.find((p) => p.id === curId);
  const label = isHost ? skipLabel(room) : null;
  if (isHost && cur && !online.has(cur.id) && label) {
    return (
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-ice/15 px-3 py-2 text-sm" role="status">
        <span><b>{cur.name}</b> ist offline.</span>
        <Button size="sm" variant="ice" onClick={() => dispatch({ type: "skip" })}>Überspringen</Button>
      </div>
    );
  }
  return null;
}
