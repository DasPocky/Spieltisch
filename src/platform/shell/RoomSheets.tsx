import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { PIN_RE, ROOM_CODE_RE } from "@shared/platform/protocol";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gameIcon } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { useBackClose } from "@/hooks/useBackClose";
import { createRoom } from "@/lib/createRoom";
import { NAME_KEY } from "@/lib/storage";
import { IconTile } from "@/platform/Logo";
import { accessSummary, RoomAccessForm } from "@/platform/RoomAccessForm";
import { DEFAULT_ACCESS, type RoomAccess } from "@shared/platform/directory";
import { cn } from "@/lib/utils";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Was „Raum öffnen“ anlegt: Spiel (vorgewählt oder in der Lobby wählen) bzw. erst einmal nur Treffpunkt */
export interface RoomPlan { gameId: string; pickGame: boolean; meet?: boolean }

/** Name und PIN – mehr braucht ein neuer Raum nicht. Der Name ist aus dem Profil vorausgefüllt. */
export function CreateRoomForm({ plan }: { plan: RoomPlan }) {
  const [name, setName] = useState(() => read(NAME_KEY) ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [access, setAccess] = useState<RoomAccess>(DEFAULT_ACCESS);
  const ok = cleanName(name).length > 0 && PIN_RE.test(pin);
  const create = async () => {
    setBusy(true); setError(null);
    try { await createRoom({ name, pin, gameId: plan.gameId, pickGame: plan.pickGame, meet: plan.meet, room: access, replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : "Keine Verbindung zum Server."); }
    finally { setBusy(false); }
  };
  const Icon = gameIcon(plan.gameId);
  return (
    <form className="grid gap-3.5" data-testid="create-room" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) void create(); }}>
      {!plan.pickGame && !plan.meet && (
        <p className="flex items-center gap-2.5 rounded-2xl bg-primary/10 p-2 pr-3 text-sm">
          <IconTile className="size-9 shrink-0 rounded-xl"><Icon className="size-5.5" /></IconTile>
          <span className="min-w-0"><b>{getGame(plan.gameId).info.name}</b> steht im Raum gleich bereit.</span>
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="name">Dein Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="nickname" placeholder="Name" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pin">PIN für den Raum (4–8 Ziffern)</Label>
        <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric" autoComplete="off" placeholder="z. B. 4711" className="tracking-[0.3em]" />
      </div>
      {/* Extras eingeklappt: im Normalfall reicht die PIN */}
      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} data-testid="room-more"
        className="-my-1 flex items-center gap-2 rounded-xl py-1 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        <span className="font-semibold text-primary">Mehr</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{access.name ? `${access.name} · ` : ""}{accessSummary(access)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", more && "rotate-180")} />
      </button>
      {more && <RoomAccessForm value={access} onChange={setAccess} idPrefix="new-room" />}
      <Button type="submit" size="lg" disabled={!ok || busy}>{busy && <Loader2 className="animate-spin" />}Öffnen</Button>
      <p className="-mt-1 text-sm text-muted-foreground">Mitspieler brauchen Raumcode und PIN. Du bist Host{plan.meet ? " – ein Spiel geht jederzeit." : plan.pickGame ? " und wählst gleich das Spiel." : "."}</p>
      {error && <p role="alert" className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
    </form>
  );
}

/** „Raum öffnen“ als Blatt von unten */
export function CreateRoomSheet({ plan, onClose }: { plan: RoomPlan | null; onClose: () => void }) {
  useBackClose(!!plan, onClose);
  return (
    <Sheet open={!!plan} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Name steht schon da: gleich in die PIN */}
      <SheetContent onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById(read(NAME_KEY) ? "pin" : "name")?.focus(); }}>
        <SheetHeader>
          <SheetTitle>{plan?.meet ? "Treffpunkt öffnen" : "Raum öffnen"}</SheetTitle>
          <SheetDescription>{plan?.meet ? "Reden, sehen, schreiben – spielen später" : "Jeder spielt am eigenen Handy"}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{plan && <CreateRoomForm plan={plan} />}</div>
      </SheetContent>
    </Sheet>
  );
}

/** Raumcode aus Eingabe oder eingefügtem Link (…/r/ABCDE) */
const codeOf = (v: string) => {
  const link = v.match(/\/r\/([A-Za-z0-9]{5})/);
  return (link ? link[1] : v).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
};

/** „Beitreten“: Raumcode eingeben (oder Link einfügen), danach fragt der Raum nach Name und PIN */
export function JoinSheet({ open, onClose, online }: { open: boolean; onClose: () => void; online: boolean }) {
  const [code, setCode] = useState("");
  const ok = ROOM_CODE_RE.test(code);
  useBackClose(open, onClose);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Raum beitreten</SheetTitle>
          <SheetDescription>Den Code bekommst du vom Host – oder öffne einfach den Link.</SheetDescription>
        </SheetHeader>
        <form className="grid gap-3 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); if (ok && online) navigate(`/r/${code}`, true); }}>
          <Input id="code" aria-label="Raumcode" value={code} onChange={(e) => setCode(codeOf(e.target.value))} autoFocus
            autoComplete="off" autoCapitalize="characters" placeholder="Raumcode"
            className="h-14 text-center text-2xl font-semibold tracking-[0.4em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
          <Button type="submit" size="lg" disabled={!ok || !online}>{online ? "Weiter" : "Braucht Netz – offline"}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
