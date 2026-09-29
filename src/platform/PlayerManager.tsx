import { useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { getGame } from "@shared/games";
import { MAX_NAME, MAX_PLAYERS, type RoomAction, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confirm } from "@/components/Confirm";
import { cn } from "@/lib/utils";

/** Spielerliste mit Reihenfolge und Entfernen. Nur der Host (oder lokal) kann bearbeiten. */
export function PlayerManager({ room, me, online, editable, dispatch, onAddLocal }: {
  room: RoomState;
  me: string | null;
  online: Set<string> | null;
  editable: boolean;
  dispatch: (a: RoomAction) => void;
  onAddLocal?: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const add = () => { if (!name.trim() || !onAddLocal) return; onAddLocal(name); setName(""); };
  const max = Math.min(MAX_PLAYERS, getGame(room.gameId).info.maxPlayers);

  return (
    <div>
      <ol className="grid gap-1.5">
        {room.players.map((p, i) => (
          <li key={p.id} className="flex h-13 items-center gap-2.5 glass rounded-xl pr-1.5 pl-4">
            <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{i + 1}</span>
            {online && <span className={cn("size-2 shrink-0 rounded-full", online.has(p.id) ? "bg-emerald-400" : "bg-foreground/25")} />}
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

      {onAddLocal && room.players.length < max && (
        <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={MAX_NAME} autoComplete="off" enterKeyHint="done" aria-label="Name des Spielers" />
          <Button type="submit" disabled={!name.trim()}>Hinzufügen</Button>
        </form>
      )}
    </div>
  );
}
