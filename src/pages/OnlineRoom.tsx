import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { getGame, isGameId } from "@shared/games";
import { PIN_RE } from "@shared/platform/protocol";
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

export function OnlineRoom({ code }: { code: string }) {
  const [join, setJoin] = useState<JoinData | null>(() => takePendingJoin(code));
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
        <p className="mt-2 text-muted-foreground">Vielleicht ein Tippfehler, oder der Raum ist nach 48 Stunden ohne Spiel abgelaufen.</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/")}>Zur Startseite</Button>
      </Center>
    );
  }

  if (room.status === "needsJoin") {
    return (
      <JoinForm
        code={code}
        gameId={room.gameId}
        error={room.error}
        onSubmit={(j) => { setJoin(j); setAttempt((a) => a + 1); }}
      />
    );
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
      dispatch={room.send}
      onLeave={leave}
      onCloseRoom={room.closeRoom}
      onClaimHost={room.claimHost}
      call={chat ? { ...call, peers: room.call, silent } : undefined}
    />
  );
}

function JoinForm({ code, gameId, error, onSubmit }: { code: string; gameId: string | null; error: string | null; onSubmit: (j: JoinData) => void }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } });
  const [pin, setPin] = useState("");
  const ok = cleanName(name).length > 0 && PIN_RE.test(pin);
  return (
    <Center>
      <div className="text-sm text-muted-foreground">{isGameId(gameId) ? `${getGame(gameId).info.name} · Raum` : "Raum"}</div>
      <h1 className="text-4xl font-bold tracking-[0.18em]">{code}</h1>
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

function Center({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-md px-4 pt-[14vh] text-center">{children}</main>;
}
