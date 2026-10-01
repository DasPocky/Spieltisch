import { useState } from "react";
import { ArrowUp, Plus, X } from "lucide-react";
import { getGame } from "@shared/games";
import type { Avatar as AvatarData } from "@shared/platform/group";
import { MAX_NAME, MAX_PLAYERS, type RoomAction, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confirm } from "@/components/Confirm";
import { cn } from "@/lib/utils";
import { useActiveGroup } from "@/lib/group";
import { Avatar } from "./Avatar";

/** Spieler aus der aktiven Gruppe – damit das Ergebnis der Partie in der Bestenliste landet */
export interface GroupPick { code: string; member: string; avatar: AvatarData }

/** Spielerliste mit Reihenfolge und Entfernen. Nur der Host (oder lokal) kann bearbeiten. */
export function PlayerManager({ room, me, online, editable, dispatch, onAddLocal }: {
  room: RoomState;
  me: string | null;
  online: Set<string> | null;
  editable: boolean;
  dispatch: (a: RoomAction) => void;
  onAddLocal?: (name: string, from?: GroupPick) => void;
}) {
  const [name, setName] = useState("");
  const add = () => { if (!name.trim() || !onAddLocal) return; onAddLocal(name); setName(""); };
  const max = Math.min(MAX_PLAYERS, getGame(room.gameId).info.maxPlayers);
  // Mitglieder der aktiven Gruppe, die noch nicht mitspielen – ein Tipp genügt
  const group = useActiveGroup();
  const taken = new Set(Object.values(room.members ?? {}));
  const names = new Set(room.players.map((p) => p.name.toLowerCase()));
  const picks = onAddLocal && group ? group.members.filter((m) => !taken.has(m.id) && !names.has(m.name.toLowerCase())) : [];

  return (
    <div>
      <ol className="grid gap-1.5">
        {room.players.map((p, i) => (
          <li key={p.id} className="flex h-13 items-center gap-2.5 glass rounded-xl pr-1.5 pl-4">
            <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="relative shrink-0">
              <Avatar avatar={room.avatars?.[p.id]} name={p.name} className="size-8" />
              {online && <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background", online.has(p.id) ? "bg-ok" : "bg-foreground/30")}
                aria-label={online.has(p.id) ? "online" : "offline"} />}
            </span>
            <span className="flex-1 truncate font-semibold">
              {p.name}
              {p.id === me && <span className="font-normal text-muted-foreground"> (du)</span>}
              {online && p.id === room.hostId && <span className="font-normal text-muted-foreground"> · Host</span>}
            </span>
            {editable && (
              <>
                {i > 0 && (
                  <Button variant="ghost" size="icon" aria-label={`${p.name} nach oben`} onClick={() => dispatch({ type: "movePlayer", id: p.id, dir: -1 })}>
                    <ArrowUp />
                  </Button>
                )}
                <Confirm
                  title={`${p.name} entfernen?`}
                  description={online ? "Die Person fliegt aus dem Raum und müsste mit PIN neu beitreten." : undefined}
                  confirmLabel="Entfernen"
                  onConfirm={() => dispatch({ type: "removePlayer", id: p.id })}
                >
                  <Button variant="ghost" size="icon" aria-label={`${p.name} entfernen`} className="text-muted-foreground"><X /></Button>
                </Confirm>
              </>
            )}
          </li>
        ))}
      </ol>

      {picks.length > 0 && room.players.length < max && (
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

      {onAddLocal && room.players.length < max && (
        <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={MAX_NAME} autoComplete="off" enterKeyHint="done" aria-label="Name des Spielers" />
          <Button type="submit" disabled={!name.trim()}>Hinzufügen</Button>
        </form>
      )}
    </div>
  );
}
