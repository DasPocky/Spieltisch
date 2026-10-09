import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, Send, SlidersHorizontal } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { canPlayTurn, currentPlayerId, playerLimits, skipLabel, type RoomAction, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getGameUI } from "@/games";
import type { BoardProps, GameUI } from "@/games/types";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { pickGameKey } from "@/lib/createRoom";
import { takeGamePick } from "@/lib/pickGame";
import { LAST_GAME_KEY } from "@/lib/storage";
import { savedAccess, siteConfigNow, useSiteConfig } from "@/hooks/useSiteConfig";
import { accessFor } from "@shared/platform/access";
import { GAME_CATEGORIES } from "@shared/platform/types";
import { IconTile } from "./Logo";
import { Leave, MenuSheet, type MenuProps } from "./MenuSheet";
import { PlayerManager, type GroupPick } from "./PlayerManager";
import { Avatar, AvatarContext } from "./Avatar";
import { loadGroup, activeGroupCode, useActiveGroup } from "@/lib/group";
import { SettingsPanel, settingsSummary } from "./SettingsPanel";
import { Collapsible } from "./PlayersHistory";
import { ShareCode } from "./ShareCode";
import { ConnectionBar } from "./ConnectionBar";
import { InfoBar } from "./InfoBar";
import { CallButton, CallInvite, CallStrip, type CallControls } from "./call/CallBar";
import { useGameFeedback } from "./useGameFeedback";
import { RoomHints } from "@/lib/prefs";
import { EveningContext, EveningLine } from "./Evening";

interface Props extends Omit<MenuProps, "board" | "onAddLocal"> {
  /** Lokal: Spieler hinzufügen – optional aus der aktiven Gruppe */
  onAddLocal?: (name: string, from?: GroupPick) => void;
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
  // Mitten in der Partie dazugekommen: wartet auf die nächste Partie
  const benched = playing && me !== null && !!room.bench?.some((p) => p.id === me);
  const feedback = useGameFeedback(room, me);

  const board: BoardProps | null = playing && !benched
    ? { room, game: room.game, me, online, isHost, hostTools, canAct: canPlayTurn(room, me), mode, act: feedback((action) => dispatch({ type: "game", action: action as never })), dispatch }
    : null;
  const { Board, HeaderExtra, Icon } = ui;
  // Im Spiel: Spieler entfernen (z. B. wer gegangen ist) – lokal auch hinzufügen, wenn das Spiel das erlaubt
  const manage = board && isHost ? (
    <Collapsible title="Spieler verwalten">
      <PlayerManager room={room} me={me} online={online} editable dispatch={dispatch} onAddLocal={props.onAddLocal} />
    </Collapsible>
  ) : undefined;

  return (
    <AvatarContext.Provider value={room.avatars}>
    <EveningContext.Provider value={{ room, isHost, dispatch }}>
    <div className={cn("mx-auto flex max-w-xl flex-col px-4", playing ? "h-dvh-safe overflow-clip" : "min-h-dvh-safe")}>
      <header className="flex h-14 shrink-0 items-center justify-between">
        {playing ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <IconTile><Icon className="size-6" /></IconTile>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-lg font-bold tracking-tight">{info.name}</div>
              {code && <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">{code}</div>}
            </div>
          </div>
        ) : (
          // Lobby: zurück zur Startseite (online mit Rückfrage – wie „Raum verlassen“)
          <div className="flex min-w-0 items-center gap-1">
            <Leave code={code} isHost={isHost} onLeave={props.onLeave}>
              <Button variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label={code ? "Raum verlassen" : "Zur Startseite"}><ChevronLeft /></Button>
            </Leave>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-lg font-bold tracking-tight">Lobby</div>
              <div className="truncate text-xs text-muted-foreground">{code ? <>Raum <span className="font-semibold tracking-[0.18em]">{code}</span></> : "Ein Handy für alle"}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          {board && HeaderExtra && <HeaderExtra {...board} />}
          {props.call && <CallButton call={props.call} />}
          <MenuSheet {...props} isHost={isHost} board={board} manage={manage} />
        </div>
      </header>

      {props.call && <CallStrip call={props.call} players={room.players} me={me} />}
      {code && <ConnectionBar reconnecting={!!reconnecting} pending={props.pending ?? 0} />}
      <StuckBar {...props} isHost={isHost} />
      {board && (ui.log || ui.overview) && <InfoBar ui={ui as GameUI} board={board} manage={manage} />}
      <RoomHints.Provider value={!room.noHints}>{board ? <Board key={room.round} {...board} /> : benched ? <BenchWait room={room} me={me} /> : <Lobby {...props} isHost={isHost} />}</RoomHints.Provider>
    </div>
    </EveningContext.Provider>
    </AvatarContext.Provider>
  );
}

/** Mitten in der Partie beigetreten: kurz erklären, wer spielt und dass es mit „Nochmal“ losgeht */
function BenchWait({ room, me }: { room: RoomState; me: string | null }) {
  const info = getGame(room.gameId).info;
  const cur = currentPlayerId(room);
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center" data-testid="bench-wait">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Du bist dabei!</h2>
        <p className="mt-1 text-muted-foreground">{info.name} läuft gerade. Du spielst ab der nächsten Partie mit – sobald der Host „Nochmal“ wählt.</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-1.5">
        {room.players.map((p) => (
          <li key={p.id} className={cn("glass flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-semibold", p.id === cur && "ring-2 ring-primary")}>
            <Avatar avatar={room.avatars?.[p.id]} name={p.name} className="size-6" />{p.name}
          </li>
        ))}
        {room.bench?.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-semibold text-muted-foreground ring-1 ring-dashed ring-border">
            <Avatar avatar={room.avatars?.[p.id]} name={p.name} className="size-6" />{p.name}{p.id === me && " (du)"}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Online-Lobby: Raum an die aktive Gruppe schicken und zeigen, wer aus der Gruppe schon da ist */
function GroupShare({ room, code, gameName }: { room: RoomState; code: string; gameName: string }) {
  const group = useActiveGroup();
  if (!group) return null;
  const here = new Set(Object.values(room.members ?? {}));
  const joined = group.members.filter((m) => here.has(m.id));
  const share = async () => {
    const url = `${location.origin}/r/${code}`;
    try {
      const text = `Spiel ${gameName} mit – Raum ${code}`;
      if (navigator.share) { await navigator.share({ title: group.name, text, url }); return; }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      toast("Einladung kopiert – jetzt in eure Gruppe einfügen");
    } catch { /* abgebrochen */ }
  };
  return (
    <div className="glass mt-2 flex items-center gap-3 rounded-2xl py-2.5 pr-2.5 pl-4" data-testid="group-share">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{group.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {joined.length > 0 && (
            <span className="flex -space-x-1.5">
              {joined.slice(0, 4).map((m) => <Avatar key={m.id} avatar={m.avatar} className="size-5 text-[0.7rem] ring-2 ring-background" />)}
            </span>
          )}
          <span className="truncate">{joined.length} von {group.members.length} dabei</span>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="shrink-0" onClick={share}><Send />An Gruppe senden</Button>
    </div>
  );
}

function Lobby({ room, me, online, code, dispatch, onAddLocal, isHost, call }: Props & { isHost: boolean }) {
  // Frisch erstellter Raum oder „Spiel wechseln“: der Host wählt zuerst das Spiel
  const [pick, setPick] = useState(() => {
    if (takeGamePick() && isHost) return true;
    if (!code || !isHost) return false;
    try { const v = sessionStorage.getItem(pickGameKey(code)); sessionStorage.removeItem(pickGameKey(code)); return v === "1"; } catch { return false; }
  });
  const [settings, setSettings] = useState(false);
  const config = useSiteConfig();
  const gameIds = GAME_IDS.filter((id) => !config || accessFor(config, id) !== "off");
  useEffect(() => { if (code && isHost) try { localStorage.setItem(LAST_GAME_KEY, room.gameId); } catch { /* egal */ } }, [code, isHost, room.gameId]);
  // Aktive Gruppe frisch holen (neue Mitglieder, Avatare)
  useEffect(() => { const g = activeGroupCode(); if (g) void loadGroup(g); }, []);
  const info = getGame(room.gameId).info;
  const { Icon } = getGameUI(room.gameId);
  const n = room.players.length;
  const limits = playerLimits(room);
  const countOk = n >= limits.min && n <= limits.max;
  const range = limits.min === limits.max ? `${limits.min}` : `${limits.min}–${limits.max}`;
  const canPick = isHost && gameIds.length > 1;

  return (
    <section className="flex flex-1 flex-col pt-1">
      <button type="button" disabled={!canPick} onClick={() => setPick(true)} data-testid="game-card"
        className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default">
        <IconTile className="size-11"><Icon className="size-7" /></IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Gespielt wird</span>
          <span className="block font-semibold">{info.name} <span className="font-normal text-muted-foreground">· {range} Spieler</span></span>
          {limits.note && <span className="block text-xs text-muted-foreground">{limits.note}</span>}
        </span>
        {canPick && <span className="flex items-center text-sm font-semibold text-primary">Wechseln<ChevronRight className="size-4" /></span>}
      </button>
      {code && <div className="mt-2"><ShareCode code={code} gameName={info.name} /></div>}
      {code && <GroupShare room={room} code={code} gameName={info.name} />}
      {call && <CallInvite call={call} />}
      <EveningLine className="mt-2" />

      <h2 className="mt-4 mb-0.5 px-1 font-semibold">Mitspieler <span className="font-normal text-muted-foreground">· {n}</span></h2>
      <p className="mb-2 px-1 text-sm text-muted-foreground">
        {code ? "Link schicken, PIN sagen. Reihenfolge = Zugreihenfolge." : "Die Reihenfolge ist die Zugreihenfolge."}
      </p>
      <PlayerManager room={room} me={me} online={online} editable={isHost} dispatch={dispatch} onAddLocal={onAddLocal} />

      {/* Einstellungen als eine Zeile – alles Weitere im Sheet */}
      <button type="button" onClick={() => setSettings(true)} data-testid="settings-summary"
        className="glass mt-3 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring">
        <SlidersHorizontal className="size-4.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Einstellungen</span>
          <span className="block truncate text-sm text-muted-foreground">{settingsSummary(room, !!code)}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>

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

      <GamePicker open={pick} onOpenChange={setPick} gameIds={gameIds} current={room.gameId} online={!!code}
        onPick={(id) => { dispatch({ type: "selectGame", gameId: id }); setPick(false); }} />

      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Einstellungen: {info.name}</SheetTitle>
            <SheetDescription>{isHost ? "Gilt für alle in dieser Partie." : "Legt der Host fest – du kannst sie nur ansehen."}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-5 pt-3 pb-4">
            <SettingsPanel room={room} editable={isHost} online={!!code} dispatch={dispatch} title={false} />
          </div>
          <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button className="w-full" onClick={() => setSettings(false)}>Fertig</Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

/** „Was spielt ihr?“ – Spielauswahl der Lobby, lokal wie online */
function GamePicker({ open, onOpenChange, gameIds, current, online, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; gameIds: string[]; current: string; online: boolean; onPick: (id: string) => void;
}) {
  const locked = (id: string) => { const c = siteConfigNow(); return !!c && accessFor(c, id) === "code" && !savedAccess(); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Was spielt ihr?</SheetTitle>
          <SheetDescription>{online ? "Alle bleiben im Raum – das Spiel kannst du jederzeit in der Lobby wechseln." : "Die Spieler bleiben – das Spiel kannst du jederzeit in der Lobby wechseln."}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {/* Nach Art gruppiert – bei vielen Spielen findet man so schneller */}
          {GAME_CATEGORIES.map((cat) => {
            const ids = gameIds.filter((id) => getGame(id).info.category === cat);
            if (!ids.length) return null;
            return (
              <section key={cat} aria-label={cat} className="mt-3 grid gap-1.5">
                <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{cat}</h3>
                {ids.map((id) => {
                  const g = getGame(id).info;
                  const GIcon = getGameUI(id).Icon;
                  return (
                    <button key={id} type="button" onClick={() => onPick(id)} aria-current={id === current || undefined} data-testid={`pick-${id}`}
                      className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring", id === current ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
                      <IconTile className="size-9"><GIcon className="size-6" /></IconTile>
                      <span className="min-w-0 flex-1">
                        <span className="block leading-tight font-semibold">{g.name}{locked(id) && <Lock className="ml-1 inline size-3.5 align-[-1px] text-muted-foreground" aria-label="mit Zugangscode" />}</span>
                        <span className="block text-xs text-muted-foreground">{g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`} Spieler · {g.duration}</span>
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
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
