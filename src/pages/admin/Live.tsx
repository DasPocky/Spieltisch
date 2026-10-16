import { useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import type { AdminRoom } from "@shared/platform/access";
import { ADMISSION_LABEL, ADMISSIONS, cleanRoomName, MAX_ROOM_NAME, VISIBILITIES, VISIBILITY_LABEL, type Admission, type Visibility } from "@shared/platform/directory";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Segmented } from "@/platform/Segmented";
import { useAdmin } from "./context";
import { useAdminRooms } from "./Home";
import { ago, gameName, Status, useSave, type Api } from "./shared";

/** Live: offene Räume mit allem, was ein Admin dort tun kann, und Dauerräume */
export function LiveSection() {
  const { api } = useAdmin();
  const { rooms, loading, load } = useAdminRooms();
  const { msg, run } = useSave();

  const act = (code: string, what: "close" | "unlock") => run(async () => {
    await api(`/api/admin/rooms/${code}/${what}`, {});
    await load();
  }, what === "close" ? `Raum ${code} ist geschlossen.` : `PIN-Sperre von ${code} ist aufgehoben.`);

  return (
    <div className="grid gap-3" data-testid="admin-live">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rooms ? (rooms.length === 1 ? "1 offener Raum" : `${rooms.length} offene Räume`) : "Lädt …"}</p>
        <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={load} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} />Aktualisieren
        </Button>
      </div>
      <Status msg={msg} />
      <PermanentRoom api={api} onCreated={load} />
      {rooms?.length === 0 && <Card className="text-center text-muted-foreground">Gerade ist kein Raum offen.</Card>}
      <div className="grid gap-3 xl:grid-cols-2">
        {rooms?.map((r) => <RoomCard key={r.code} room={r} onAct={(what) => act(r.code, what)} />)}
      </div>
    </div>
  );
}

/** Dauerraum: bleibt bestehen, auch wenn er leer ist – z. B. für eine feste Runde */
function PermanentRoom({ api, onCreated }: { api: Api; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [admission, setAdmission] = useState<Admission>("pin");
  const { busy, msg, run } = useSave();
  const ok = cleanRoomName(name).length > 0 && /^\d{4,8}$/.test(pin);
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)} data-testid="permanent-open">Dauerraum anlegen</Button>;
  return (
    <Card className="grid gap-3 p-4" data-testid="permanent-room">
      <h2 className="font-bold">Dauerraum anlegen</h2>
      <p className="-mt-1.5 text-sm text-muted-foreground">Bleibt bestehen, auch wenn niemand drin ist. Wer zuerst hineinkommt, ist Host.</p>
      <div className="grid gap-1.5">
        <Label htmlFor="perm-name">Name</Label>
        <Input id="perm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_ROOM_NAME} placeholder="z. B. Donnerstagsrunde" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="perm-pin">PIN (4–8 Ziffern)</Label>
        <Input id="perm-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" className="tracking-[0.3em]" />
      </div>
      <Segmented label="Sichtbar für" value={visibility} onChange={setVisibility} options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))} />
      <Segmented label="Einlass" value={admission} onChange={setAdmission} options={ADMISSIONS.map((v) => ({ value: v, label: ADMISSION_LABEL[v] }))} />
      <Status msg={msg} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
        <Button disabled={!ok || busy} onClick={() => run(async () => {
          await api<{ code: string }>("/api/admin/rooms/create", { pin, room: { name, visibility, admission } });
          setName(""); setPin(""); onCreated();
        }, "Dauerraum ist angelegt.")}>Anlegen</Button>
      </div>
    </Card>
  );
}

function RoomCard({ room: r, onAct }: { room: AdminRoom; onAct: (what: "close" | "unlock") => void }) {
  const online = r.players.filter((p) => p.online).length;
  return (
    <Card className="grid gap-3 p-4" data-testid={`room-${r.code}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xl font-bold tracking-widest">{r.code}</div>
          <div className="truncate text-sm text-muted-foreground">{r.card?.name ? `${r.card.name} · ` : ""}{gameName(r.gameId)}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {r.locked && <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><Lock className="size-3" />PIN gesperrt</span>}
          {r.life === "forever" && <span className="rounded-full bg-primary/14 px-2 py-0.5 text-xs font-semibold text-primary">Dauerraum</span>}
          {r.card && r.card.visibility !== "all" && <span className="rounded-full bg-navy-800 px-2 py-0.5 text-xs font-semibold text-muted-foreground">{r.card.visibility === "group" ? "nur Gruppe" : "privat"}</span>}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", r.phase === "playing" ? "bg-primary/14 text-primary" : "bg-navy-800 text-muted-foreground")}>
            {r.phase === "playing" ? "läuft" : "Lobby"}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <p className="text-sm font-semibold">{r.players.length === 1 ? "1 Spieler" : `${r.players.length} Spieler`} · {online} online</p>
        {r.players.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {r.players.map((p) => (
              <li key={p.name} className="flex items-center gap-1.5 rounded-full bg-navy-800/70 px-2 py-0.5 text-xs font-semibold">
                <span className={cn("size-1.5 rounded-full", p.online ? "bg-ok" : "bg-muted-foreground/40")} aria-hidden />
                {p.name}<span className="sr-only">{p.online ? " (online)" : " (offline)"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">erstellt {ago(r.createdAt)} · aktiv {ago(r.activeAt)}</p>
      <div className="grid gap-2">
        {r.locked && <Button variant="secondary" size="sm" onClick={() => onAct("unlock")}>PIN-Sperre aufheben</Button>}
        <Confirm title={`Raum ${r.code} schließen?`} description="Alle Spieler fliegen raus, der Spielstand wird gelöscht." confirmLabel="Schließen" onConfirm={() => onAct("close")}>
          <Button variant="destructive" size="sm">Raum schließen</Button>
        </Confirm>
      </div>
    </Card>
  );
}

