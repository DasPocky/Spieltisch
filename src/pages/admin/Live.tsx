import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronRight, Crown, Eye, Lock, RefreshCw, Send, UserX } from "lucide-react";
import type { AdminRoom } from "@shared/platform/access";
import {
  ADMISSION_LABEL, ADMISSIONS, cleanRoomName, LIFE_LABEL, MAX_ROOM_NAME, VISIBILITIES, VISIBILITY_LABEL,
  type Admission, type RoomAccess, type RoomLife, type Visibility,
} from "@shared/platform/directory";
import { MAX_NOTICE, type AdminRoomAction, type AdminRoomDetail } from "@shared/platform/protocol";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gameIcon } from "@/games";
import { cn } from "@/lib/utils";
import { IconTile } from "@/platform/Logo";
import { Segmented } from "@/platform/Segmented";
import { useAdmin } from "./context";
import { useAdminRooms } from "./Home";
import { ago, AuthError, gameName, Status, useSave, type Api } from "./shared";
import { WatchView } from "./Watch";

/** Live: offene Räume – ein Tipp öffnet alles, was ein Admin dort tun kann – und Dauerräume */
export function LiveSection() {
  const { api } = useAdmin();
  const { rooms, loading, load } = useAdminRooms();
  const [open, setOpen] = useState<string | null>(null);
  const [watch, setWatch] = useState<string | null>(null);

  return (
    <div className="grid gap-3" data-testid="admin-live">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rooms ? (rooms.length === 1 ? "1 offener Raum" : `${rooms.length} offene Räume`) : "Lädt …"}</p>
        <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={load} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} />Aktualisieren
        </Button>
      </div>
      {rooms?.length === 0 && <Card className="text-center text-muted-foreground">Gerade ist kein Raum offen.</Card>}
      <ul className="grid gap-1.5 xl:grid-cols-2">
        {rooms?.map((r) => <li key={r.code}><RoomRow room={r} onOpen={() => setOpen(r.code)} /></li>)}
      </ul>
      <PermanentRoom api={api} onCreated={load} />
      <RoomSheet code={open} onClose={() => setOpen(null)} onChanged={load} onWatch={(c) => { setOpen(null); setWatch(c); }} />
      {watch && <WatchView code={watch} onClose={() => setWatch(null)} />}
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

/** Ein Raum in einer Zeile: Code, Name, Spiel, wer da ist, Auffälliges als Abzeichen */
function RoomRow({ room: r, onOpen }: { room: AdminRoom; onOpen: () => void }) {
  const online = r.players.filter((p) => p.online).length;
  const Icon = gameIcon(r.gameId);
  return (
    <button type="button" onClick={onOpen} data-testid={`room-${r.code}`}
      className="glass flex w-full items-center gap-3 rounded-2xl p-2.5 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring">
      <IconTile className="size-10 rounded-xl"><Icon className="size-6" /></IconTile>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1.5">
          <b className="font-mono tracking-widest">{r.code}</b>
          {r.card?.name && <span className="truncate text-sm font-semibold">{r.card.name}</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {gameName(r.gameId)} · {r.phase === "playing" ? "läuft" : "Lobby"} · {r.players.length} {r.players.length === 1 ? "Spieler" : "Spieler"}, {online} online
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {r.locked && <Badge warn><Lock className="size-3" />gesperrt</Badge>}
        {r.life === "forever" && <Badge>Dauerraum</Badge>}
        {r.card && r.card.visibility !== "all" && <Badge>{r.card.visibility === "group" ? "Gruppe" : "privat"}</Badge>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Badge({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", warn ? "bg-destructive/15 text-destructive" : "bg-primary/12 text-primary")}>{children}</span>;
}

const LIVES: { value: RoomLife; label: string }[] = [
  { value: "hour", label: "1 Std." }, { value: "day", label: "1 Tag" }, { value: "week", label: "1 Woche" }, { value: "forever", label: "Dauer" },
];

/** Alles zu einem Raum: zuschauen, Nachricht, Partie, PIN, Einstellungen, Spieler, schließen */
function RoomSheet({ code, onClose, onChanged, onWatch }: { code: string | null; onClose: () => void; onChanged: () => void; onWatch: (code: string) => void }) {
  const { api } = useAdmin();
  const [room, setRoom] = useState<AdminRoomDetail | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");

  const load = useCallback(async (c: string) => {
    try { setRoom((await api<{ room: AdminRoomDetail }>(`/api/admin/rooms/${c}`)).room); setGone(false); }
    catch (e) { if (!(e instanceof AuthError)) setGone(true); }
  }, [api]);

  useEffect(() => {
    setRoom(null); setGone(false); setMessage(""); setPin("");
    if (!code) return;
    void load(code);
    const t = setInterval(() => void load(code), 5000);
    return () => clearInterval(t);
  }, [code, load]);

  const act = async (action: AdminRoomAction, done: string, undo?: AdminRoomAction) => {
    if (!code) return;
    setBusy(true);
    try {
      await api(`/api/admin/rooms/${code}/act`, { action });
      toast(done, undo ? { action: { label: "Rückgängig", onClick: () => void act(undo, "Zurückgenommen") } } : undefined);
      await load(code);
      onChanged();
    } catch (e) { if (!(e instanceof AuthError)) toast((e as Error).message); } finally { setBusy(false); }
  };
  const simple = async (what: "close" | "unlock", done: string) => {
    if (!code) return;
    setBusy(true);
    try {
      await api(`/api/admin/rooms/${code}/${what}`, {});
      toast(done);
      onChanged();
      if (what === "close") onClose(); else await load(code);
    } catch (e) { if (!(e instanceof AuthError)) toast((e as Error).message); } finally { setBusy(false); }
  };
  const setAccess = (patch: Partial<RoomAccess>, label: string) => {
    if (!room) return;
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, room.access[k as keyof RoomAccess] ?? ""])) as Partial<RoomAccess>;
    void act({ type: "access", access: patch }, label, { type: "access", access: before });
  };

  const host = room?.players.find((p) => p.id === room.hostId);
  return (
    <Sheet open={!!code} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent data-testid="room-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><span className="font-mono tracking-widest">{code}</span>{room?.access.name && <span className="truncate font-semibold">· {room.access.name}</span>}</SheetTitle>
          <SheetDescription>
            {room ? <>{gameName(room.gameId)} · {room.phase === "playing" ? "Partie läuft" : "Lobby"} · erstellt {ago(room.createdAt)} · aktiv {ago(room.activeAt)}</> : gone ? "Den Raum gibt es nicht mehr." : "Lädt …"}
          </SheetDescription>
        </SheetHeader>
        {gone && <div className="px-5 pb-6"><Button className="w-full" onClick={onClose}>Schließen</Button></div>}
        {room && code && (
          <div className="grid gap-4 overflow-y-auto px-5 pt-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {room.locked && (
              <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-sm">
                <Lock className="size-4 shrink-0 text-destructive" /><span className="flex-1">Gesperrt nach falschen PINs.</span>
                <Button size="sm" disabled={busy} onClick={() => void simple("unlock", `PIN-Sperre von ${code} ist aufgehoben.`)}>Lösen</Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onWatch(code)}><Eye />Zuschauen</Button>
              <Confirm title="Partie beenden?" description="Alle kommen zurück in die Lobby, der Spielstand ist weg." confirmLabel="Beenden" onConfirm={() => void act({ type: "lobby" }, "Partie beendet – alle sind in der Lobby.")}>
                <Button variant="secondary" disabled={busy || room.phase !== "playing"}>Partie beenden</Button>
              </Confirm>
            </div>

            <form className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!message.trim()) return; void act({ type: "message", text: message }, "Nachricht ist im Raum angekommen.").then(() => setMessage("")); }}>
              <Label htmlFor="room-msg">Nachricht an alle im Raum</Label>
              <div className="flex gap-2">
                <Input id="room-msg" value={message} maxLength={MAX_NOTICE} onChange={(e) => setMessage(e.target.value)} placeholder="z. B. Gleich startet eine Wartung" />
                <Button type="submit" size="icon" disabled={busy || !message.trim()} aria-label="Nachricht senden"><Send /></Button>
              </div>
            </form>

            <section className="grid gap-1.5">
              <h3 className="text-sm font-semibold">Leute <span className="font-normal text-muted-foreground">· {room.players.filter((p) => p.online).length} online{room.call ? ` · ${room.call} im Anruf` : ""}{room.chat ? ` · ${room.chat} Chat-Nachrichten` : ""}</span></h3>
              {room.players.length === 0 && <p className="text-sm text-muted-foreground">Noch niemand drin. Wer zuerst kommt, ist Host.</p>}
              <ul className="grid gap-1">
                {room.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl bg-navy-800/50 py-1 pr-1 pl-3 text-sm" data-testid={`room-player-${p.name}`}>
                    <span className={cn("size-2 shrink-0 rounded-full", p.online ? "bg-ok" : "bg-muted-foreground/40")} aria-label={p.online ? "online" : "offline"} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    {p.id === room.hostId && <span className="flex items-center gap-1 text-xs font-semibold text-primary"><Crown className="size-3.5" />Host</span>}
                    {p.bench && <span className="text-xs text-muted-foreground">wartet</span>}
                    {p.id !== room.hostId && !p.bench && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} aria-label={`${p.name} zum Host machen`}
                        onClick={() => void act({ type: "host", id: p.id }, `${p.name} ist jetzt Host.`, room.hostId ? { type: "host", id: room.hostId } : undefined)}>
                        Host machen
                      </Button>
                    )}
                    <Confirm title={`${p.name} entfernen?`} description="Fliegt aus dem Raum und kommt mit diesem Handy nicht wieder herein." confirmLabel="Entfernen"
                      onConfirm={() => void act({ type: "kick", id: p.id }, `${p.name} ist entfernt.`)}>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive" disabled={busy} aria-label={`${p.name} entfernen`}><UserX /></Button>
                    </Confirm>
                  </li>
                ))}
              </ul>
              {room.knocks.length > 0 && <p className="text-sm text-muted-foreground">Vor der Tür: {room.knocks.join(", ")}</p>}
              {!host && room.players.length > 0 && <p className="text-xs text-muted-foreground">Gerade ohne Host – wer da ist, kann ihn übernehmen.</p>}
            </section>

            <section className="grid gap-3">
              <h3 className="-mb-1 text-sm font-semibold">Raum</h3>
              <RoomName value={room.access.name ?? ""} onSave={(name) => setAccess({ name }, name ? `Name: ${name}` : "Name entfernt")} />
              <Segmented label="Sichtbar für" value={room.access.visibility} options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
                onChange={(visibility) => setAccess({ visibility }, `Sichtbar für: ${VISIBILITY_LABEL[visibility]}`)} />
              <Segmented label="Einlass" value={room.access.admission} options={ADMISSIONS.map((v) => ({ value: v, label: ADMISSION_LABEL[v] }))}
                onChange={(admission) => setAccess({ admission }, `Einlass: ${ADMISSION_LABEL[admission]}`)} />
              <Segmented label="Bleibt leer bestehen" value={room.access.life} options={LIVES}
                onChange={(life) => setAccess({ life }, life === "forever" ? "Ist jetzt ein Dauerraum" : `Lebensdauer: ${LIFE_LABEL[life]}`)} />
              <form className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); void act({ type: "pin", pin }, "Neue PIN gilt ab sofort.").then(() => setPin("")); }}>
                <Label htmlFor="room-pin">Neue PIN <span className="font-normal text-muted-foreground">(wer drin ist, bleibt drin)</span></Label>
                <div className="flex gap-2">
                  <Input id="room-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="off" className="tracking-[0.3em]" placeholder="4–8 Ziffern" />
                  <Button type="submit" variant="secondary" disabled={busy || !/^\d{4,8}$/.test(pin)}>Setzen</Button>
                </div>
              </form>
            </section>

            <Confirm title={`Raum ${code} schließen?`} description="Alle fliegen raus, der Spielstand wird gelöscht." confirmLabel="Schließen" onConfirm={() => void simple("close", `Raum ${code} ist geschlossen.`)}>
              <Button variant="destructive" disabled={busy}>Raum schließen</Button>
            </Confirm>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Raumname: speichert beim Verlassen des Felds */
function RoomName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { const v = cleanRoomName(draft); if (v !== value) onSave(v); };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="room-name">Name</Label>
      <Input id="room-name" value={draft} maxLength={MAX_ROOM_NAME} placeholder="ohne Namen" onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}
