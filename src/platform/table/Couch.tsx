import { useEffect, useRef, useState } from "react";
import { Camera, EyeOff, UserPlus, X } from "lucide-react";
import { cleanName, currentPlayerId, MAX_NAME, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoom } from "@/hooks/useRoom";
import { readJSON, writeJSON } from "@/lib/storage";
import { RoomScreen } from "@/platform/RoomScreen";
import { TableCamera } from "./Camera";

/**
 * Mitspielen ohne Handy: der Fernseher meldet Spieler als ganz normale Mitspieler an (eigener Zugang je Platz)
 * und zeigt ihre Hand am Fernseher – immer erst hinter einem Sichtschutz („alle anderen schauen weg“).
 * Ist ein Couch-Spieler dran, öffnet sich seine Hand von selbst (verdeckt).
 */
export interface CouchSeat { slot: string; name: string }

const listKey = (code: string) => `spieltisch:couch:${code}`;
const MAX_COUCH = 6;

export function useCouch(code: string) {
  const [list, setList] = useState<CouchSeat[]>(() => readJSON<CouchSeat[]>(listKey(code)) ?? []);
  const save = (next: CouchSeat[]) => { setList(next); writeJSON(listKey(code), next); };
  return {
    list,
    add: (name: string) => {
      const n = cleanName(name);
      if (!n || list.length >= MAX_COUCH) return;
      save([...list, { slot: Math.random().toString(36).slice(2, 8), name: n }]);
    },
    remove: (slot: string) => save(list.filter((c) => c.slot !== slot)),
  };
}

/** Name eingeben – mit Tastatur oder Fernbedienung, Enter schickt ab */
export function CouchAdd({ onAdd, full }: { onAdd: (name: string) => void; full: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (full) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="couch-add"
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-[#f7ecd6] outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]">
        <UserPlus className="size-4" />Ohne Handy mitspielen
      </button>
    );
  }
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!cleanName(name)) return; onAdd(name); setName(""); setOpen(false); }}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="Name" aria-label="Name für den Platz am Fernseher"
        className="h-10 bg-white text-[#2b2118]" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      <Button type="submit" className="h-10" disabled={!cleanName(name)} data-testid="couch-add-ok">Dazu</Button>
    </form>
  );
}

/**
 * Alle Couch-Spieler: je einer eine eigene Verbindung (unsichtbar). Liste in der Seitenleiste mit „Hand zeigen“;
 * die Hand erscheint als Handy-Ansicht links über dem Tisch.
 */
export function CouchPlayers({ code, pin, room, couch, onOpen, cover }: { code: string; pin: string; room: RoomState; couch: ReturnType<typeof useCouch>; onOpen?: (open: boolean) => void; /** zählt hoch, wenn die Fernbedienung „Hand verdecken“ schickt */ cover?: number }) {
  const [ids, setIds] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { onOpen?.(open !== null); }, [open, onOpen]);
  useEffect(() => { if (cover) setOpen(null); }, [cover]);
  const [revealed, setRevealed] = useState(false);
  // Selfie für einen Platz (Kamera am Bildschirm)
  const [snap, setSnap] = useState<string | null>(null);
  const cur = currentPlayerId(room);
  const curSlot = couch.list.find((c) => ids[c.slot] && ids[c.slot] === cur)?.slot ?? null;

  // Ein Couch-Spieler ist dran: seine Hand öffnet sich (verdeckt); ist er fertig, geht sie wieder zu
  const auto = useRef<string | null>(null);
  useEffect(() => {
    const was = auto.current;
    auto.current = curSlot;
    if (curSlot === was) return;
    if (curSlot) { setOpen(curSlot); setRevealed(false); }
    else setOpen((o) => (o === was ? null : o));
  }, [curSlot]);

  const show = (slot: string) => { setOpen(slot); setRevealed(room.phase !== "playing"); };

  return (
    <>
      {couch.list.length > 0 && (
        <div className="grid gap-1.5" data-testid="couch-list">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#f7ecd6]/70">Am Fernseher</div>
          {couch.list.map((c) => (
            <div key={c.slot} className="flex items-center gap-2">
              <button type="button" onClick={() => (open === c.slot ? setOpen(null) : show(c.slot))} data-testid="couch-open"
                className="flex h-9 min-w-0 flex-1 items-center rounded-lg bg-white/10 px-3 text-left text-sm font-semibold text-[#f7ecd6] outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]">
                <span className="truncate">{c.name}{ids[c.slot] === room.hostId ? " · Host" : ""}</span>
                <span className="ml-auto pl-2 text-xs opacity-75">{open === c.slot ? "zu" : room.phase === "playing" ? "Hand" : "öffnen"}</span>
              </button>
              <button type="button" aria-label={`Foto für ${c.name}`} title="Foto mit der Kamera am Bildschirm" onClick={() => setSnap(c.slot)} data-testid="couch-photo"
                className="grid size-9 place-items-center rounded-lg text-[#f7ecd6]/70 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]"><Camera className="size-4" /></button>
              {room.phase !== "playing" && (
                <button type="button" aria-label={`${c.name} entfernen`} onClick={() => { if (open === c.slot) setOpen(null); couch.remove(c.slot); }}
                  className="grid size-9 place-items-center rounded-lg text-[#f7ecd6]/70 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]"><X className="size-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {couch.list.map((c) => (
        <CouchConnection key={c.slot} code={code} pin={pin} seat={c} shown={open === c.slot} revealed={revealed} snapping={snap === c.slot} onSnapped={() => setSnap(null)}
          onReveal={() => setRevealed(true)} onClose={() => setOpen(null)} onId={(id) => setIds((m) => (m[c.slot] === id ? m : { ...m, [c.slot]: id }))} />
      ))}
    </>
  );
}

function CouchConnection({ code, pin, seat, shown, revealed, snapping, onSnapped, onReveal, onClose, onId }: {
  code: string; pin: string; seat: CouchSeat; shown: boolean; revealed: boolean; snapping: boolean; onSnapped: () => void; onReveal: () => void; onClose: () => void; onId: (id: string) => void;
}) {
  const [join] = useState(() => ({ name: seat.name, pin }));
  const room = useRoom(code, join, 0, { slot: seat.slot });
  useEffect(() => { if (room.me) onId(room.me); }, [room.me, onId]);
  // Enter deckt auf, Escape schließt (Fernbedienung, Tastatur)
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && !revealed) { e.preventDefault(); onReveal(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [shown, revealed, onReveal, onClose]);
  const camera = snapping ? <TableCamera name={seat.name} onShot={(data) => room.photo(data)} onClose={onSnapped} /> : null;
  if (!shown) return camera;

  return (
    <>{camera}
    <div className="couch-hand fixed inset-y-0 left-0 z-30 flex w-[min(30rem,100vw)] flex-col bg-background text-foreground shadow-2xl" data-testid="couch-hand">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <b className="min-w-0 flex-1 truncate">{seat.name} am Fernseher</b>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="couch-close"><EyeOff className="size-4" />Verdecken</Button>
      </div>
      {!revealed ? (
        <button type="button" onClick={onReveal} autoFocus data-testid="couch-reveal"
          className="grid flex-1 place-items-center p-8 text-center outline-none focus-visible:ring-4 focus-visible:ring-ring">
          <span className="grid gap-3">
            <span className="text-3xl font-bold">{seat.name} ist dran</span>
            <span className="text-muted-foreground">Alle anderen schauen kurz weg.</span>
            <span className="mx-auto mt-2 rounded-2xl bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground">Ich bin {seat.name} – Karten zeigen</span>
          </span>
        </button>
      ) : room.state && room.me ? (
        <div className="min-h-0 flex-1 overflow-y-auto [&>div]:h-full">
          <RoomScreen room={room.state} me={room.me} online={room.online} code={code} reconnecting={room.status === "connecting"} pending={room.pending}
            dispatch={room.send} onLeave={onClose} onCloseRoom={room.closeRoom} onClaimHost={room.claimHost} />
        </div>
      ) : (
        <p className="grid flex-1 place-items-center text-muted-foreground">{room.error ?? "Verbinde …"}</p>
      )}
    </div>
    </>
  );
}
