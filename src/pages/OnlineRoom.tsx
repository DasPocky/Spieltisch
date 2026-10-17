import { useEffect, useState, type ReactNode } from "react";
import { DoorClosed, Loader2 } from "lucide-react";
import { getGame, isGameId } from "@shared/games";
import { PIN_RE, type RoomInfo } from "@shared/platform/protocol";
import { cleanName, MAX_NAME, roomGame } from "@shared/platform/room";
import { RoomScreen } from "@/platform/RoomScreen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoom, type JoinData } from "@/hooks/useRoom";
import { navigate } from "@/hooks/useRoute";
import { credsKey, NAME_KEY, remove, takePendingJoin } from "@/lib/storage";
import { callEnabled, useCall } from "@/platform/call/useCall";
import { myAvatar } from "@/lib/profile";
import { Avatar } from "@/platform/Avatar";

export function OnlineRoom({ code }: { code: string }) {
  // Begleit-Handy: Link vom Rechner (/r/CODE#pair=…) – gleich koppeln, ohne Name und PIN
  const [join, setJoin] = useState<JoinData | null>(() => { const pc = pairFromLink(); return pc ? { name: "", pin: "", pairCode: pc } : takePendingJoin(code); });
  const [attempt, setAttempt] = useState(0);
  const room = useRoom(code, join, attempt);
  const [chat, setChat] = useState(false);
  useEffect(() => { void callEnabled().then(setChat); }, []);
  // Werwolf-Nacht & Co.: das eigene Mikro bleibt aus
  const s = room.state;
  const silent = !!s && s.phase === "playing" && !!s.game && !!roomGame(s).silent?.(s.game, room.me);
  const call = useCall(code, room.me, room.call, room.announceCall, silent);

  const leave = () => { remove(credsKey(code)); navigate("/"); };

  if (room.status === "missing") {
    return (
      <Center>
        <h1 className="text-3xl font-bold tracking-tight">Raum {code} gibt es nicht</h1>
        <p className="mt-2 text-muted-foreground">Vielleicht ein Tippfehler, oder der Raum war zu lange leer und ist abgelaufen.</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/")}>Zur Startseite</Button>
      </Center>
    );
  }

  if (room.status === "needsJoin") {
    return (
      <JoinForm
        code={code}
        gameId={room.gameId}
        info={room.info}
        error={room.error}
        onSubmit={(j) => { setJoin(j); setAttempt((a) => a + 1); }}
      />
    );
  }

  if (room.status === "knocking") {
    return <Knocking code={code} until={room.knockUntil} onCancel={() => navigate("/")} />;
  }

  if (room.status === "closed") {
    return (
      <Center>
        <h1 className="text-3xl font-bold tracking-tight">Raum beendet</h1>
        <p className="mt-2 text-muted-foreground">{room.error}</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/")}>Zur Startseite</Button>
      </Center>
    );
  }

  if (room.status === "failed") {
    return (
      <Center>
        <h1 className="text-3xl font-bold tracking-tight">Nicht verbunden</h1>
        <p className="mt-2 text-muted-foreground">{room.error}</p>
        <Button className="mt-6 w-full" onClick={() => setAttempt((a) => a + 1)}>Nochmal versuchen</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={leave}>Zur Startseite</Button>
      </Center>
    );
  }

  if (!room.state) {
    return <Center><Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" /><p className="mt-3 text-muted-foreground">Verbinde mit Raum {code} …</p></Center>;
  }

  return (
    <RoomScreen
      room={room.state}
      me={room.me}
      online={room.online}
      code={code}
      reconnecting={room.status === "connecting"}
      pending={room.pending}
      dispatch={room.send}
      onLeave={leave}
      onCloseRoom={room.closeRoom}
      onClaimHost={room.claimHost}
      call={chat ? { ...call, peers: room.call, silent } : undefined}
      chat={{ messages: room.chat, say: room.say }}
      knocks={room.knocks}
      onKnock={room.answerKnock}
      onPair={room.pair}
      pairing={room.pairing}
    />
  );
}

/** Kopplungs-Code aus dem Link des Rechners (/r/CODE#pair=…) – danach gleich wieder aus der Adresse nehmen */
function pairFromLink(): string | null {
  const m = location.hash.match(/pair=([A-HJ-NP-Z2-9]{8})/);
  if (!m) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  return m[1];
}

/** PIN aus dem Link des Großen Tischs (/r/CODE#pin=1234) – danach gleich wieder aus der Adresse nehmen */
function pinFromLink(): string {
  const m = location.hash.match(/pin=(\d{4,8})/);
  if (!m) return "";
  history.replaceState(history.state, "", location.pathname + location.search);
  return m[1];
}

function JoinForm({ code, gameId, info, error, onSubmit }: { code: string; gameId: string | null; info: RoomInfo | null; error: string | null; onSubmit: (j: JoinData) => void }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } });
  const [pin, setPin] = useState(pinFromLink);
  const ok = cleanName(name).length > 0 && PIN_RE.test(pin);
  return (
    <Center>
      <div className="text-sm text-muted-foreground">{info?.name ? `${info.name} · ` : ""}{isGameId(gameId) ? `${getGame(gameId).info.name} · Raum` : "Raum"}</div>
      <h1 className="text-4xl font-bold tracking-[0.18em]">{code}</h1>
      {info?.phase === "playing" && isGameId(gameId) && (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="join-spectate">
          {getGame(gameId).info.name} läuft gerade{getGame(gameId).joinMidGame ? " – du steigst gleich mit ein." : " – du schaust zu und spielst ab der nächsten Partie mit."}
        </p>
      )}
      {info?.knock && <p className="mt-2 text-sm text-muted-foreground">Nach der PIN klopfst du an – jemand im Raum lässt dich herein.</p>}
      <Card className="mt-6 grid gap-4 text-left">
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault(); if (!ok) return;
          try { localStorage.setItem(NAME_KEY, cleanName(name)); } catch { /* egal */ }
          onSubmit({ name: cleanName(name), pin });
        }}>
          <div className="grid gap-2">
            <Label htmlFor="jn">Dein Name</Label>
            <Input id="jn" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="nickname" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="jp">PIN</Label>
            <Input id="jp" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="off" className="tracking-[0.3em]" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={!ok}>Beitreten</Button>
        </form>
      </Card>
      <Button variant="ghost" className="mt-3 w-full text-muted-foreground" onClick={() => navigate("/")}>Zur Startseite</Button>
    </Center>
  );
}

/** Vor der Tür: PIN stimmt, jetzt lässt der Host (oder jemand im Raum) herein – mit sichtbarer Wartezeit */
function Knocking({ code, until, onCancel }: { code: string; until: number; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <Center>
      <div className="relative mx-auto w-fit" data-testid="knocking">
        <DoorClosed className="knock-door size-24 text-primary" strokeWidth={1.5} />
        <Avatar avatar={myAvatar()} className="absolute -right-4 -bottom-1 size-12 text-2xl ring-4 ring-background" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Du klopfst an …</h1>
      <p className="mt-2 text-muted-foreground">Raum <b className="tracking-[0.18em] text-foreground">{code}</b> lässt Gäste einzeln herein. Gleich entscheidet jemand.</p>
      <p className="mt-4 text-sm text-muted-foreground tabular-nums">Höchstens noch {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} Min.</p>
      <Button variant="ghost" className="mt-6 w-full text-muted-foreground" onClick={onCancel}>Abbrechen</Button>
    </Center>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-md px-4 pt-[14vh] text-center">{children}</main>;
}
