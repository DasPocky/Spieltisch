import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Layers, Loader2, Plus } from "lucide-react";
import { kindOfGame, MAX_SETS_IN_GAME, ownEnough, OWN_MIN, SET_KINDS, type CardSetInfo, type SetKind } from "@shared/platform/cardsets";
import type { RoomAction, RoomSet, RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { navigate } from "@/hooks/useRoute";
import { cacheSet, mySets, publicSets } from "@/lib/cardsets";
import { RETURN_KEY } from "@/lib/storage";

/** Gewählte Sets dieser Art im Raum (ältere Einträge ohne Art zählen mit) */
export const setsFor = (room: RoomState, kind: SetKind | null): RoomSet[] => (kind ? (room.sets ?? []).filter((s) => !s.kind || s.kind === kind) : []);

/**
 * Lobby: eigene oder freigegebene Kartensets fürs gewählte Spiel. Wählen darf der Host (lokal: jeder);
 * „Nur eigene …“ (`ownToggle`) geht erst, wenn die gewählten Sets genug Inhalt haben.
 * Lokal merkt sich das Gerät die Inhalte, damit sie auch ohne Netz da sind.
 */
export function SetPicker({ room, editable, online, dispatch, ownToggle }: {
  room: RoomState; editable: boolean; online: boolean; dispatch: (a: RoomAction) => void; ownToggle?: (enough: boolean) => ReactNode;
}) {
  const kind = kindOfGame(room.gameId);
  const chosen = setsFor(room, kind);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<CardSetInfo[] | null>(null);
  const [shared, setShared] = useState<CardSetInfo[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Infos zu den gewählten Sets (für „genug Inhalt?“) – einmal laden, wenn es etwas zu wählen gibt
  useEffect(() => {
    if (!kind || !editable || (!open && !chosen.length)) return;
    let on = true;
    setError(null);
    Promise.all([mySets(kind).catch(() => [] as CardSetInfo[]), publicSets(kind)])
      .then(([m, p]) => { if (on) { setMine(m); setShared(p.filter((x) => !m.some((y) => y.id === x.id))); } })
      .catch((e: Error) => { if (on) { setError(e.message); setMine((m) => m ?? []); setShared((s) => s ?? []); } });
    return () => { on = false; };
  }, [kind, editable, open, chosen.length]);

  if (!kind) return null;
  const info = SET_KINDS.find((k) => k.id === kind)!;
  const all = [...(mine ?? []), ...(shared ?? [])];
  const infos = chosen.map((c) => all.find((x) => x.id === c.id)).filter((x): x is CardSetInfo => !!x);
  const enough = ownEnough(kind, infos, room.players.length || 1);

  const start = () => { setPicked(chosen.map((c) => c.id)); setOpen(true); };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_SETS_IN_GAME ? (toast(`Höchstens ${MAX_SETS_IN_GAME} Sets je Spiel.`), p) : [...p, id]));
  const done = async () => {
    const sets = picked.map((id) => all.find((x) => x.id === id)).filter((x): x is CardSetInfo => !!x).map((x) => ({ id: x.id, name: x.name, kind }));
    setBusy(true);
    try {
      // Lokal (ein Handy für alle): Inhalte jetzt holen und merken – gestartet wird ohne Server
      if (!online) await Promise.all(sets.map((s) => cacheSet(s.id)));
      const others = (room.sets ?? []).filter((s) => s.kind && s.kind !== kind);
      dispatch({ type: "setSets", sets: [...others, ...sets] });
      setOpen(false);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const goEdit = () => { try { sessionStorage.setItem(RETURN_KEY, location.pathname); } catch { /* egal */ } navigate("/profil/sets"); };

  const row = (s: CardSetInfo) => (
    <label key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-border">
      <Checkbox checked={picked.includes(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={s.name} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-semibold">{s.name}</span>
        <span className="block text-xs text-muted-foreground">{s.kind === "schamlos" ? `${s.black ?? 0} schwarze · ${s.white ?? 0} weiße` : `${s.count} ${info.item}`}{s.owner === "" ? ` · ${s.by ? `von ${s.by}` : "Community-Set"}` : ""}</span>
      </span>
    </label>
  );

  return (
    <section className="grid gap-2" data-testid="set-picker">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Layers className="size-4 text-primary" />Eigene Kartensets</h4>
      {chosen.length > 0
        ? <ul className="flex flex-wrap gap-1.5">{chosen.map((c) => <li key={c.id} className="rounded-full bg-primary/12 px-2.5 py-1 text-sm font-semibold text-primary">{c.name}</li>)}</ul>
        : <p className="text-xs text-muted-foreground">Keine – es spielen die eingebauten {info.item}.</p>}
      {editable && <Button variant="secondary" onClick={start} data-testid="set-pick">{chosen.length ? "Sets ändern" : "Eigene Sets wählen"}</Button>}
      {chosen.length > 0 && ownToggle?.(enough)}
      {chosen.length > 0 && editable && !enough && mine && (
        <p className="text-xs text-muted-foreground">
          „Nur eigene“ geht ab {kind === "schamlos" ? `${OWN_MIN.schamlos} schwarzen und ${(room.players.length || 1) * 7 + 10} weißen Karten` : `${OWN_MIN[kind]} ${info.item}`} – bis dahin mischen sich die eingebauten dazu.
        </p>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Eigene Sets: {info.name}</SheetTitle>
            <SheetDescription>Bis zu {MAX_SETS_IN_GAME} Sets – sie mischen sich zu den eingebauten {info.item}.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 overflow-y-auto px-5 pt-1 pb-3">
            {error && <p role="alert" className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
            {!mine || !shared ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /> : (
              <>
                <section className="grid gap-1.5" aria-label="Meine Sets">
                  <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Meine Sets</h3>
                  {mine.length ? mine.map(row) : <p className="px-1 text-sm text-muted-foreground">Noch keine eigenen Sets für {info.name}.</p>}
                  <Button variant="outline" size="sm" onClick={goEdit}><Plus />Set anlegen oder bearbeiten</Button>
                </section>
                <section className="grid gap-1.5" aria-label="Für alle freigegeben">
                  <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Für alle freigegeben</h3>
                  {shared.length ? shared.map(row) : <p className="px-1 text-sm text-muted-foreground">Noch keine freigegebenen Sets.</p>}
                </section>
              </>
            )}
          </div>
          <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button className="w-full" disabled={busy || !mine} onClick={() => void done()} data-testid="set-pick-done">{busy && <Loader2 className="animate-spin" />}{picked.length ? `${picked.length} ${picked.length === 1 ? "Set" : "Sets"} übernehmen` : "Ohne eigene Sets"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
