import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Camera, Expand, Loader2, LogOut, Sparkles, Tv, Video, VideoOff } from "lucide-react";
import { PIN_RE, ROOM_CODE_RE, WATCH_ID, type CallPeer, type ClientMessage, type RemoteCmd } from "@shared/platform/protocol";
import { toast } from "sonner";
import { prefs, setPref, usePrefs } from "@/lib/prefs";
import { eveningRanking, planStatus, type RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { randomInt } from "@shared/platform/random";
import { Button } from "@/components/ui/button";
import { GAME_LIST } from "@/games";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGames } from "@/hooks/useGames";
import { navigate } from "@/hooks/useRoute";
import { useWatch } from "@/hooks/useWatch";
import { postRoom } from "@/lib/createRoom";
import { defaultGame } from "@/lib/playLocal";
import { readStr, remove, tableKey, writeStr } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Avatar, roomAvatars } from "@/platform/Avatar";
import { QrCode } from "@/platform/QrCode";
import { RoomScreen } from "@/platform/RoomScreen";
import { Boundary } from "@/platform/Boundary";
import { tableModel, type TableModel } from "@/platform/table/model";
import type { SchamlosState } from "@shared/games/schamlos/logic";
import { BLANK, cardText, fillIn } from "@shared/games/schamlos/cards";
import { createTableScene, webglOk, type FeltRect, type TableScene } from "@/platform/table/scene";
import { createFlatScene } from "@/platform/table/flat";
import { createStudioScene, type StudioScene } from "@/platform/table/studio";
import { useQuality } from "@/lib/quality";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useAdminDevice } from "@/lib/admin";
import { modeAllowed } from "@shared/platform/modes";
import { SoundPanel, useTableSound } from "@/platform/table/sound";
import { HostCorner, HostPanel, readMood, useTableHost } from "@/platform/table/host";
import { FeltDice, FeltGrid } from "@/platform/table/blocks";
import { FeltPiles, FeltWords, SeatBoard } from "@/platform/table/piles";
import { CouchAdd, CouchPlayers, useCouch } from "@/platform/table/Couch";
import { enableSpatialNav } from "@/lib/spatialNav";
import { useCallReady, useCouchCam, useSeatVideos } from "@/platform/table/video";

/** Am Fernseher: mit den Pfeiltasten der Fernbedienung von Knopf zu Knopf */
const useArrowKeys = () => useEffect(() => enableSpatialNav(), []);

/** Neue PIN für einen Tisch-Raum – steht im QR-Code, abtippen muss sie niemand */
const newPin = () => String(randomInt(900000) + 100000);

/** Link zum Beitreten fürs Handy: die PIN steht hinter # und geht so nicht an den Server */
const joinLink = (code: string, pin: string) => `${location.origin}/r/${code}#pin=${pin}`;

/**
 * Großer Tisch aufbauen: neuen Raum für diesen Bildschirm öffnen oder einen laufenden Raum verbinden.
 * Der Bildschirm spielt nicht mit – er zeigt den Tisch, die Handys sind die Hände.
 */
export function TableSetup() {
  useArrowKeys();
  const { ids, locked, online } = useGames();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");

  const open = async () => {
    setBusy(true); setError(null);
    const p = newPin();
    try {
      const c = await postRoom({ pin: p, gameId: defaultGame(ids, locked), meet: true, room: { name: "Großer Tisch", visibility: "none" } });
      writeStr(tableKey(c), p);
      navigate(`/tisch/${c}`, true);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const connect = () => {
    const c = code.trim().toUpperCase();
    writeStr(tableKey(c), pin);
    navigate(`/tisch/${c}`);
  };

  return (
    <div className="table-room grid min-h-dvh place-items-center p-6" data-testid="table-setup">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <section className="paper-note flex flex-col p-7">
          <span className="flex items-center gap-2 text-sm font-bold text-[#8a6f4e]"><Tv className="size-4" />Großer Tisch</span>
          <h1 className="mt-2 text-3xl font-bold">Neuen Tisch aufbauen</h1>
          <p className="mt-2 text-[#6b5640]">Dieser Bildschirm zeigt den Tisch. Mitspielen geht mit dem Handy: QR-Code scannen, Namen eingeben, fertig.</p>
          <div className="min-h-6 flex-1" />
          <Button size="lg" className="h-13 rounded-2xl text-base" disabled={busy || !online} onClick={() => void open()} data-testid="table-new">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Tv className="size-5" />}Tisch aufbauen
          </Button>
        </section>
        <section className="paper-note p-7">
          <h2 className="text-2xl font-bold">Laufenden Raum zeigen</h2>
          <p className="mt-2 text-[#6b5640]">Ihr spielt schon? Raumcode und PIN eingeben – der Tisch erscheint hier.</p>
          <form className="mt-5 grid gap-3" onSubmit={(e) => { e.preventDefault(); connect(); }}>
            <div className="grid gap-1.5">
              <Label htmlFor="tc">Raumcode</Label>
              <Input id="tc" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))} autoComplete="off" className="bg-white tracking-[0.3em]" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tp">PIN</Label>
              <Input id="tp" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="off" className="bg-white tracking-[0.3em]" />
            </div>
            <Button type="submit" variant="secondary" size="lg" className="rounded-2xl" disabled={!ROOM_CODE_RE.test(code) || !PIN_RE.test(pin)} data-testid="table-connect">Verbinden</Button>
          </form>
        </section>
        {error && <p role="alert" className="rounded-xl bg-destructive/90 p-3 text-center font-semibold text-white md:col-span-2">{error}</p>}
        <Button variant="ghost" className="text-[#f7ecd6] md:col-span-2" onClick={() => navigate("/")}>Zur Startseite</Button>
      </div>
    </div>
  );
}

/** Ein Raum auf dem großen Bildschirm */
export function TableRoom({ code }: { code: string }) {
  useArrowKeys();
  const [pin, setPin] = useState(() => readStr(tableKey(code)));
  const [error, setError] = useState<string | null>(null);
  if (!pin) {
    return (
      <div className="table-room grid min-h-dvh place-items-center p-6">
        <form className="paper-note grid w-full max-w-sm gap-3 p-7" onSubmit={(e) => {
          e.preventDefault();
          const p = new FormData(e.currentTarget).get("pin") as string;
          if (!PIN_RE.test(p)) return;
          writeStr(tableKey(code), p); setError(null); setPin(p);
        }}>
          <h1 className="text-2xl font-bold">Raum {code} zeigen</h1>
          <Label htmlFor="tp">PIN des Raums</Label>
          <Input id="tp" name="pin" inputMode="numeric" autoComplete="off" className="bg-white tracking-[0.3em]" />
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="rounded-2xl">Verbinden</Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/tisch")}>Zurück</Button>
        </form>
      </div>
    );
  }
  return <TableLive key={pin} code={code} pin={pin} onReject={(msg) => { remove(tableKey(code)); setError(msg); setPin(null); }} />;
}

function TableLive({ code, pin, onReject }: { code: string; pin: string; onReject: (msg: string) => void }) {
  const hello = useMemo(() => ({ type: "table" as const, pin }), [pin]);
  const { state, online, status, error, remote, reacts, call, tableKey: callKey, announce } = useWatch(`/api/rooms/${code}/ws`, hello);
  useEffect(() => { if (error && /PIN/.test(error)) onReject(error); }, [error, onReject]);

  // F: Vollbild an und aus
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "f" || e.key === "F") toggleFullscreen(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  if (!state) {
    return (
      <div className="table-room grid min-h-dvh place-items-center text-center">
        {status === "closed"
          ? <div className="paper-note grid gap-3 p-7"><p className="text-lg font-semibold">{error ?? "Den Raum gibt es nicht mehr."}</p><Button onClick={() => navigate("/tisch")}>Neuen Tisch aufbauen</Button></div>
          : <Loader2 className="size-8 animate-spin" />}
      </div>
    );
  }
  return <TableView code={code} pin={pin} room={state} online={online} remote={remote} reacts={reacts} call={call} callKey={callKey} announce={announce} />;
}

type Remote = { cmd: RemoteCmd; by: string; n: number };
/** Reaktion eines Spielers (Emoji), schwebt kurz über seinem Platz */
type TableReact = { id: number; from: string; emoji: string };

/** Befehle der Fernbedienung (Handy des Hosts) ausführen und kurz zeigen, wer was gemacht hat. Gibt den Zähler für „Hand verdecken“ zurück. */
function useRemote(remote: Remote | null): number {
  const [cover, setCover] = useState(0);
  useEffect(() => {
    if (!remote) return;
    const p = prefs();
    const step = (d: number) => {
      for (const k of ["volFx", "volMusic", "volCrowd"] as const) setPref(k, Math.round(Math.min(1, Math.max(0, p[k] + d)) * 20) / 20);
      if (!p.sound && d > 0) setPref("sound", true);
    };
    const what = remote.cmd === "sound" ? (p.sound ? "Ton aus" : "Ton an") : remote.cmd === "louder" ? "Lauter" : remote.cmd === "quieter" ? "Leiser" : "Hand verdeckt";
    if (remote.cmd === "sound") setPref("sound", !p.sound);
    else if (remote.cmd === "louder") step(0.15);
    else if (remote.cmd === "quieter") step(-0.15);
    else setCover((c) => c + 1);
    toast(`${remote.by}: ${what}`, { id: "remote", duration: 2000 });
  }, [remote]);
  return cover;
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

function TableView({ code, pin, room, online, remote, reacts, call, callKey, announce }: {
  code: string; pin: string; room: RoomState; online: Set<string>; remote: Remote | null; reacts: TableReact[];
  call: Record<string, CallPeer>; callKey: string | null; announce: (m: Extract<ClientMessage, { type: "call" }>) => void;
}) {
  // Tisch-Ansicht des Spiels aus (oder Beta und kein Gerät der Verwaltung): Partie wie am Handy in der Mitte
  const config = useSiteConfig();
  const admin = useAdminDevice();
  const tableOn = modeAllowed(config?.modes, room.gameId, "table", admin);
  const model = useMemo(() => (tableOn ? tableModel(room) : null), [room, tableOn]);
  const playing = room.phase === "playing";
  const game = GAME_LIST.find((g) => g.id === room.gameId) ?? null;
  const avatars = useMemo(() => roomAvatars(room), [room]);
  const sham = playing && tableOn && room.gameId === "schamlos" ? (room.game as SchamlosState) : null;
  const fallback = playing && !model && !sham;
  const host = room.players.find((p) => p.id === room.hostId);
  const plan = planStatus(room.evening);
  const [felt, setFelt] = useState<FeltRect | null>(null);
  useTableSound(room, model);
  const [mood, setMood] = useState(readMood);
  const moderator = useTableHost(room, model, mood, game?.info.name);
  const couch = useCouch(code);
  // Hand eines Couch-Spielers offen: der Tisch rückt nach rechts
  const [handOpen, setHandOpen] = useState(false);
  const cover = useRemote(remote);
  // Videochat: Videos an den Plätzen (abschaltbar, einzeln ausblendbar) und Couch-Kamera
  const callReady = useCallReady();
  const p = usePrefs();
  const videos = useSeatVideos(code, callReady ? callKey : null, call, p.tableVideo);
  const couchCam = useCouchCam(code, callReady ? callKey : null, announce);
  // Ansicht am Fernseher: Tisch oder Bühne (Showstudio) – je Gerät gemerkt, nur mit 3D und wenn das Spiel die Bühne kann
  const [tvView, setTvView] = useState<"table" | "stage">(() => (readStr(TV_VIEW_KEY) === "stage" ? "stage" : "table"));
  const level = useQuality();
  const stagePossible = level !== "flach" && webglOk() && modeAllowed(config?.modes, room.gameId, "stage", admin) && (!playing || !!model || !!sham);
  const stage = tvView === "stage" && stagePossible;
  const pickView = (v: "table" | "stage") => { writeStr(TV_VIEW_KEY, v); setTvView(v); };
  const [hiddenVideos, setHiddenVideos] = useState<Set<string>>(new Set());
  const toggleVideo = useCallback((id: string) => setHiddenVideos((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  return (
    <div className="table-room fixed inset-0 flex overflow-hidden" data-testid="table-view">
      <main className={cn("relative min-w-0 flex-1 transition-[margin]", handOpen && "ml-[min(30rem,100vw)]")}>
        {stage ? (
          <StudioStage room={room} online={online} model={model} sham={sham} reacts={reacts} videos={videos} hiddenVideos={hiddenVideos} onToggleVideo={toggleVideo}>
            {!playing && (plan && plan.played > 0 ? <PartyBoard room={room} /> : <Lobby code={code} pin={pin} count={room.players.length} host={host?.name} plan={plan?.games} />)}
          </StudioStage>
        ) : (
          <TableStage room={room} online={online} model={fallback ? null : model} sham={sham} showSeats={!fallback} onFelt={setFelt} reacts={reacts}
            videos={videos} hiddenVideos={hiddenVideos} onToggleVideo={toggleVideo} />
        )}

        <header className="absolute top-6 left-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#3e9a92] to-[#1f5f5b] shadow-lg">{game ? <game.Icon className="size-6 text-white" /> : <Tv className="size-5 text-white" />}</span>
          <div className="drop-shadow">
            <b className="text-2xl">{playing && game ? game.info.name : "Großer Tisch"}</b>
            <div className="text-sm opacity-80">Raum {code}{model?.color ? ` · gilt: ${model.color.label}` : ""}</div>
          </div>
        </header>

        {moderator.on && <HostCorner say={moderator.say} mood={mood} />}
        {!playing && !stage && <OnFelt rect={felt}>{plan && plan.played > 0
          ? <PartyBoard room={room} />
          : <Lobby code={code} pin={pin} count={room.players.length} host={host?.name} plan={plan?.games} />}</OnFelt>}
        {fallback && <Fallback room={room} code={code} online={online} />}
      </main>

      <aside className="flex w-80 shrink-0 flex-col gap-4 border-l border-white/10 bg-black/25 p-5">
        {playing && <JoinNote code={code} pin={pin} />}
        <Scores room={room} model={model} avatars={avatars} points={sham?.scores} />
        {model && <Log lines={model.log} />}
        <div className="mt-auto" />
        <CouchPlayers code={code} pin={pin} room={room} couch={couch} onOpen={setHandOpen} cover={cover} />
        <CouchAdd onAdd={couch.add} full={couch.list.length >= 6} />
        {stagePossible && <ViewPanel view={stage ? "stage" : "table"} onView={pickView} />}
        {callReady && <VideoPanel cam={couchCam} />}
        <HostPanel mood={mood} onMood={setMood} />
        <SoundPanel />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-[#f7ecd6] hover:bg-white/10" onClick={toggleFullscreen}><Expand className="size-4" />Vollbild</Button>
          <Button variant="ghost" className="flex-1 text-[#f7ecd6] hover:bg-white/10" onClick={() => { remove(tableKey(code)); navigate("/"); }}><LogOut className="size-4" />Verlassen</Button>
        </div>
      </aside>
    </div>
  );
}

/**
 * Die Tischfläche: Tisch (3D oder flach), Plätze am Rand mit Bild und Kartenzahl, Meldungen oben.
 * Am Fernseher für alle (`me` fehlt) – oder am Rechner aus eigener Sicht: der eigene Platz ist vorn,
 * die eigene Hand liegt nicht verdeckt auf dem Tisch (sie steht offen darunter).
 */
export function TableStage({ room, online, model, sham, me, showSeats = true, onFelt, reacts = [], videos, hiddenVideos, onToggleVideo, flat }: {
  room: RoomState; online: Set<string>; model: TableModel | null; sham?: SchamlosState | null; me?: string | null; showSeats?: boolean; onFelt?: (f: FeltRect) => void; reacts?: TableReact[];
  /** Videos der Mitspieler (Kamera an) – erscheinen statt des Bilds am Platz */
  videos?: Record<string, MediaStream>; hiddenVideos?: Set<string>; onToggleVideo?: (id: string) => void;
  /** immer der flache Tisch (z. B. auf der Leinwand der Bühne) */
  flat?: boolean;
}) {
  const avatars = useMemo(() => roomAvatars(room), [room]);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [felt, setFelt] = useState<FeltRect | null>(null);
  // Nur bei echter Änderung neu setzen – sonst zeichnet sich die Seite endlos neu
  const onSeats = useCallback((next: { x: number; y: number }[], f: FeltRect) => {
    const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
    setPoints((prev) => (prev.length === next.length && prev.every((p, i) => near(p.x, next[i].x) && near(p.y, next[i].y)) ? prev : next));
    setFelt((prev) => (prev && near(prev.x, f.x) && near(prev.y, f.y) && near(prev.w, f.w) && near(prev.h, f.h) ? prev : f));
    onFelt?.(f);
  }, [onFelt]);
  // Eigene Sicht: der eigene Platz vorn in der Mitte, die anderen der Reihe nach
  const players = useMemo(() => {
    const i = me ? room.players.findIndex((p) => p.id === me) : -1;
    return i > 0 ? [...room.players.slice(i), ...room.players.slice(0, i)] : room.players;
  }, [room.players, me]);
  const seats = players.map((p) => p.id);
  const shown = useMemo(() => (model && me ? { ...model, counts: { ...model.counts, [me]: 0 } } : model), [model, me]);
  // In 3D liegen Stapel, Auslagen und Wortkarten echt auf dem Tisch – die HTML-Fassung bleibt nur für Vorleseprogramme
  const [real, setReal] = useState(false);

  return (
    <>
      <TableCanvas model={shown} seats={seats} onSeats={onSeats} forceFlat={flat} onReal={setReal} />
      {showSeats && players.map((p, i) => points[i] && !(me && p.id === me) && (
        <Seat key={p.id} x={points[i].x} y={points[i].y} name={p.name} avatar={avatars[p.id]} count={sham ? undefined : model?.counts[p.id]}
          turn={model?.turn === p.id || sham?.czar === p.id} away={!online.has(p.id)} host={p.id === room.hostId}
          note={sham ? `${sham.scores[p.id] ?? 0} Pkt.${sham.czar === p.id ? " · Zar" : sham.phase === "pick" && sham.played[p.id] ? " · gelegt ✓" : ""}` : model?.notes?.[p.id]}
          video={videos?.[p.id]} videoHidden={!!hiddenVideos?.has(p.id)} onToggleVideo={onToggleVideo ? () => onToggleVideo(p.id) : undefined}
          board={model?.boards?.[p.id]} boardAbove={!!felt && points[i].y > felt.y + felt.h / 2} boardHidden={real} />
      ))}
      {reacts.map((r) => {
        const i = players.findIndex((p) => p.id === r.from);
        const at = points[i];
        return at ? <span key={r.id} className="react-float pointer-events-none absolute text-6xl" style={{ left: at.x, top: at.y }} data-testid="table-react" aria-hidden>{r.emoji}</span> : null;
      })}
      {/* Bausteine auf dem Filz: Würfel, Spielfeld */}
      {(model?.dice || model?.grid || model?.piles || model?.words5) && (
        <OnFelt rect={felt} className={cn(real && "sr-only")}>
          {model.grid ? <FeltGrid grid={model.grid} /> : model.dice
            ? <div className="flex flex-col items-center gap-[3cqh]">{model.piles && <FeltPiles piles={model.piles} small />}<FeltDice dice={model.dice} /></div>
            : model.words5 ? <FeltWords words={model.words5} /> : model.piles && <FeltPiles piles={model.piles} />}
        </OnFelt>
      )}
      {/* Am Rechner sitzt oben ein Mitspieler – die Meldung steht dort unten auf dem Tisch */}
      {model?.log.length && !sham ? <p className={cn("table-banner absolute left-1/2 max-w-2xl -translate-x-1/2", me ? "bottom-4" : "top-6")} data-testid="table-news">{real && model.words5?.title ? model.words5.title : model.log.at(-1)}</p> : null}
      {sham && <SchamlosStatus s={sham} name={(id) => room.players.find((p) => p.id === id)?.name ?? "?"} count={room.players.length} />}
    </>
  );
}

/**
 * Der Tisch in voller Größe – in 3D in der gewählten Grafik-Stufe, sonst (Stufe „Ohne 3D“, kein WebGL,
 * Grafik abgestürzt) als einfacher flacher Tisch in derselben Anordnung. Die Partie läuft dabei einfach weiter.
 */
function TableCanvas({ model, seats, onSeats, forceFlat, onReal }: {
  model: TableModel | null; seats: string[]; onSeats: (p: { x: number; y: number }[], felt: FeltRect) => void; forceFlat?: boolean;
  /** meldet, ob gerade in 3D gezeichnet wird */
  onReal?: (real: boolean) => void;
}) {
  const scene = useRef<TableScene | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const seatKey = seats.join();
  const level = useQuality();
  // WebGL verloren (Grafiktreiber, zu wenig Speicher): ab jetzt flach
  const [lost, setLost] = useState(false);
  const flat = forceFlat || level === "flach" || lost || !webglOk();
  const latest = useRef({ model, seats });
  latest.current = { model, seats };

  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    // Eigenes Canvas je Darstellung – ein Canvas kann nicht von 3D auf 2D wechseln
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 size-full";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.testid = flat ? "table-flat" : "table-3d";
    box.replaceChildren(canvas);
    let s: TableScene;
    let real = !flat;
    try { s = flat ? createFlatScene(canvas) : createTableScene(canvas, level); } catch { s = createFlatScene(canvas); real = false; }
    onReal?.(real);
    scene.current = s;
    const onLost = (e: Event) => { e.preventDefault(); setLost(true); };
    canvas.addEventListener("webglcontextlost", onLost);
    const ro = new ResizeObserver(() => { s.resize(canvas.clientWidth, canvas.clientHeight); onSeats(s.seatPoints(), s.feltRect()); });
    ro.observe(canvas);
    s.update(latest.current.model, latest.current.seats);
    return () => { ro.disconnect(); canvas.removeEventListener("webglcontextlost", onLost); s.dispose(); scene.current = null; };
  }, [onSeats, flat, level, onReal]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.update(model, seatKey ? seatKey.split(",") : []);
    onSeats(s.seatPoints(), s.feltRect());
  }, [model, seatKey, onSeats]);

  return <div ref={holder} className="absolute inset-0" />;
}

function Seat({ x, y, name, avatar, count, turn, away, host, note, video, videoHidden, onToggleVideo, board, boardAbove, boardHidden }: {
  x: number; y: number; name: string; avatar?: Parameters<typeof Avatar>[0]["avatar"]; count?: number; turn: boolean; away: boolean; host: boolean; note?: string;
  video?: MediaStream; videoHidden?: boolean; onToggleVideo?: () => void;
  /** offene Auslage des Spielers (z. B. Raster) unter dem Platz */
  board?: NonNullable<TableModel["boards"]>[string];
  /** Platz unten am Tisch: Auslage über dem Platz statt darunter (sonst ragt sie aus dem Bild) */
  boardAbove?: boolean;
  /** Auslage liegt in 3D auf dem Tisch – hier nur für Vorleseprogramme */
  boardHidden?: boolean;
}) {
  const showVideo = !!video && !videoHidden;
  const face = showVideo ? <SeatVideo stream={video} /> : <Avatar avatar={avatar} name={name} className="size-14 text-3xl" />;
  return (
    <div className={cn("seat-plate absolute flex w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 transition-[left,top]", away && "opacity-55")}
      style={{ left: `clamp(80px, ${x}px, calc(100% - 80px))`, top: `clamp(70px, ${y}px, calc(100% - 60px))` }} data-testid="table-seat" data-turn={turn}>
      {/* Video (Kamera an) oder Bild – am Fernseher per Klick einzeln aus- und wieder einblendbar */}
      {video && onToggleVideo ? (
        <button type="button" onClick={onToggleVideo} aria-label={showVideo ? `Video von ${name} ausblenden` : `Video von ${name} zeigen`} data-testid="seat-video-toggle"
          className={cn(seatBox, "pointer-events-auto outline-none focus-visible:ring-4 focus-visible:ring-[#f7ecd6]", turn && seatTurn)}>
          {face}
          {!showVideo && <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[0.65rem] font-semibold">Video aus</span>}
        </button>
      ) : <div className={cn(seatBox, turn && seatTurn)}>{face}</div>}
      <span className={cn("plate max-w-full truncate", turn && "plate-turn")}>
        {name}{count !== undefined && <span className="ml-1.5 tabular-nums opacity-75">· {count}</span>}{host && !count && count !== 0 ? <span className="ml-1 opacity-60">· Host</span> : null}
      </span>
      {note && <span className="text-sm font-semibold drop-shadow">{note}</span>}
      {board && <div className={cn(boardAbove && "order-first", boardHidden && "sr-only")}><SeatBoard board={board} /></div>}
      {away && <span className="text-xs font-semibold">nicht verbunden</span>}
    </div>
  );
}

const TV_VIEW_KEY = "spieltisch:tvView";

/** Am Fernseher umschalten: Tisch oder Bühne */
function ViewPanel({ view, onView }: { view: "table" | "stage"; onView: (v: "table" | "stage") => void }) {
  const btn = "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#f7ecd6]";
  return (
    <div className="flex gap-1 rounded-xl bg-white/10 p-1" role="group" aria-label="Ansicht" data-testid="view-panel">
      {(["table", "stage"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => onView(v)} data-testid={`view-${v}`}
          className={cn(btn, view === v ? "bg-[#f7ecd6] text-[#2b2118]" : "text-[#f7ecd6] hover:bg-white/10")}>
          {v === "table" ? <><Armchair className="size-4" />Tisch</> : <><Sparkles className="size-4" />Bühne</>}
        </button>
      ))}
    </div>
  );
}

/**
 * Showstudio: 3D-Bühne mit Leinwand und Pulten. Auf der Leinwand läuft das Spiel (flacher Tisch, Würfel, Brett, Schamlos)
 * oder – vor der Partie – die Lobby; an den Pulten stehen Bild bzw. Video, Name und Kartenzahl/Punkte.
 */
function StudioStage({ room, online, model, sham, reacts, videos, hiddenVideos, onToggleVideo, children }: {
  room: RoomState; online: Set<string>; model: TableModel | null; sham: SchamlosState | null; reacts: TableReact[];
  videos: Record<string, MediaStream>; hiddenVideos: Set<string>; onToggleVideo: (id: string) => void; children?: React.ReactNode;
}) {
  const avatars = useMemo(() => roomAvatars(room), [room]);
  const holder = useRef<HTMLDivElement>(null);
  const scene = useRef<StudioScene | null>(null);
  const level = useQuality();
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [screen, setScreen] = useState<FeltRect | null>(null);
  const seats = room.players.map((p) => p.id);
  const seatKey = seats.join();
  const turn = model?.turn ?? sham?.czar ?? null;
  const measure = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
    const next = s.podiumPoints(), r = s.screenRect();
    setPoints((prev) => (prev.length === next.length && prev.every((p, i) => near(p.x, next[i].x) && near(p.y, next[i].y)) ? prev : next));
    setScreen((prev) => (prev && near(prev.x, r.x) && near(prev.y, r.y) && near(prev.w, r.w) && near(prev.h, r.h) ? prev : r));
  }, []);
  const latest = useRef({ seats, turn });
  latest.current = { seats, turn };

  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 size-full";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.testid = "studio-3d";
    box.replaceChildren(canvas);
    const s = createStudioScene(canvas, level, measure);
    scene.current = s;
    const ro = new ResizeObserver(() => { s.resize(canvas.clientWidth, canvas.clientHeight); measure(); });
    ro.observe(canvas);
    s.update(latest.current.seats, latest.current.turn);
    return () => { ro.disconnect(); s.dispose(); scene.current = null; };
  }, [level, measure]);

  useEffect(() => {
    scene.current?.update(seatKey ? seatKey.split(",") : [], turn);
    measure();
  }, [seatKey, turn, measure]);

  return (
    <div className="absolute inset-0" data-testid="studio">
      <div ref={holder} className="absolute inset-0" />
      {/* Leinwand: das Spiel flach – oder Lobby/Siegerehrung */}
      {screen && (
        <div className="absolute overflow-hidden rounded-md bg-[#0e2a2c]" style={{ left: screen.x, top: screen.y, width: screen.w, height: screen.h, containerType: "size" }} data-testid="studio-screen">
          {children ? <div className="absolute inset-0 flex items-center justify-center p-[3cqh]">{children}</div>
            : model?.words ? <WordsScreen words={model.words} name={(id) => room.players.find((p) => p.id === id)?.name ?? "?"} count={room.players.length} />
            : <TableStage room={room} online={online} model={model} sham={sham} showSeats={false} flat />}
        </div>
      )}
      {room.players.map((p, i) => points[i] && (
        <Seat key={p.id} x={points[i].x} y={points[i].y} name={p.name} avatar={avatars[p.id]} count={sham ? undefined : model?.counts[p.id]}
          turn={turn === p.id} away={!online.has(p.id)} host={p.id === room.hostId}
          note={sham ? `${sham.scores[p.id] ?? 0} Pkt.${sham.czar === p.id ? " · Zar" : ""}` : model?.notes?.[p.id]}
          video={videos[p.id]} videoHidden={hiddenVideos.has(p.id)} onToggleVideo={() => onToggleVideo(p.id)} />
      ))}
      {reacts.map((r) => {
        const at = points[room.players.findIndex((p) => p.id === r.from)];
        return at ? <span key={r.id} className="react-float pointer-events-none absolute text-6xl" style={{ left: at.x, top: at.y - 60 }} data-testid="table-react" aria-hidden>{r.emoji}</span> : null;
      })}
    </div>
  );
}

/**
 * Lückensatz-Spiele auf der Leinwand: die schwarze Karte groß zum Mitlesen, beim Wählen die Antworten schon eingesetzt,
 * danach die gewählte hervorgehoben – wie in einer Spielshow. Wer gelegt hat, steht nicht dabei (anonym bis zum Punkt).
 */
function WordsScreen({ words, name, count }: { words: NonNullable<TableModel["words"]>; name: (id: string) => string; count: number }) {
  const prompt = cardText(words.prompt);
  return (
    <div className="absolute inset-0 flex flex-col gap-[3cqh] p-[4cqh] text-white" data-testid="studio-words">
      <div className="rounded-[2cqh] bg-[#141018] p-[3.5cqh] text-[6cqh] leading-tight font-bold shadow-[0_0_6cqh_rgb(255_122_89/0.25)] ring-1 ring-white/15" data-testid="studio-prompt">
        {prompt.split(BLANK).map((part, i, all) => <span key={i}>{part}{i < all.length - 1 && <span className="inline-block w-[14cqh] border-b-[0.6cqh] border-white/80 align-baseline" />}</span>)}
      </div>
      {words.subs.length === 0 ? (
        <p className="text-center text-[4.5cqh] font-semibold opacity-85">{words.playedBy.length} von {count - 1} haben gelegt …</p>
      ) : (
        <ol className="grid min-h-0 flex-1 auto-rows-fr gap-[2cqh]" style={{ gridTemplateColumns: `repeat(${Math.min(3, words.subs.length)}, minmax(0, 1fr))` }}>
          {words.subs.map((cards, i) => (
            <li key={i} data-testid="studio-answer"
              className={cn("flex flex-col justify-center gap-[1.5cqh] rounded-[2cqh] bg-[#fbf7ef] p-[3cqh] text-[4.8cqh] leading-snug font-semibold text-[#141018] transition-[transform,opacity]",
                words.pick !== null && (words.pick === i ? "scale-105 ring-[0.8cqh] ring-[#ff7a59]" : "opacity-45"))}>
              <span>{fillIn(words.prompt, cards).map((p, k) => <span key={k} className={p.fill ? "text-[#c2492e]" : "opacity-60"}>{p.text}</span>)}</span>
              {words.pick === i && words.pickBy && <span className="text-[4cqh] font-bold text-[#c2492e]">Punkt für {name(words.pickBy)}!</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const seatBox = "relative grid h-20 w-28 place-items-center overflow-hidden rounded-2xl bg-[#3b2a1a]/70 shadow-lg ring-2 ring-[#f7ecd6]/80";
const seatTurn = "ring-4 ring-[#ff7a59] shadow-[0_0_30px_8px_rgb(255_140_100/0.55)]";

function SeatVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); } }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="size-full object-cover" data-testid="seat-video" />;
}

/** Am Tisch: Videos an den Plätzen an/aus, Couch-Kamera (Bild des Wohnzimmers für die Online-Mitspieler) */
function VideoPanel({ cam }: { cam: ReturnType<typeof useCouchCam> }) {
  const p = usePrefs();
  const btn = "flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-[#f7ecd6] outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]";
  return (
    <div className="grid gap-1.5" data-testid="video-panel">
      <div className="flex gap-2">
        <button type="button" className={cn(btn, "flex-1", !p.tableVideo && "opacity-50 line-through")} onClick={() => setPref("tableVideo", !p.tableVideo)} aria-pressed={p.tableVideo} data-testid="table-video-toggle">
          <Video className="size-4" />Videos
        </button>
        <button type="button" className={cn(btn, "flex-1", cam.on && "bg-[#ff7a59]/80 hover:bg-[#ff7a59]")} disabled={cam.busy} onClick={() => (cam.on ? cam.stop() : void cam.start())} aria-pressed={cam.on} aria-label={cam.on ? "Couch-Kamera aus" : "Couch-Kamera an"} title="Bild vom Sofa für die Online-Mitspieler" data-testid="couch-cam">
          {cam.busy ? <Loader2 className="size-4 animate-spin" /> : cam.on ? <VideoOff className="size-4" /> : <Camera className="size-4" />}{cam.on ? "Kamera aus" : "Kamera"}
        </button>
      </div>
      {cam.error && <p role="alert" className="text-xs font-semibold text-[#ffb4a2]">{cam.error}</p>}
    </div>
  );
}

function SchamlosStatus({ s, name, count }: { s: SchamlosState; name: (id: string) => string; count: number }) {
  const done = Object.keys(s.played).length;
  const win = s.phase === "result" && s.pick !== null ? s.subs[s.pick] : null;
  return (
    <p className="table-banner absolute top-6 left-1/2 max-w-2xl -translate-x-1/2" data-testid="table-schamlos-status">
      {s.phase === "pick" && (done < count - 1 ? `${done} von ${count - 1} haben gelegt · ${name(s.czar)} ist Zar` : "Alle haben gelegt")}
      {s.phase === "judge" && `${name(s.czar)} liest vor und wählt am Handy`}
      {win && `Punkt für ${name(win.by)}!`}
    </p>
  );
}

/**
 * Inhalt, der auf dem Filz liegt: bleibt innerhalb der Tischfläche und wächst mit ihr (Maße in cqh/cqw).
 * Ohne 3D (kein WebGL) ein fester Bereich in der Mitte.
 */
function OnFelt({ rect, children, className }: { rect: FeltRect | null; children: React.ReactNode; className?: string }) {
  const style: React.CSSProperties = rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : { left: "15%", top: "20%", width: "70%", height: "55%" };
  return <div className={cn("pointer-events-none absolute flex items-center justify-center", className)} style={{ ...style, containerType: "size" }}>{children}</div>;
}

/** Lobby: Karte mit QR-Code liegt auf dem Tisch – Code, PIN und drei Schritte */
function Lobby({ code, pin, count, host, plan }: { code: string; pin: string; count: number; host?: string; plan?: string[] }) {
  const steps = ["Handy-Kamera auf den Code halten", "Namen eingeben und beitreten", count === 0 ? "Wer zuerst da ist, wählt das Spiel" : `${host ?? "Der Host"} wählt das Spiel und startet`];
  return (
    <div className="paper-note pointer-events-auto flex max-h-[92cqh] max-w-[96cqw] items-center gap-[4cqw] p-[4cqh]" data-testid="table-lobby">
      <div className="grid shrink-0 place-items-center rounded-[2cqh] bg-white p-[2.5cqh] ring-1 ring-black/5">
        <QrCode value={joinLink(code, pin)} className="size-[min(62cqh,34cqw)]" label="QR-Code zum Mitspielen" />
      </div>
      <div className="flex min-w-0 flex-col gap-[2.6cqh]">
        <div>
          <div className="text-[2.6cqh] font-bold uppercase tracking-[0.2em] text-[#8a6f4e]">Mitspielen</div>
          <h2 className="text-[6.5cqh] font-bold leading-tight">Setzt euch an den Tisch</h2>
          {plan && <p className="mt-[1cqh] text-[3cqh] font-semibold text-[#c2492e]" data-testid="table-plan">🎉 Partyabend: {plan.map((g) => getGame(g).info.name).join(" → ")}</p>}
        </div>
        <ol className="grid gap-[1.6cqh]">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-[1.4cqw] text-[3.6cqh] leading-snug">
              <span className="grid size-[5.4cqh] shrink-0 place-items-center rounded-full bg-[#ff7a59] text-[3cqh] font-bold text-white">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
        <div className="flex items-end gap-[3cqw] rounded-[1.6cqh] bg-[#efe3cc] px-[2cqw] py-[1.6cqh]">
          <div><div className="text-[2.2cqh] font-bold uppercase tracking-wider text-[#8a6f4e]">Raum</div><div className="text-[7cqh] font-bold leading-none tracking-[0.12em]" data-testid="table-code">{code}</div></div>
          <div><div className="text-[2.2cqh] font-bold uppercase tracking-wider text-[#8a6f4e]">PIN</div><div className="text-[4.6cqh] font-bold leading-none tracking-[0.1em]">{pin}</div></div>
        </div>
      </div>
    </div>
  );
}

/** Partyabend am Fernseher: Zwischenstand und nächstes Spiel – am Ende die Siegerehrung mit Podest */
function PartyBoard({ room }: { room: RoomState }) {
  const plan = planStatus(room.evening)!;
  const ranking = eveningRanking(room.evening);
  const podium = ranking.slice(0, 3);
  return (
    <div className="paper-note pointer-events-auto flex max-h-[92cqh] w-[min(88cqw,150cqh)] flex-col gap-[2.4cqh] p-[4cqh]" data-testid="party-board">
      <div>
        <div className="text-[3.6cqh] font-bold uppercase tracking-[0.2em] text-[#8a6f4e]">Partyabend · {plan.done ? "Siegerehrung" : `nach ${plan.played} von ${plan.games.length} Spielen`}</div>
        <h2 className="text-[9cqh] font-bold leading-tight">{plan.done ? `${podium[0]?.name ?? "?"} gewinnt den Abend!` : `Als Nächstes: ${plan.next ? getGame(plan.next).info.name : "–"}`}</h2>
      </div>
      {plan.done ? (
        <div className="flex items-end justify-center gap-[2cqw]" data-testid="party-podium">
          {[1, 0, 2].map((i) => podium[i] && (
            <div key={podium[i].id} className="flex w-[18cqw] flex-col items-center gap-[1cqh]">
              <span className="truncate text-[5cqh] font-bold">{podium[i].name}</span>
              <div className={cn("grid w-full place-items-center rounded-t-[1.4cqh] text-[6cqh] font-bold text-white shadow-inner",
                i === 0 ? "h-[24cqh] bg-[#e0a526]" : i === 1 ? "h-[17cqh] bg-[#9aa7b4]" : "h-[12cqh] bg-[#b4794a]")}>{i + 1}</div>
              <span className="text-[3.6cqh] text-[#8a6f4e]">{podium[i].wins} {podium[i].wins === 1 ? "Sieg" : "Siege"}</span>
            </div>
          ))}
        </div>
      ) : (
        <ol className="grid gap-[1.2cqh]">
          {ranking.slice(0, 6).map((r, i) => (
            <li key={r.id} className="flex items-center gap-[1.4cqw] text-[5.6cqh]">
              <span className="grid size-[7.5cqh] shrink-0 place-items-center rounded-full bg-[#ff7a59] text-[4.2cqh] font-bold text-white">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="font-bold tabular-nums">{r.wins}</span>
            </li>
          ))}
        </ol>
      )}
      <ol className="flex flex-wrap gap-[1cqh] text-[3.6cqh] font-semibold">
        {plan.games.map((g, i) => (
          <li key={i} className={cn("rounded-full px-[1.4cqh] py-[0.5cqh]", i < plan.played ? "bg-[#3e9a92] text-white" : i === plan.played ? "bg-[#ff7a59] text-white" : "bg-[#efe3cc] text-[#8a6f4e]")}>
            {i < plan.played ? "✓ " : ""}{getGame(g).info.name}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Spiel ohne Tisch-Ansicht: die Partie wie am Handy, mitten auf dem Tisch */
function Fallback({ room, code, online }: { room: RoomState; code: string; online: Set<string> }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <div className="pointer-events-none relative flex h-full max-h-[52rem] w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-background text-foreground shadow-2xl ring-8 ring-[#3b2a1a] select-none" inert>
        <Boundary fallback={<p className="m-auto p-6 text-center text-muted-foreground">Dieses Spiel lässt sich hier nicht anzeigen.</p>}>
          <RoomScreen room={room} me={WATCH_ID} online={online} code={code} dispatch={() => undefined} onLeave={() => undefined} chat={{ messages: [], say: () => undefined }} />
        </Boundary>
      </div>
    </div>
  );
}

function JoinNote({ code, pin }: { code: string; pin: string }) {
  return (
    <div className="paper-note flex items-center gap-4 p-4">
      <div className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-black/5"><QrCode value={joinLink(code, pin)} className="size-24" label="QR-Code zum Mitspielen" /></div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f4e]">Mitspielen</div>
        <div className="mt-0.5 text-3xl font-bold leading-none tracking-[0.1em]">{code}</div>
        <div className="mt-1.5 inline-block rounded-md bg-[#efe3cc] px-2 py-0.5 text-sm font-bold tracking-wider">PIN {pin}</div>
      </div>
    </div>
  );
}

function Scores({ room, model, avatars, points }: { room: RoomState; model: TableModel | null; avatars: ReturnType<typeof roomAvatars>; points?: Record<string, number> }) {
  if (!room.players.length) return null;
  if (points) model = { ...(model ?? { deck: "cards", pile: 0, discard: [], counts: {}, turn: null, n: 0, log: [] }), scores: points };
  const rows = [...room.players].sort((a, b) => (model?.scores ? (model.scores[b.id] ?? 0) - (model.scores[a.id] ?? 0) : 0));
  // Spiele ohne Karten (Würfel, Spielfeld): statt Kartenzahl die Notiz des Platzes (z. B. die Farbe)
  const cards = !!model && Object.keys(model.counts).length > 0;
  return (
    <div className="paper-note -rotate-1 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8a6f4e]">{model?.scores ? "Punkte" : cards ? "Karten" : "Am Tisch"}</div>
      <ul className="grid gap-1.5">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar avatar={avatars[p.id]} name={p.name} className="size-6 text-sm" />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <b className="tabular-nums">{model?.scores ? model.scores[p.id] ?? 0 : cards ? model!.counts[p.id] ?? 0 : model?.notes?.[p.id] ?? ""}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Log({ lines }: { lines: string[] }) {
  return (
    <div className="paper-note min-h-0 shrink rotate-[0.6deg] overflow-hidden p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-[#8a6f4e]">Verlauf</div>
      <ul className="mt-1">
        {[...lines].reverse().map((l, i) => <li key={`${i}-${l}`} className={cn("border-b border-dashed border-[#e3d2b3] py-2 text-sm", i === 0 && "font-semibold")}>{l}</li>)}
      </ul>
    </div>
  );
}
