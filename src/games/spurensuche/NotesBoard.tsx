import { useEffect, useMemo, useState } from "react";
import { CheckCheck, ListPlus, PenLine, Trash2, Trophy, UserRound } from "lucide-react";
import type { SpAction, SpState } from "@shared/games/spurensuche/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BoardProps } from "@/games/types";
import { RulesSheet } from "@/platform/RulesSheet";
import { readStr, writeStr } from "@/lib/storage";
import { cn, vibrate } from "@/lib/utils";
import {
  between, cell, DEFAULT_CARDS, emptyNotes, GROUP_TITLE, infer, MARK_TEXT, nextMark, rowState, solutionOf, type Entry, type Group, type NoteCard, type Notes,
} from "./notes";

type Props = BoardProps<SpState, SpAction>;
const NAMES_KEY = "spieltisch:spurensuche:karten";

function useStored<T>(key: string, fallback: () => T): [T, (v: T) => void] {
  const read = () => { try { const raw = readStr(key); return raw ? (JSON.parse(raw) as T) : fallback(); } catch { return fallback(); } };
  const [v, setV] = useState<T>(read);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setV(read()), [key]);
  return [v, (next: T) => { setV(next); writeStr(key, JSON.stringify(next)); }];
}

/** Echtes Brettspiel: das Handy ist der persönliche Notizblock */
export function NotesBoard({ room, game: s, me, isHost, act }: Props) {
  const players = room.players.filter((p) => s.role[p.id]);
  const order = players.map((p) => p.id);
  const [cards, setCards] = useStored<NoteCard[]>(NAMES_KEY, () => DEFAULT_CARDS);
  const [notes, setNotes] = useStored<Notes>(`spieltisch:notes:spurensuche:${s.gid}:${me ?? "lokal"}`, () => emptyNotes(me));
  const self = me ?? notes.self;
  const auto = useMemo(() => infer({ ...notes, self }, cards, order), [notes, self, cards, order]);
  const sol = useMemo(() => solutionOf(cards, auto, order), [cards, auto, order]);
  const [sheet, setSheet] = useState<null | "mine" | "entry" | "names" | "finish" | "self">(null);
  const short = (id: string) => (id === self ? "Ich" : (players.find((p) => p.id === id)?.name ?? "?").slice(0, 4));
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  const tap = (card: string, pid: string) => {
    const c = cell(notes, auto, card, pid);
    if (c.auto) return;
    vibrate(5);
    const row = { ...(notes.marks[card] ?? {}), [pid]: nextMark(c.mark) };
    setNotes({ ...notes, marks: { ...notes.marks, [card]: row } });
  };

  const groups = (["s", "w", "r"] as Group[]).map((g) => [g, cards.filter((c) => c.group === g)] as const);
  const found = (["s", "w", "r"] as Group[]).map((g) => sol[g]).filter(Boolean) as string[];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-2 px-1 text-sm">
        <span className="min-w-0 flex-1 leading-tight" data-testid="notes-status">
          {!self ? "Wer bist du? Wähle deine Spalte." : !notes.mine.length ? <>Tippe zuerst auf <b>„Meine“</b> und markiere deine Karten.</> : found.length === 3 ? <b>Lösung: {found.map((id) => cards.find((c) => c.id === id)?.name).join(", ")}</b>
            : <>Ihr spielt am Brett – <b>dein Notizblock</b>. Antippen: ✗ ✓ ?</>}
        </span>
        <RulesSheet gameId={room.gameId} />
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setSheet(self ? "mine" : "self")} data-testid="mine-open"><UserRound className="size-4" />{self ? "Meine" : "Ich bin …"}</Button>
        <Button size="sm" onClick={() => setSheet("entry")} disabled={!self} data-testid="entry-open"><ListPlus className="size-4" />Verdacht</Button>
        <Button size="sm" variant="secondary" onClick={() => setSheet("names")} data-testid="names-open"><PenLine className="size-4" />Namen</Button>
        {isHost || me === null ? <Button size="sm" variant="secondary" onClick={() => setSheet("finish")} data-testid="finish-open"><Trophy className="size-4" />Gelöst</Button> : <span />}
      </div>

      {/* Der Zettel */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-paper p-1.5 text-paper-ink shadow-md" data-testid="sheet">
        <div className="grid h-full content-stretch gap-px" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${order.length}, minmax(1.9rem, 2.4rem))`, gridTemplateRows: `repeat(${cards.length + 4}, minmax(0, 1fr))` }}>
          <span />
          {order.map((pid) => <b key={pid} className={cn("grid place-items-center truncate text-[0.62rem] leading-none", pid === self && "text-primary")}>{short(pid)}</b>)}
          {groups.map(([g, list]) => [
            <b key={`h-${g}`} className="col-span-full flex items-end text-[0.62rem] font-bold tracking-wide text-muted-foreground uppercase">{GROUP_TITLE[g]}</b>,
            ...list.map((c) => {
              const st = rowState(auto, c.id, order);
              const isSol = sol[g] === c.id;
              return [
                <span key={`n-${c.id}`} className={cn("flex min-w-0 items-center truncate rounded-sm px-1 text-[clamp(0.62rem,1.6dvh,0.8rem)] leading-none",
                  st === "out" && "text-paper-ink/45 line-through", isSol && "bg-[#ffe9a8] font-bold")} data-testid={`row-${c.id}`}>{c.name}</span>,
                ...order.map((pid) => {
                  const v = cell(notes, auto, c.id, pid);
                  return (
                    <button key={`${c.id}-${pid}`} type="button" onClick={() => tap(c.id, pid)} aria-label={`${c.name} bei ${name(pid)}: ${v.mark === "x" ? "hat nicht" : v.mark === "y" ? "hat" : v.mark === "q" ? "vielleicht" : "leer"}`}
                      data-testid={`cell-${c.id}-${pid}`}
                      className={cn("grid place-items-center rounded-sm text-[clamp(0.7rem,1.8dvh,0.9rem)] leading-none font-bold ring-1 ring-inset ring-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        v.auto ? "bg-black/[0.06]" : "bg-white", v.mark === "y" ? "text-[#2f8a4a]" : v.mark === "x" ? "text-[#a8454f]" : "text-[#27477d]")}>
                      {MARK_TEXT[v.mark]}
                    </button>
                  );
                }),
              ];
            }),
          ])}
        </div>
      </div>

      <SelfSheet open={sheet === "self"} onClose={() => setSheet(null)} players={players} onPick={(id) => { setNotes({ ...notes, self: id }); setSheet("mine"); }} />
      <MineSheet open={sheet === "mine"} onClose={() => setSheet(null)} cards={cards} mine={notes.mine} onChange={(mine) => setNotes({ ...notes, mine })} />
      <EntrySheet open={sheet === "entry"} onClose={() => setSheet(null)} cards={cards} order={order} self={self} name={name} log={notes.log}
        onAdd={(e) => setNotes({ ...notes, log: [...notes.log, e] })} onRemove={(id) => setNotes({ ...notes, log: notes.log.filter((x) => x.id !== id) })} />
      <NamesSheet open={sheet === "names"} onClose={() => setSheet(null)} cards={cards} onChange={setCards} />
      <FinishSheet open={sheet === "finish"} onClose={() => setSheet(null)} players={players} onFinish={(w) => { setSheet(null); act({ type: "finish", winner: w }); }} />
    </div>
  );
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId}
      className={cn("min-w-0 truncate rounded-lg px-2 py-1.5 text-xs font-semibold ring-1 ring-inset outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        on ? "bg-primary text-primary-foreground ring-primary" : "bg-paper text-paper-ink ring-black/10")}>{children}</button>
  );
}

function Shell({ open, onClose, title, desc, children }: { open: boolean; onClose: () => void; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{desc}</SheetDescription></SheetHeader>
        <div className="grid gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function SelfSheet({ open, onClose, players, onPick }: { open: boolean; onClose: () => void; players: { id: string; name: string }[]; onPick: (id: string) => void }) {
  return (
    <Shell open={open} onClose={onClose} title="Wer bist du?" desc="Deine Spalte im Notizblock.">
      <div className="grid grid-cols-3 gap-1.5">{players.map((p) => <Chip key={p.id} on={false} onClick={() => onPick(p.id)} testId={`self-${p.id}`}>{p.name}</Chip>)}</div>
    </Shell>
  );
}

function MineSheet({ open, onClose, cards, mine, onChange }: { open: boolean; onClose: () => void; cards: NoteCard[]; mine: string[]; onChange: (m: string[]) => void }) {
  const toggle = (id: string) => onChange(mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]);
  return (
    <Shell open={open} onClose={onClose} title="Meine Karten" desc="Tippe alle Karten an, die du auf der Hand hast – sie fallen weg, alle anderen hast du nicht.">
      {(["s", "w", "r"] as Group[]).map((g) => (
        <div key={g} className="grid grid-cols-3 gap-1">
          {cards.filter((c) => c.group === g).map((c) => <Chip key={c.id} on={mine.includes(c.id)} onClick={() => toggle(c.id)} testId={`mine-${c.id}`}>{c.name}</Chip>)}
        </div>
      ))}
      <Button onClick={onClose} data-testid="mine-done"><CheckCheck className="size-4" />Fertig ({mine.length} Karten)</Button>
    </Shell>
  );
}

function EntrySheet({ open, onClose, cards, order, self, name, log, onAdd, onRemove }: {
  open: boolean; onClose: () => void; cards: NoteCard[]; order: string[]; self: string | null; name: (id: string) => string; log: Entry[];
  onAdd: (e: Entry) => void; onRemove: (id: string) => void;
}) {
  const [by, setBy] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<Group, string | null>>({ s: null, w: null, r: null });
  const [shower, setShower] = useState<string | null | undefined>(undefined);
  const [passed, setPassed] = useState<string[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => { if (open) { setBy(self); setPick({ s: null, w: null, r: null }); setShower(undefined); setPassed([]); setShown(null); } }, [open, self]);
  const chosen = [pick.s, pick.w, pick.r].filter(Boolean) as string[];
  const chooseShower = (id: string | null) => { setShower(id); if (by) setPassed(between(order, by, id)); setShown(null); };
  const ready = !!by && chosen.length === 3 && shower !== undefined;
  const cardName = (id: string) => cards.find((c) => c.id === id)?.name ?? "?";
  const save = () => {
    if (!ready || !by) return;
    onAdd({ id: `${Date.now()}`, by, cards: chosen, passed, shower: shower ?? null, shown: by === self && shower ? shown : null });
    vibrate(12);
    onClose();
  };
  return (
    <Shell open={open} onClose={onClose} title="Verdacht eintragen" desc="Wer fragt, was genau, wer hatte nichts und wer hat gezeigt – die App kreuzt selbst an.">
      <div className="flex flex-wrap items-center gap-1"><b className="mr-1 text-xs">Wer fragt?</b>{order.map((id) => <Chip key={id} on={by === id} onClick={() => { setBy(id); setShower(undefined); }} testId={`by-${id}`}>{id === self ? "Ich" : name(id)}</Chip>)}</div>
      {(["s", "w", "r"] as Group[]).map((g) => (
        <div key={g} className="grid grid-cols-3 gap-1">
          {cards.filter((c) => c.group === g).map((c) => <Chip key={c.id} on={pick[g] === c.id} onClick={() => setPick({ ...pick, [g]: c.id })} testId={`e-${c.id}`}>{c.name}</Chip>)}
        </div>
      ))}
      {by && (
        <div className="flex flex-wrap items-center gap-1"><b className="mr-1 text-xs">Wer zeigt?</b>
          {order.filter((id) => id !== by).map((id) => <Chip key={id} on={shower === id} onClick={() => chooseShower(id)} testId={`shower-${id}`}>{id === self ? "Ich" : name(id)}</Chip>)}
          <Chip on={shower === null} onClick={() => chooseShower(null)} testId="shower-none">Niemand</Chip>
        </div>
      )}
      {by && shower !== undefined && (
        <div className="flex flex-wrap items-center gap-1"><b className="mr-1 text-xs">Hatte nichts:</b>
          {order.filter((id) => id !== by && id !== shower).map((id) => <Chip key={id} on={passed.includes(id)} onClick={() => setPassed(passed.includes(id) ? passed.filter((x) => x !== id) : [...passed, id])}>{id === self ? "Ich" : name(id)}</Chip>)}
        </div>
      )}
      {by === self && shower && chosen.length === 3 && (
        <div className="flex flex-wrap items-center gap-1"><b className="mr-1 text-xs">Gezeigt wurde:</b>
          {chosen.map((id) => <Chip key={id} on={shown === id} onClick={() => setShown(id)} testId={`shown-${id}`}>{cardName(id)}</Chip>)}
        </div>
      )}
      <Button disabled={!ready} onClick={save} data-testid="entry-save"><ListPlus className="size-4" />Eintragen</Button>
      {log.length > 0 && (
        <ul className="grid max-h-32 gap-1 overflow-y-auto text-xs text-muted-foreground" data-testid="entry-log">
          {log.slice().reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate"><b className="text-foreground">{e.by === self ? "Ich" : name(e.by)}</b>: {e.cards.map(cardName).join(", ")} – {e.shower ? `${e.shower === self ? "ich" : name(e.shower)} zeigt${e.shown ? ` ${cardName(e.shown)}` : ""}` : "niemand"}</span>
              <button type="button" onClick={() => onRemove(e.id)} aria-label="Eintrag löschen" className="shrink-0 rounded p-1 hover:bg-accent"><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function NamesSheet({ open, onClose, cards, onChange }: { open: boolean; onClose: () => void; cards: NoteCard[]; onChange: (c: NoteCard[]) => void }) {
  const [draft, setDraft] = useState(cards);
  useEffect(() => { if (open) setDraft(cards); }, [open, cards]);
  const add = (g: Group) => setDraft([...draft, { id: `${g}:eigen${Date.now()}`, group: g, name: "" }]);
  return (
    <Shell open={open} onClose={onClose} title="Namen anpassen" desc="So heißen die Karten in eurer Schachtel? Einmal eintragen – das Handy merkt es sich.">
      <div className="grid max-h-[60dvh] gap-2 overflow-y-auto">
        {(["s", "w", "r"] as Group[]).map((g) => (
          <div key={g} className="grid gap-1">
            <b className="text-xs text-muted-foreground">{GROUP_TITLE[g]}</b>
            {draft.filter((c) => c.group === g).map((c) => (
              <div key={c.id} className="flex gap-1">
                <Input value={c.name} maxLength={30} onChange={(e) => setDraft(draft.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} aria-label="Kartenname" className="h-9" />
                <Button size="sm" variant="ghost" aria-label="Karte entfernen" disabled={draft.filter((x) => x.group === g).length <= 1} onClick={() => setDraft(draft.filter((x) => x.id !== c.id))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => add(g)}>+ Karte</Button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setDraft(DEFAULT_CARDS)}>Zurücksetzen</Button>
        <Button onClick={() => { onChange(draft.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim() }))); onClose(); }} data-testid="names-save">Speichern</Button>
      </div>
    </Shell>
  );
}

function FinishSheet({ open, onClose, players, onFinish }: { open: boolean; onClose: () => void; players: { id: string; name: string }[]; onFinish: (w: string | null) => void }) {
  return (
    <Shell open={open} onClose={onClose} title="Fall gelöst?" desc="Wer hat am Tisch richtig angeklagt? Das zählt für die Statistik.">
      <div className="grid grid-cols-3 gap-1.5">{players.map((p) => <Chip key={p.id} on={false} onClick={() => onFinish(p.id)} testId={`winner-${p.id}`}>{p.name}</Chip>)}</div>
      <Button variant="secondary" onClick={() => onFinish(null)}>Niemand – ungelöst</Button>
    </Shell>
  );
}
