import { useState, type ReactNode } from "react";
import { Bot, Loader2, Minus, Plus, WifiOff } from "lucide-react";
import { GAME_IDS, getGame } from "@shared/games";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { navigate } from "@/hooks/useRoute";
import { DEVICE_KEY, TOKEN_KEY } from "@/lib/admin";
import { DEV_KEY, PREVIEWS, setDev, simulateGap, useDev } from "@/lib/dev";
import { myName } from "@/lib/profile";
import { DICE_HQ_KEY, readStr, setPendingJoin, wipeLocal, writeStr } from "@/lib/storage";
import { InstallSheet } from "@/platform/InstallHint";
import { replayIntro } from "@/platform/intro/intro";
import { Segmented } from "@/platform/Segmented";
import { useAdmin } from "./context";
import { AuthError } from "./shared";

const DELAYS = [{ value: "0", label: "normal" }, { value: "300", label: "+0,3 s" }, { value: "1000", label: "+1 s" }, { value: "3000", label: "+3 s" }];
/** Diese Daten bleiben beim Zurücksetzen – sonst wäre die Verwaltung auf dem Gerät weg */
const KEEP = [TOKEN_KEY, DEVICE_KEY, DEV_KEY];

/** Entwickler: Testräume mit Bots, Diagnose, Netz simulieren, Abläufe erneut zeigen, Vorschau-Schalter */
export function DevSection() {
  const d = useDev();
  const [install, setInstall] = useState(false);
  const [hq, setHq] = useState(() => readStr(DICE_HQ_KEY) === "1");

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start" data-testid="admin-dev">
      <TestRoom />

      <Block title="Ein Handy für alle mit Bots" hint="In der Lobby gibt es im Entwickler-Modus „Bot dazu“. Bots ziehen, wenn sie dran sind.">
        <Button variant="secondary" onClick={() => navigate("/lokal")}>Lokale Lobby öffnen</Button>
      </Block>

      <Block title="Diagnose">
        <label className="flex items-center gap-3">
          <Checkbox checked={d.overlay} aria-label="Diagnose-Anzeige" onCheckedChange={(c) => setDev({ overlay: c === true })} />
          <span><span className="block font-semibold">Diagnose-Anzeige</span><span className="block text-xs text-muted-foreground">Oben links: Version, Fenster, Netz, Raum-Verbindung und Antwortzeit</span></span>
        </label>
      </Block>

      <Block title="Netz simulieren" hint="Gilt für Räume auf diesem Gerät – so lässt sich prüfen, dass ein kurzes Offline keine Dramen auslöst.">
        <div className="grid grid-cols-3 gap-2">
          {[5, 20, 60].map((s) => (
            <Button key={s} variant="secondary" size="sm" onClick={() => simulateGap(s * 1000)}><WifiOff />{s} s weg</Button>
          ))}
        </div>
        <Segmented label="Verzögerung" value={String(d.delay)} options={DELAYS} onChange={(v) => setDev({ delay: Number(v) })} />
      </Block>

      <Block title="Abläufe erneut zeigen">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => replayIntro("onboarding")}>Willkommen</Button>
          <Button variant="secondary" size="sm" onClick={() => replayIntro("tour")}>Rundgang</Button>
          <Button variant="secondary" size="sm" onClick={() => replayIntro("welcome")}>Begrüßung</Button>
          <Button variant="secondary" size="sm" onClick={() => setInstall(true)}>App-Einladung</Button>
        </div>
        <label className="flex items-center gap-3">
          <Checkbox checked={hq} aria-label="Würfel in voller Qualität" onCheckedChange={(c) => {
            const on = c === true;
            writeStr(DICE_HQ_KEY, on ? "1" : null);
            setHq(on);
          }} />
          <span><span className="block font-semibold">Würfel in voller Qualität</span><span className="block text-xs text-muted-foreground">auch ohne Grafikchip (für Screenshots)</span></span>
        </label>
        <Confirm title="Lokale Daten zurücksetzen?" description="Name, Spielstände, Einstellungen und Gruppen auf diesem Gerät sind weg. Die Verwaltung bleibt angemeldet, das Profil auf dem Server bleibt." confirmLabel="Zurücksetzen"
          onConfirm={() => {
            wipeLocal(KEEP);
            location.href = "/";
          }}>
          <Button variant="ghost" size="sm" className="justify-self-start text-destructive">Lokale Daten zurücksetzen</Button>
        </Confirm>
        <InstallSheet open={install} onClose={() => setInstall(false)} invite />
      </Block>

      <Block title="Vorschau" hint="Funktionen, die noch nicht für alle freigegeben sind – nur auf diesem Gerät.">
        {PREVIEWS.length === 0 ? <p className="text-sm text-muted-foreground">Gerade gibt es keine Vorschau-Funktionen.</p> : PREVIEWS.map((p) => (
          <label key={p.id} className="flex items-center gap-3">
            <Checkbox checked={d.previews.includes(p.id)} aria-label={p.name}
              onCheckedChange={(c) => setDev({ previews: c === true ? [...d.previews, p.id] : d.previews.filter((x) => x !== p.id) })} />
            <span><span className="block font-semibold">{p.name}</span><span className="block text-xs text-muted-foreground">{p.desc}</span></span>
          </label>
        ))}
      </Block>
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Testraum: unsichtbar, zählt nicht; Bots spielen zufällig mit, du trittst als Host bei */
function TestRoom() {
  const { api } = useAdmin();
  const [game, setGame] = useState<string>(GAME_IDS[0]);
  const [bots, setBots] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = Math.min(7, getGame(game).info.maxPlayers - 1);
  const n = Math.min(bots, max);
  const open = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api<{ code: string; pin: string }>("/api/admin/test-room", { game, bots: n });
      setPendingJoin(r.code, { name: myName() || "Admin", pin: r.pin });
      navigate(`/r/${r.code}`);
    } catch (e) { if (!(e instanceof AuthError)) setError((e as Error).message); setBusy(false); }
  };
  return (
    <Block title="Testraum mit Bots" hint="Unsichtbar unter „Offene Räume“, zählt nicht in der Statistik. Bots ziehen von selbst zufällig (nur erlaubte Züge). Unter „Live“ kannst du einen sofort ziehen lassen oder übernehmen.">
      <label className="grid gap-1.5 text-sm font-semibold">
        Spiel
        <select value={game} onChange={(e) => setGame(e.target.value)} data-testid="dev-game"
          className="h-11 rounded-full bg-input/40 px-4 font-normal ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {GAME_IDS.map((id) => <option key={id} value={id}>{getGame(id).info.name}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-semibold"><Bot className="mr-1 inline size-4 align-[-3px] text-primary" />Bots</span>
        <Button variant="secondary" size="icon" className="size-9" aria-label="Ein Bot weniger" disabled={n <= 1} onClick={() => setBots(n - 1)}><Minus /></Button>
        <b className="w-6 text-center text-lg tabular-nums" data-testid="dev-bots">{n}</b>
        <Button variant="secondary" size="icon" className="size-9" aria-label="Ein Bot mehr" disabled={n >= max} onClick={() => setBots(n + 1)}><Plus /></Button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <Button disabled={busy} onClick={() => void open()}>{busy && <Loader2 className="animate-spin" />}Testraum öffnen</Button>
    </Block>
  );
}
