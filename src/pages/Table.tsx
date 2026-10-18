import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, Loader2, LogOut, Tv } from "lucide-react";
import { PIN_RE, ROOM_CODE_RE, WATCH_ID, type RemoteCmd } from "@shared/platform/protocol";
import { toast } from "sonner";
import { prefs, setPref } from "@/lib/prefs";
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
import { createTableScene, webglOk, type FeltRect, type TableScene } from "@/platform/table/scene";
import { createFlatScene } from "@/platform/table/flat";
import { useQuality } from "@/lib/quality";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useAdminDevice } from "@/lib/admin";
import { modeAllowed } from "@shared/platform/modes";
import { SoundPanel, useTableSound } from "@/platform/table/sound";
import { HostCorner, HostPanel, readMood, useTableHost } from "@/platform/table/host";
import { FeltDice, FeltGrid } from "@/platform/table/blocks";
import { CouchAdd, CouchPlayers, useCouch } from "@/platform/table/Couch";
import { enableSpatialNav } from "@/lib/spatialNav";

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
  const { state, online, status, error, remote } = useWatch(`/api/rooms/${code}/ws`, hello);
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
  return <TableView code={code} pin={pin} room={state} online={online} remote={remote} />;
}

type Remote = { cmd: RemoteCmd; by: string; n: number };

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

function TableView({ code, pin, room, online, remote }: { code: string; pin: string; room: RoomState; online: Set<string>; remote: Remote | null }) {
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
  const [felt, setFelt] = useState<FeltRect | null>(null);
  useTableSound(room, model);
  const [mood, setMood] = useState(readMood);
  const moderator = useTableHost(room, model, mood);
  const couch = useCouch(code);
  // Hand eines Couch-Spielers offen: der Tisch rückt nach rechts
  const [handOpen, setHandOpen] = useState(false);
  const cover = useRemote(remote);

  return (
    <div className="table-room fixed inset-0 flex overflow-hidden" data-testid="table-view">
      <main className={cn("relative min-w-0 flex-1 transition-[margin]", handOpen && "ml-[min(30rem,100vw)]")}>
        <TableStage room={room} online={online} model={fallback ? null : model} sham={sham} showSeats={!fallback} onFelt={setFelt} />

        <header className="absolute top-6 left-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#3e9a92] to-[#1f5f5b] shadow-lg">{game ? <game.Icon className="size-6 text-white" /> : <Tv className="size-5 text-white" />}</span>
          <div className="drop-shadow">
            <b className="text-2xl">{playing && game ? game.info.name : "Großer Tisch"}</b>
            <div className="text-sm opacity-80">Raum {code}{model?.color ? ` · gilt: ${model.color.label}` : ""}</div>
          </div>
        </header>

        {moderator.on && <HostCorner say={moderator.say} mood={mood} />}
        {!playing && <OnFelt rect={felt}><Lobby code={code} pin={pin} count={room.players.length} host={host?.name} /></OnFelt>}
        {fallback && <Fallback room={room} code={code} online={online} />}
      </main>

      <aside className="flex w-80 shrink-0 flex-col gap-4 border-l border-white/10 bg-black/25 p-5">
        {playing && <JoinNote code={code} pin={pin} />}
        <Scores room={room} model={model} avatars={avatars} points={sham?.scores} />
        {model && <Log lines={model.log} />}
        <div className="mt-auto" />
        <CouchPlayers code={code} pin={pin} room={room} couch={couch} onOpen={setHandOpen} cover={cover} />
        <CouchAdd onAdd={couch.add} full={couch.list.length >= 6} />
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
export function TableStage({ room, online, model, sham, me, showSeats = true, onFelt }: {
  room: RoomState; online: Set<string>; model: TableModel | null; sham?: SchamlosState | null; me?: string | null; showSeats?: boolean; onFelt?: (f: FeltRect) => void;
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

  return (
    <>
      <TableCanvas model={shown} seats={seats} onSeats={onSeats} />
      {showSeats && players.map((p, i) => points[i] && !(me && p.id === me) && (
        <Seat key={p.id} x={points[i].x} y={points[i].y} name={p.name} avatar={avatars[p.id]} count={sham ? undefined : model?.counts[p.id]}
          turn={model?.turn === p.id || sham?.czar === p.id} away={!online.has(p.id)} host={p.id === room.hostId}
          note={sham ? `${sham.scores[p.id] ?? 0} Pkt.${sham.czar === p.id ? " · Zar" : sham.phase === "pick" && sham.played[p.id] ? " · gelegt ✓" : ""}` : model?.notes?.[p.id]} />
      ))}
      {/* Bausteine auf dem Filz: Würfel, Spielfeld */}
      {(model?.dice || model?.grid) && (
        <OnFelt rect={felt}>
          {model.grid ? <FeltGrid grid={model.grid} /> : model.dice && <FeltDice dice={model.dice} />}
        </OnFelt>
      )}
      {/* Am Rechner sitzt oben ein Mitspieler – die Meldung steht dort unten auf dem Tisch */}
      {model?.log.length && !sham ? <p className={cn("table-banner absolute left-1/2 max-w-2xl -translate-x-1/2", me ? "bottom-4" : "top-6")} data-testid="table-news">{model.log.at(-1)}</p> : null}
      {sham && <SchamlosStatus s={sham} name={(id) => room.players.find((p) => p.id === id)?.name ?? "?"} count={room.players.length} />}
    </>
  );
}

/**
 * Der Tisch in voller Größe – in 3D in der gewählten Grafik-Stufe, sonst (Stufe „Ohne 3D“, kein WebGL,
 * Grafik abgestürzt) als einfacher flacher Tisch in derselben Anordnung. Die Partie läuft dabei einfach weiter.
 */
function TableCanvas({ model, seats, onSeats }: { model: TableModel | null; seats: string[]; onSeats: (p: { x: number; y: number }[], felt: FeltRect) => void }) {
  const scene = useRef<TableScene | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const seatKey = seats.join();
  const level = useQuality();
  // WebGL verloren (Grafiktreiber, zu wenig Speicher): ab jetzt flach
  const [lost, setLost] = useState(false);
  const flat = level === "flach" || lost || !webglOk();
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
    try { s = flat ? createFlatScene(canvas) : createTableScene(canvas, level); } catch { s = createFlatScene(canvas); }
    scene.current = s;
    const onLost = (e: Event) => { e.preventDefault(); setLost(true); };
    canvas.addEventListener("webglcontextlost", onLost);
    const ro = new ResizeObserver(() => { s.resize(canvas.clientWidth, canvas.clientHeight); onSeats(s.seatPoints(), s.feltRect()); });
    ro.observe(canvas);
    s.update(latest.current.model, latest.current.seats);
    return () => { ro.disconnect(); canvas.removeEventListener("webglcontextlost", onLost); s.dispose(); scene.current = null; };
  }, [onSeats, flat, level]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.update(model, seatKey ? seatKey.split(",") : []);
    onSeats(s.seatPoints(), s.feltRect());
  }, [model, seatKey, onSeats]);

  return <div ref={holder} className="absolute inset-0" />;
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
function Lobby({ code, pin, count, host }: { code: string; pin: string; count: number; host?: string }) {
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
