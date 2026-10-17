import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, Loader2, LogOut, Tv } from "lucide-react";
import { PIN_RE, ROOM_CODE_RE, WATCH_ID } from "@shared/platform/protocol";
import type { RoomState } from "@shared/platform/room";
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
import { BlackCard } from "@/games/schamlos/Board";
import { fillIn } from "@shared/games/schamlos/cards";
import { createTableScene, webglOk, type TableScene } from "@/platform/table/scene";

/** Neue PIN für einen Tisch-Raum – steht im QR-Code, abtippen muss sie niemand */
const newPin = () => String(randomInt(900000) + 100000);

/** Link zum Beitreten fürs Handy: die PIN steht hinter # und geht so nicht an den Server */
const joinLink = (code: string, pin: string) => `${location.origin}/r/${code}#pin=${pin}`;

/**
 * Großer Tisch aufbauen: neuen Raum für diesen Bildschirm öffnen oder einen laufenden Raum verbinden.
 * Der Bildschirm spielt nicht mit – er zeigt den Tisch, die Handys sind die Hände.
 */
export function TableSetup() {
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
  const { state, online, status, error } = useWatch(`/api/rooms/${code}/ws`, hello);
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
  return <TableView code={code} pin={pin} room={state} online={online} />;
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

function TableView({ code, pin, room, online }: { code: string; pin: string; room: RoomState; online: Set<string> }) {
  const model = useMemo(() => tableModel(room), [room]);
  const playing = room.phase === "playing";
  const game = GAME_LIST.find((g) => g.id === room.gameId) ?? null;
  const avatars = useMemo(() => roomAvatars(room), [room]);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  // Nur bei echter Änderung neu setzen – sonst zeichnet sich die Seite endlos neu
  const onSeats = useCallback((next: { x: number; y: number }[]) => {
    setPoints((prev) => (prev.length === next.length && prev.every((p, i) => Math.abs(p.x - next[i].x) < 0.5 && Math.abs(p.y - next[i].y) < 0.5) ? prev : next));
  }, []);
  const seats = room.players.map((p) => p.id);
  // Schamlos hat keine Karten auf dem Tisch, sondern Sätze: eigene Mitte, Plätze zeigen Punkte und Zar
  const sham = playing && room.gameId === "schamlos" ? (room.game as SchamlosState) : null;
  const fallback = playing && !model && !sham;
  const host = room.players.find((p) => p.id === room.hostId);

  return (
    <div className="table-room fixed inset-0 flex overflow-hidden" data-testid="table-view">
      <main className="relative min-w-0 flex-1">
        <TableCanvas model={fallback ? null : model} seats={seats} onSeats={onSeats} />

        {/* Plätze am Tischrand: Bild (später Video), Name, Karten */}
        {!fallback && room.players.map((p, i) => points[i] && (
          <Seat key={p.id} x={points[i].x} y={points[i].y} name={p.name} avatar={avatars[p.id]} count={model?.counts[p.id]}
            turn={model?.turn === p.id || sham?.czar === p.id} away={!online.has(p.id)} host={p.id === room.hostId}
            note={sham ? `${sham.scores[p.id] ?? 0} Pkt.${sham.czar === p.id ? " · Zar" : sham.phase === "pick" && sham.played[p.id] ? " · gelegt ✓" : ""}` : undefined} />
        ))}

        <header className="absolute top-6 left-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#3e9a92] to-[#1f5f5b] shadow-lg">{game ? <game.Icon className="size-6 text-white" /> : <Tv className="size-5 text-white" />}</span>
          <div className="drop-shadow">
            <b className="text-2xl">{playing && game ? game.info.name : "Großer Tisch"}</b>
            <div className="text-sm opacity-80">Raum {code}{model?.color ? ` · gilt: ${model.color.label}` : ""}</div>
          </div>
        </header>
        {model?.log.length ? <p className="paper-note absolute top-6 left-1/2 max-w-md -translate-x-1/2 -rotate-1 px-5 py-2.5 text-xl font-bold" data-testid="table-news">{model.log.at(-1)}</p> : null}

        {!playing && <Lobby code={code} pin={pin} count={room.players.length} host={host?.name} />}
        {fallback && <Fallback room={room} code={code} online={online} />}
        {sham && <SchamlosCenter s={sham} name={(id) => room.players.find((p) => p.id === id)?.name ?? "?"} count={room.players.length} />}
      </main>

      <aside className="flex w-80 shrink-0 flex-col gap-4 border-l border-white/10 bg-black/25 p-5">
        {playing && <JoinNote code={code} pin={pin} />}
        <Scores room={room} model={model} avatars={avatars} points={sham?.scores} />
        {model && <Log lines={model.log} />}
        <div className="mt-auto flex gap-2">
          <Button variant="ghost" className="flex-1 text-[#f7ecd6] hover:bg-white/10" onClick={toggleFullscreen}><Expand className="size-4" />Vollbild</Button>
          <Button variant="ghost" className="flex-1 text-[#f7ecd6] hover:bg-white/10" onClick={() => { remove(tableKey(code)); navigate("/"); }}><LogOut className="size-4" />Verlassen</Button>
        </div>
      </aside>
    </div>
  );
}

/** Die 3D-Szene in voller Größe – ohne WebGL bleibt der Platz leer (die Plätze stehen trotzdem am Rand) */
function TableCanvas({ model, seats, onSeats }: { model: TableModel | null; seats: string[]; onSeats: (p: { x: number; y: number }[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<TableScene | null>(null);
  const seatKey = seats.join();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !webglOk()) return;
    let s: TableScene;
    try { s = createTableScene(canvas); } catch { return; }
    scene.current = s;
    const ro = new ResizeObserver(() => { s.resize(canvas.clientWidth, canvas.clientHeight); onSeats(s.seatPoints()); });
    ro.observe(canvas);
    return () => { ro.disconnect(); s.dispose(); scene.current = null; };
  }, [onSeats]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.update(model, seatKey ? seatKey.split(",") : []);
    onSeats(s.seatPoints());
  }, [model, seatKey, onSeats]);

  return <canvas ref={ref} className="absolute inset-0 size-full" aria-hidden="true" />;
}

function Seat({ x, y, name, avatar, count, turn, away, host, note }: {
  x: number; y: number; name: string; avatar?: Parameters<typeof Avatar>[0]["avatar"]; count?: number; turn: boolean; away: boolean; host: boolean; note?: string;
}) {
  return (
    <div className={cn("seat-plate absolute flex w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 transition-[left,top]", away && "opacity-55")}
      style={{ left: `clamp(80px, ${x}px, calc(100% - 80px))`, top: `clamp(70px, ${y}px, calc(100% - 60px))` }} data-testid="table-seat" data-turn={turn}>
      {/* Hier kommt später das Video hin – bis dahin das Bild */}
      <div className={cn("grid h-20 w-28 place-items-center rounded-2xl bg-[#3b2a1a]/70 shadow-lg ring-2 ring-[#f7ecd6]/80", turn && "ring-4 ring-[#ff7a59] shadow-[0_0_30px_8px_rgb(255_140_100/0.55)]")}>
        <Avatar avatar={avatar} name={name} className="size-14 text-3xl" />
      </div>
      <span className={cn("plate max-w-full truncate", turn && "plate-turn")}>
        {name}{count !== undefined && <span className="ml-1.5 tabular-nums opacity-75">· {count}</span>}{host && !count && count !== 0 ? <span className="ml-1 opacity-60">· Host</span> : null}
      </span>
      {note && <span className="text-sm font-semibold drop-shadow">{note}</span>}
      {away && <span className="text-xs font-semibold">nicht verbunden</span>}
    </div>
  );
}

/** Schamlos in der Tischmitte: schwarze Karte groß, beim Wählen alle Sätze, danach der Gewinnersatz */
function SchamlosCenter({ s, name, count }: { s: SchamlosState; name: (id: string) => string; count: number }) {
  const sentence = (cards: string[], big = false) => (
    <span className={big ? "text-4xl leading-tight" : "text-2xl leading-snug"}>
      {fillIn(s.prompt, cards).map((p, i) => <span key={i} className={p.fill ? "font-bold text-[#ffb59c]" : undefined}>{p.text}</span>)}
    </span>
  );
  const played = Object.keys(s.played).length;
  return (
    <div className="pointer-events-none absolute inset-x-[12%] inset-y-[18%] flex flex-col items-center justify-center gap-5" data-testid="table-schamlos">
      {s.phase === "pick" && (
        <>
          <BlackCard prompt={s.prompt} className="max-w-3xl -rotate-1 p-8 text-4xl leading-tight shadow-2xl" />
          <p className="paper-note px-5 py-2 text-xl font-bold">{played} von {count - 1} haben gelegt · {name(s.czar)} ist Zar</p>
        </>
      )}
      {s.phase === "judge" && (
        <>
          <p className="paper-note px-5 py-2 text-xl font-bold">{name(s.czar)} liest vor und wählt am Handy</p>
          <div className="grid w-full max-w-5xl grid-cols-2 gap-4">
            {s.subs.map((x, i) => <div key={i} className="rounded-2xl bg-[#1b1e25] p-5 font-semibold text-white shadow-xl" style={{ rotate: `${(i % 3) - 1}deg` }}>{sentence(x.cards)}</div>)}
          </div>
        </>
      )}
      {s.phase === "result" && s.pick !== null && s.subs[s.pick] && (
        <>
          <div className="max-w-4xl rounded-3xl bg-[#1b1e25] p-9 font-semibold text-white shadow-2xl ring-4 ring-[#ff7a59]">{sentence(s.subs[s.pick].cards, true)}</div>
          <p className="paper-note px-6 py-3 text-2xl font-bold">Punkt für {name(s.subs[s.pick].by)}!</p>
        </>
      )}
    </div>
  );
}

/** Lobby: großer QR-Code in der Mitte des Tischs */
function Lobby({ code, pin, count, host }: { code: string; pin: string; count: number; host?: string }) {
  return (
    <div className="absolute inset-x-0 top-[30%] flex justify-center">
      <div className="paper-note flex -rotate-1 items-center gap-6 p-6" data-testid="table-lobby">
        <div className="rounded-2xl bg-white p-2.5"><QrCode value={joinLink(code, pin)} className="size-44" label="QR-Code zum Mitspielen" /></div>
        <div className="max-w-xs">
          <div className="text-sm font-bold uppercase tracking-wider text-[#8a6f4e]">Mitspielen</div>
          <p className="mt-1 text-xl font-bold">Handy-Kamera auf den Code halten</p>
          <div className="mt-4 text-4xl font-bold tracking-[0.15em]" data-testid="table-code">{code}</div>
          <div className="text-[#6b5640]">PIN {pin}</div>
          <p className="mt-4 text-[#6b5640]">{count === 0 ? "Wer zuerst beitritt, wählt das Spiel und startet es am Handy."
            : `${host ?? "Der Host"} wählt am Handy das Spiel und startet es.`}</p>
        </div>
      </div>
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
    <div className="paper-note flex rotate-1 items-center gap-3.5 p-4">
      <div className="shrink-0 rounded-lg bg-white p-1.5"><QrCode value={joinLink(code, pin)} className="size-20" label="QR-Code zum Mitspielen" /></div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider text-[#8a6f4e]">Mitspielen</div>
        <div className="text-2xl font-bold tracking-[0.12em]">{code}</div>
        <div className="text-xs text-[#8a6f4e]">PIN {pin}</div>
      </div>
    </div>
  );
}

function Scores({ room, model, avatars, points }: { room: RoomState; model: TableModel | null; avatars: ReturnType<typeof roomAvatars>; points?: Record<string, number> }) {
  if (!room.players.length) return null;
  if (points) model = { ...(model ?? { deck: "cards", pile: 0, discard: [], counts: {}, turn: null, n: 0, log: [] }), scores: points };
  const rows = [...room.players].sort((a, b) => (model?.scores ? (model.scores[b.id] ?? 0) - (model.scores[a.id] ?? 0) : 0));
  return (
    <div className="paper-note -rotate-1 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8a6f4e]">{model?.scores ? "Punkte" : model ? "Karten" : "Am Tisch"}</div>
      <ul className="grid gap-1.5">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar avatar={avatars[p.id]} name={p.name} className="size-6 text-sm" />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <b className="tabular-nums">{model?.scores ? model.scores[p.id] ?? 0 : model ? model.counts[p.id] ?? 0 : ""}</b>
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
