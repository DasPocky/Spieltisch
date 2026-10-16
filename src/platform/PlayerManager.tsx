import { useContext, useState } from "react";
import { ArrowDown, ArrowUp, Bot, Plus, Shuffle, X } from "lucide-react";
import { getGame } from "@shared/games";
import type { Avatar as AvatarData } from "@shared/platform/group";
import { MAX_NAME, MAX_PLAYERS, type RoomAction, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confirm } from "@/components/Confirm";
import { cn } from "@/lib/utils";
import { useActiveGroup } from "@/lib/group";
import { useDev } from "@/lib/dev";
import { Avatar, AvatarContext, AvatarPicker } from "./Avatar";
import { Bubble } from "./chat/Chat";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Spieler aus der aktiven Gruppe – damit das Ergebnis der Partie in der Bestenliste landet */
export interface GroupPick { code: string; member: string; avatar: AvatarData }

/** Spielerliste mit Reihenfolge und Entfernen. Nur der Host (oder lokal) kann bearbeiten. */
export function PlayerManager({ room, me, online, editable, dispatch, onAddLocal }: {
  room: RoomState;
  me: string | null;
  online: Set<string> | null;
  editable: boolean;
  dispatch: (a: RoomAction) => void;
  onAddLocal?: (name: string, from?: GroupPick, bot?: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const avatars = useContext(AvatarContext) ?? {};
  const editing = room.players.find((p) => p.id === edit) ?? null;
  // Ab 5 Spielern zwei Spalten – so passen auch 8 ohne Scrollen auf den Schirm
  const two = room.players.length > 4;
  const shuffle = () => {
    const ids = room.players.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    dispatch({ type: "orderPlayers", ids });
  };
  const devOn = useDev().on;
  const add = () => { if (!name.trim() || !onAddLocal) return; onAddLocal(name); setName(""); };
  const max = Math.min(MAX_PLAYERS, getGame(room.gameId).info.maxPlayers);
  // Mitglieder der aktiven Gruppe, die noch nicht mitspielen – ein Tipp genügt
  const group = useActiveGroup();
  const taken = new Set(Object.values(room.members ?? {}));
  const bench = room.bench ?? [];
  const names = new Set([...room.players, ...bench].map((p) => p.name.toLowerCase()));
  const picks = onAddLocal && group ? group.members.filter((m) => !taken.has(m.id) && !names.has(m.name.toLowerCase())) : [];

  return (
    <div>
      {editable && room.players.length > 2 && room.phase === "lobby" && (
        <div className="mb-1.5 flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={shuffle}><Shuffle className="size-3.5" />Mischen</Button>
        </div>
      )}
      <ol className={cn("grid gap-1.5", two && "grid-cols-2")} data-testid="players">
        {room.players.map((p, i) => {
          const mine = me === null || p.id === me || editable;
          return (
            <li key={p.id} className={cn("glass relative flex min-w-0 items-center rounded-xl", two ? "h-12 gap-1.5 pr-0.5 pl-1.5" : "h-13 gap-2.5 pr-1.5 pl-2")}>
              <Bubble playerId={p.id} side />
              <button type="button" disabled={!mine} onClick={() => setEdit(p.id)} aria-label={`Avatar von ${p.name} ändern`}
                className="relative shrink-0 rounded-full outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default">
                <Avatar avatar={avatars[p.id]} name={p.name} className={two ? "size-8" : "size-9 text-[1.2em]"} />
                <span className="absolute -top-1 -left-1 grid size-4 place-items-center rounded-full bg-background text-[0.6rem] font-bold tabular-nums ring-1 ring-border">{i + 1}</span>
                {online && <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background", online.has(p.id) ? "bg-ok" : "bg-foreground/30")}
                  aria-label={online.has(p.id) ? "online" : "offline"} />}
              </button>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-semibold" title={p.name}>
                  {p.name}
                  {p.id === me && <span className="font-normal text-muted-foreground"> (du)</span>}
                  {!two && online && p.id === room.hostId && <span className="font-normal text-muted-foreground"> · Host</span>}
                </span>
                {two && online && p.id === room.hostId && <span className="block text-[0.7rem] text-muted-foreground">Host</span>}
              </span>
              {editable && !two && i > 0 && (
                <Button variant="ghost" size="icon" aria-label={`${p.name} nach oben`} onClick={() => dispatch({ type: "movePlayer", id: p.id, dir: -1 })}>
                  <ArrowUp />
                </Button>
              )}
              {/* Online kann sich der Host nicht selbst entfernen – dafür gibt es „Raum verlassen“ */}
              {editable && p.id !== me && <Confirm
                title={`${p.name} entfernen?`}
                description={online ? "Die Person fliegt aus dem Raum und müsste mit PIN neu beitreten." : undefined}
                confirmLabel="Entfernen"
                onConfirm={() => dispatch({ type: "removePlayer", id: p.id })}
              >
                <Button variant="ghost" size="icon" aria-label={`${p.name} entfernen`} className={cn("text-muted-foreground", two && "size-9")}><X /></Button>
              </Confirm>}
            </li>
          );
        })}
      </ol>
      <Sheet open={!!editing} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing?.name}</SheetTitle>
            <SheetDescription>Tier und Farbe – so erkennt ihr euch im Spiel.</SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="grid gap-4 px-4 pb-6">
              <AvatarPicker value={avatars[editing.id]} onChange={(avatar) => dispatch({ type: "setAvatar", id: editing.id, avatar })} />
              {editable && room.phase === "lobby" && room.players.length > 1 && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={room.players[0]?.id === editing.id} onClick={() => dispatch({ type: "movePlayer", id: editing.id, dir: -1 })}><ArrowUp />Weiter vor</Button>
                  <Button variant="secondary" disabled={room.players.at(-1)?.id === editing.id} onClick={() => dispatch({ type: "movePlayer", id: editing.id, dir: 1 })}><ArrowDown />Weiter hinten</Button>
                </div>
              )}
              <SheetClose asChild><Button>Fertig</Button></SheetClose>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mitten in der Partie dazugekommen: spielt ab der nächsten Partie mit */}
      {bench.length > 0 && (
        <div className="mt-2.5" data-testid="bench">
          <div className="mb-1.5 px-1 text-xs text-muted-foreground">Ab der nächsten Partie dabei</div>
          <ul className="grid gap-1.5">
            {bench.map((p) => (
              <li key={p.id} className="flex h-11 items-center gap-2.5 rounded-xl pr-1.5 pl-4 ring-1 ring-inset ring-border ring-dashed">
                <Avatar avatar={room.avatars?.[p.id]} name={p.name} className="size-7" />
                <span className="flex-1 truncate font-semibold">{p.name}{p.id === me && <span className="font-normal text-muted-foreground"> (du)</span>}</span>
                {editable && p.id !== me && (
                  <Button variant="ghost" size="icon" aria-label={`${p.name} entfernen`} className="text-muted-foreground" onClick={() => dispatch({ type: "removePlayer", id: p.id })}><X /></Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {picks.length > 0 && room.players.length + bench.length < max && (
        <div className="mt-2.5" data-testid="group-picks">
          <div className="mb-1.5 px-1 text-xs text-muted-foreground">Aus {group!.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {picks.map((m) => (
              <button key={m.id} type="button" aria-label={`${m.name} hinzufügen`}
                onClick={() => onAddLocal!(m.name, { code: group!.code, member: m.id, avatar: m.avatar })}
                className="glass flex h-9 items-center gap-1.5 rounded-full pr-3 pl-1 text-sm font-semibold outline-none transition active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring">
                <Avatar avatar={m.avatar} className="size-7" />
                <Plus className="size-3.5 text-muted-foreground" />{m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {onAddLocal && room.players.length + bench.length < max && (
        <>
          <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={MAX_NAME} autoComplete="off" enterKeyHint="done" aria-label="Name des Spielers" />
            <Button type="submit" disabled={!name.trim()}>Hinzufügen</Button>
          </form>
          {devOn && (
            <Button variant="ghost" size="sm" className="mt-1.5 text-muted-foreground" onClick={() => {
              const taken = new Set([...room.players, ...bench].map((p) => p.name.toLowerCase()));
              let k = 1;
              while (taken.has(`bot ${k}`)) k++;
              onAddLocal(`Bot ${k}`, undefined, true);
            }}><Bot />Bot dazu <span className="font-normal">(Entwickler-Modus)</span></Button>
          )}
          {room.phase === "playing" && !getGame(room.gameId).joinMidGame && (
            <p className="mt-1.5 px-1 text-xs text-muted-foreground">Kommt mitten in der Partie dazu und spielt ab der nächsten Partie mit („Nochmal“).</p>
          )}
        </>
      )}
    </div>
  );
}
