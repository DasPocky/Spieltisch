import { withBase } from "@shared/platform/base";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useVoiceNames } from "./realVoice";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, Send, SlidersHorizontal, Smartphone, MessagesSquare, Star } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { canPlayTurn, currentPlayerId, playerLimits, roomGame, skipLabel, type RoomAction, type RoomState } from "@shared/platform/room";
import { tableModel } from "./table/model";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gameIcon, getGameUI, loadGameUI } from "@/games";
import type { BoardProps, GameUI } from "@/games/types";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { pickGameKey } from "@/lib/createRoom";
import { takeGamePick } from "@/lib/pickGame";
import { LAST_GAME_KEY } from "@/lib/storage";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { savedAccess, siteConfigNow, useSiteConfig } from "@/hooks/useSiteConfig";
import { accessFor, orderGames } from "@shared/platform/access";
import { GAME_CATEGORIES } from "@shared/platform/types";
import { IconTile } from "./Logo";
import { filterGames, GameSearch, NoGames, NO_FILTER } from "./GameSearch";
import { Leave, MenuSheet, type MenuProps } from "./MenuSheet";
import { PlayerManager, type GroupPick } from "./PlayerManager";
import { Avatar, AvatarContext, roomAvatars } from "./Avatar";
import { loadGroup, activeGroupCode, useActiveGroup } from "@/lib/group";
import { SettingsPanel, settingsSummary } from "./SettingsPanel";
import { Collapsible } from "./PlayersHistory";
import { ShareCode } from "./ShareCode";
import { NavRow } from "./NavRow";
import { ConnectionBar } from "./ConnectionBar";
import { InfoBar } from "./InfoBar";
import { CallButton, CallContext, CallInvite, CallStrip, type CallControls } from "./call/CallBar";
import { ChatButton, ChatContext, ChatPanel, type ChatControls } from "./chat/Chat";
import { Meet } from "./chat/Meet";
import { useGameFeedback } from "./useGameFeedback";
import { RoomHints } from "@/lib/prefs";
import { EveningContext, EveningLine } from "./Evening";
import { KnockBar, type KnockEntry } from "./KnockBar";
import { UpdateBar, UpdatedNote, useRoomUpdateGate } from "./UpdateBar";
import { setDeskPrivate, setDeskView, useDesk, useDeskPrivate } from "./desk/desk";
import { PairButton } from "./desk/PairSheet";
import { isCompanion } from "@/hooks/useRoom";

/** Tisch am Rechner (3D) – erst laden, wenn er gebraucht wird */
const DeskStage = lazy(() => import("./desk/DeskStage"));

interface Props extends Omit<MenuProps, "board" | "onAddLocal"> {
  /** Lokal: Spieler hinzufügen – optional aus der aktiven Gruppe */
  onAddLocal?: (name: string, from?: GroupPick, bot?: boolean) => void;
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
  /** Text-Chat (nur online) */
  chat?: ChatControls;
  /** Wer gerade anklopft (online, Einlass mit Anklopfen) */
  knocks?: KnockEntry[];
  onKnock?: (id: string, decision: "admit" | "deny" | "wait") => void;
  /** Begleit-Handy koppeln (online, am Rechner) */
  onPair?: () => void;
  /** Eigenes Foto (online) */
  onPhoto?: (data: string | null) => void;
  pairing?: { code: string; until: number } | null;
  /** Das Begleit-Handy dieses Spielers ist verbunden (online, am Rechner) */
  paired?: boolean;
}

/** Gemeinsamer Rahmen für lokales und Online-Spiel: Kopfzeile, Lobby oder das Spielbrett des Moduls. */
export function RoomScreen(props: Props) {
  const { room, me, online, dispatch, reconnecting, code } = props;
  const mode = useViewMode();
  const ui = getGameUI(room.gameId, room.phase === "playing" ? room.gameVersion : undefined);
  const info = getGame(room.gameId).info;
  const isHost = me === null || me === room.hostId;
  const hostTools = me === null || (isHost && !!room.hostTools);
  const playing = room.phase === "playing" && room.game !== null;
  // Mitten in der Partie dazugekommen: wartet auf die nächste Partie
  const benched = playing && me !== null && !!room.bench?.some((p) => p.id === me);
  const feedback = useGameFeedback(room, me);
  // Echte Stimme: Namen der Mitspieler sind eigene Bausteine
  useVoiceNames(room.players);
  useRoomUpdateGate(room, me);

  // Am Rechner: Partie am Tisch aus eigener Sicht (Spiele mit Spielweise „Am Rechner“, großer Bildschirm)
  const desk = useDesk(room, me);
  // Nur solange die Partie läuft und das Spiel ein Tischbild hat (z. B. nicht mit echten Karten); Ergebnis wieder klassisch
  const atTable = desk.on && !benched && !!room.game && !roomGame(room).isOver(room.game) && tableModel(room) !== null;
  // Private Hand: nur solange das Begleit-Handy verbunden ist – sonst liegen die Karten wieder hier (nichts bleibt hängen)
  const wantPrivate = useDeskPrivate();
  const handOnPhone = atTable && !!props.paired && wantPrivate;
  const board: BoardProps | null = playing && !benched
    ? { room, game: room.game, me, online, isHost, hostTools, canAct: canPlayTurn(room, me), mode, act: feedback((action) => dispatch({ type: "game", action: action as never })), dispatch, desk: atTable }
    : null;
  const { Board, HeaderExtra, Icon } = ui;
  // Im Spiel: Spieler entfernen (z. B. wer gegangen ist) – lokal auch hinzufügen, wenn das Spiel das erlaubt
  const manage = board && isHost ? (
    <Collapsible title="Spieler verwalten">
      <PlayerManager room={room} me={me} online={online} editable dispatch={dispatch} onAddLocal={props.onAddLocal} />
    </Collapsible>
  ) : undefined;

  const avatars = useMemo(() => roomAvatars(room), [room.players, room.bench, room.avatars]);
  return (
    <AvatarContext.Provider value={avatars}>
    <ChatContext.Provider value={props.chat ?? null}>
    <CallContext.Provider value={props.call ? { call: props.call, me } : null}>
    <EveningContext.Provider value={{ room, isHost, dispatch }}>
    <div className={cn("mx-auto flex max-w-xl flex-col px-4", playing && ui.wide && "lg:max-w-6xl", atTable && "max-w-none lg:px-6", playing ? "h-dvh-safe overflow-clip" : "min-h-dvh-safe")}>
      <header className="room-head flex h-14 shrink-0 items-center justify-between">
        {playing ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
              <div className="truncate text-lg font-bold tracking-tight">{code && room.meet ? "Treffpunkt" : "Lobby"}</div>
              <div className="truncate text-xs text-muted-foreground">{code ? <>{room.access?.name ? `${room.access.name} · ` : "Raum "}<span className="font-semibold tracking-[0.18em]">{code}</span></> : "Ein Handy für alle"}</div>
            </div>
          </div>
        )}
        <div className="room-tools flex shrink-0 items-center gap-1.5">
          {code && props.onPair && me && !isCompanion(code) && <PairButton code={code} onPair={props.onPair} pairing={props.pairing ?? null} />}
          {desk.possible && (
            <Button variant="secondary" size="sm" className="hidden lg:inline-flex" data-testid="desk-toggle" onClick={() => setDeskView(desk.on ? "classic" : "table")}>
              {desk.on ? "Klassische Ansicht" : "Am Tisch spielen"}
            </Button>
          )}
          {atTable && props.paired && (
            <Button variant="secondary" size="sm" className="hidden lg:inline-flex" data-testid="desk-private" onClick={() => setDeskPrivate(!wantPrivate)}>
              {handOnPhone ? "Karten hier zeigen" : "Karten nur am Handy"}
            </Button>
          )}
          {board && HeaderExtra && <HeaderExtra {...board} />}
          {props.chat && code && <ChatButton code={code} chat={props.chat} players={room.players} me={me} />}
          {props.call && <CallButton call={props.call} />}
          <MenuSheet {...props} isHost={isHost} board={board} manage={manage} />
        </div>
      </header>

      {props.call && <CallStrip call={props.call} players={room.players} me={me} compact={!!board || (!!code && !!room.meet)} />}
      {code && <ConnectionBar reconnecting={!!reconnecting} pending={props.pending ?? 0} />}
      <StuckBar {...props} isHost={isHost} />
      <UpdateBar playing={playing} />
      {code && isCompanion(code) && (
        <div className="mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-ice/12 px-3 py-2 text-sm" role="status" data-testid="companion-note">
          <Smartphone className="size-4 shrink-0" /><span>Gekoppelt mit deinem Rechner – hier: Kamera, Mikro, Chat und deine Karten.</span>
        </div>
      )}
      {props.knocks && props.onKnock && (
        <KnockBar knocks={props.knocks} isHost={isHost} hostOnline={!!room.hostId && !!online?.has(room.hostId)}
          hostName={room.players.find((p) => p.id === room.hostId)?.name} onAnswer={props.onKnock} />
      )}
      {board && (ui.log || ui.overview) && <InfoBar ui={ui as GameUI} board={board} manage={manage} />}
      <RoomHints.Provider value={!room.noHints}>{board && atTable && me ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
          <Suspense fallback={<div className="table-room min-h-0 flex-1 rounded-3xl" />}><DeskStage room={room} online={online ?? new Set()} me={me} /></Suspense>
          {handOnPhone ? (
            <div className="glass mx-auto flex w-full max-w-xl shrink-0 items-center gap-3 rounded-2xl px-4 py-3" role="status" data-testid="desk-hand-private">
              <Smartphone className="size-5 shrink-0 text-primary" />
              <span className="text-sm">Deine Karten liegen auf deinem Handy – hier sehen alle nur den Tisch.</span>
            </div>
          ) : <div className="mx-auto flex w-full max-w-4xl shrink-0 flex-col" data-testid="desk-hand"><Board key={room.round} {...board} /></div>}
        </div>
      ) : board ? <Board key={room.round} {...board} /> : benched ? <BenchWait room={room} me={me} chat={props.chat} /> : <Lobby {...props} isHost={isHost} />}</RoomHints.Provider>
    </div>
    </EveningContext.Provider>
    </CallContext.Provider>
    </ChatContext.Provider>
    </AvatarContext.Provider>
  );
}

/** Mitten in der Partie beigetreten: zuschauen, mitreden – und ab der nächsten Partie mitspielen */
function BenchWait({ room, me, chat }: { room: RoomState; me: string | null; chat?: ChatControls }) {
  const info = getGame(room.gameId).info;
  const cur = currentPlayerId(room);
  return (
    <section className={cn("flex flex-1 flex-col items-center gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center", chat ? "min-h-0 pt-2" : "justify-center")} data-testid="bench-wait">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Du schaust zu</h2>
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
      {chat && <ChatPanel chat={chat} players={[...room.players, ...(room.bench ?? [])]} me={me} className="glass min-h-40 w-full flex-1 rounded-2xl p-2.5 text-left" />}
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
    const url = `${location.origin}${withBase(`/r/${code}`)}`;
    try {
      const text = `🎲 ${gameName} im Spieltisch – kommt rein! Raumcode ${code}, die PIN gibt's vom Host.`;
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

/**
 * Jeder Online-Raum ist zugleich Treffpunkt: Ohne Spiel füllen Video und Chat den Raum,
 * „Spiel wählen“ führt mit dem gewählten Spiel in die Lobby. Gespielt werden muss nicht – geredet auch nicht.
 */
function Lobby(props: Props & { isHost: boolean }) {
  const { room, me, online, code, dispatch, isHost } = props;
  const [local, setLocal] = useState(false);
  const [pick, setPick] = useState(false);
  const config = useSiteConfig();
  if (code && room.meet && !local) {
    const gameIds = orderGames(GAME_IDS, config?.order ?? []).filter((id) => !config || accessFor(config, id) !== "off");
    return (
      <>
        <Meet room={room} me={me} online={online} call={props.call} chat={props.chat}
          playLabel={isHost ? "Spiel wählen" : "Zur Spiel-Lobby"} onPlay={() => (isHost ? setPick(true) : setLocal(true))} onPhoto={props.onPhoto} />
        {isHost && (
          <GamePicker open={pick} onOpenChange={setPick} gameIds={gameIds} current={room.gameId} online players={room.players.length}
            onPick={(id) => {
              setPick(false);
              void loadGameUI(id).then(() => { dispatch({ type: "selectGame", gameId: id }); dispatch({ type: "setMeet", on: false }); }, () => toast("Das Spiel lädt gerade nicht – kurz Netz prüfen."));
            }} />
        )}
      </>
    );
  }
  return <GameLobby {...props} />;
}

function GameLobby({ room, me, online, code, dispatch, onAddLocal, onPhoto, isHost, call }: Props & { isHost: boolean }) {
  // Frisch erstellter Raum oder „Spiel wechseln“: der Host wählt zuerst das Spiel
  const [pick, setPick] = useState(() => {
    if (takeGamePick() && isHost) return true;
    if (!code || !isHost) return false;
    try { const v = sessionStorage.getItem(pickGameKey(code)); sessionStorage.removeItem(pickGameKey(code)); return v === "1"; } catch { return false; }
  });
  const [settings, setSettings] = useState(false);
  const config = useSiteConfig();
  const gameIds = orderGames(GAME_IDS, config?.order ?? []).filter((id) => !config || accessFor(config, id) !== "off");
  useEffect(() => { if (code && isHost) try { localStorage.setItem(LAST_GAME_KEY, room.gameId); } catch { /* egal */ } }, [code, isHost, room.gameId]);
  // Aktive Gruppe frisch holen (neue Mitglieder, Avatare)
  useEffect(() => { const g = activeGroupCode(); if (g) void loadGroup(g); }, []);
  const info = getGame(room.gameId).info;
  const Icon = gameIcon(room.gameId);
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
      <UpdatedNote room={room} />
      {code && <div className="mt-2"><ShareCode code={code} gameName={info.name} /></div>}
      {code && <GroupShare room={room} code={code} gameName={info.name} />}
      {call && <CallInvite call={call} />}
      <EveningLine className="mt-2" beside={code && isHost ? (
        <Button variant="outline" size="sm" onClick={() => dispatch({ type: "setMeet", on: true })} className="w-full min-w-0" data-testid="to-meet">
          <MessagesSquare className="size-4 text-primary" />Zum Treffpunkt
        </Button>
      ) : undefined} />

      <h2 className="mt-4 mb-0.5 px-1 font-semibold">Mitspieler <span className="font-normal text-muted-foreground">· {n}</span></h2>
      <p className="mb-2 px-1 text-sm text-muted-foreground">
        Gespielt wird in dieser Reihenfolge.
      </p>
      <PlayerManager room={room} me={me} online={online} editable={isHost} dispatch={dispatch} onAddLocal={onAddLocal} onPhoto={onPhoto} />

      {/* Einstellungen als eine Zeile – alles Weitere im Sheet */}
      <NavRow icon={SlidersHorizontal} onClick={() => setSettings(true)} data-testid="settings-summary" className="mt-3"
        title="Einstellungen" sub={settingsSummary(room, !!code)} />

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

      <GamePicker open={pick} onOpenChange={setPick} gameIds={gameIds} current={room.gameId} online={!!code} players={room.players.length}
        onPick={(id) => { setPick(false); void loadGameUI(id).then(() => dispatch({ type: "selectGame", gameId: id }), () => toast("Das Spiel lädt gerade nicht – kurz Netz prüfen.")); }} />

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

const FAV_GROUP = "Gemerkt";

/** „Was spielt ihr?“ – Spielauswahl der Lobby, lokal wie online */
function GamePicker({ open, onOpenChange, gameIds, current, online, players, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; gameIds: string[]; current: string; online: boolean; players: number; onPick: (id: string) => void;
}) {
  const locked = (id: string) => { const c = siteConfigNow(); return !!c && accessFor(c, id) === "code" && !savedAccess(); };
  const [filter, setFilter] = useState(NO_FILTER);
  // Jedes Öffnen beginnt ohne Suche – auch wenn das Blatt nach der Wahl von außen geschlossen wurde
  useEffect(() => { if (open) setFilter(NO_FILTER); }, [open]);
  const shown = filterGames(gameIds, filter, players);
  const favs = useFavorites();
  // Gemerkte Spiele nur in ihrer eigenen Gruppe, nicht doppelt weiter unten
  const groups: [string, string[]][] = [
    [FAV_GROUP, shown.filter((id) => favs.includes(id))],
    ...GAME_CATEGORIES.map((cat): [string, string[]] => [cat, shown.filter((id) => !favs.includes(id) && getGame(id).info.category === cat)]),
  ].filter(([, ids]) => ids.length > 0) as [string, string[]][];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Was spielt ihr?</SheetTitle>
          <SheetDescription>{online ? "Alle bleiben im Raum – das Spiel kannst du jederzeit in der Lobby wechseln." : "Die Spieler bleiben – das Spiel kannst du jederzeit in der Lobby wechseln."}</SheetDescription>
        </SheetHeader>
        <GameSearch value={filter} onChange={setFilter} players={players} className="shrink-0 px-5 pt-1" />
        <div className="overflow-y-auto px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="pick-list">
          {!shown.length && <NoGames onReset={() => setFilter(NO_FILTER)} />}
          {/* Gemerkte Spiele oben, der Rest nach Art gruppiert – bei vielen Spielen findet man so schneller */}
          {groups.map(([title, ids]) => (
            <section key={title} aria-label={title} className="mt-3 grid gap-1.5" data-testid={title === FAV_GROUP ? "pick-favorites" : undefined}>
              <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
              {ids.map((id) => {
                const g = getGame(id).info;
                const GIcon = gameIcon(id);
                const fav = favs.includes(id);
                return (
                  <div key={id} className="flex items-stretch gap-1.5">
                    <button type="button" onClick={() => onPick(id)} aria-current={id === current || undefined} data-testid={`pick-${id}`}
                      className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring", id === current ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
                      <IconTile className="size-9"><GIcon className="size-6" /></IconTile>
                      <span className="min-w-0 flex-1">
                        <span className="block leading-tight font-semibold">{g.name}{siteConfigNow()?.featured.includes(id) && <span className="ml-1.5 rounded-full bg-primary/14 px-1.5 py-px align-[1px] text-[0.65rem] font-bold text-primary">NEU</span>}{locked(id) && <Lock className="ml-1 inline size-3.5 align-[-1px] text-muted-foreground" aria-label="mit Zugangscode" />}</span>
                        <span className="block text-xs text-muted-foreground">{g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`} Spieler · {g.duration}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => toggleFavorite(id)} aria-pressed={fav} aria-label={fav ? `${g.name} nicht mehr merken` : `${g.name} merken`} data-testid={`fav-${id}`}
                      className="grid w-11 shrink-0 place-items-center rounded-2xl text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                      <Star className={cn("size-5", fav && "fill-primary text-primary")} />
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
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
