import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, DoorOpen, Gavel, Search } from "lucide-react";
import {
  canSuggestHere, cardName, DOORS, isRoom, kindOf, matching, PASSAGES, reachable, roomOf, roomPos, ROOMS, SIZE, SUSPECTS, suspectIndex, WEAPONS,
  weaponIndex, type Card, type Pos, type SpAction, type SpState,
} from "@shared/games/spurensuche/logic";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BoardProps } from "@/games/types";
import { Die } from "@/platform/Die";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { readStr, writeStr } from "@/lib/storage";
import { cn, vibrate } from "@/lib/utils";
import { narration } from "./narration";
import { NotesBoard } from "./NotesBoard";

type Props = BoardProps<SpState, SpAction>;
const nameIn = (s: SpState, id: string | null | undefined) => (id ? s.names[id] ?? "?" : "?");

export function Board(props: Props) {
  useNarration(props);
  if (props.game.phase === "over") return <Result {...props} />;
  if (props.game.phase === "notes") return <NotesBoard {...props} />;
  return <Play {...props} />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<SpState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || !before || before === s) return;
    const parts = narration(before, s);
    if (parts.length) void speak(parts.join(" "));
  }, [on, s]);
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const sol = s.solution;
  const ranking = room.players.filter((p) => s.role[p.id]).map((p) => ({ id: p.id, name: p.name, score: p.id === s.winnerId ? 1 : 0 }));
  return (
    <ResultScreen winner={s.winnerId ? nameIn(s, s.winnerId) : "Niemand"}
      subtitle={sol ? `${SUSPECTS[suspectIndex(sol.suspect)].name} – ${WEAPONS[weaponIndex(sol.weapon)].with} ${ROOMS[sol.room].in}` : ""}
      ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="gelöst" />
  );
}

// ── Brett ───────────────────────────────────────────────────────────────────────────────────────────────

/** Rechteck je Raum aus dem Grundriss */
const ROOM_RECTS = ROOMS.map((_, i) => {
  let r0 = SIZE, c0 = SIZE, r1 = -1, c1 = -1;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (roomAtCell(r, c) === i) { r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c); }
  }
  return { x: c0, y: r0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
});
function roomAtCell(r: number, c: number): number {
  // Räume liegen im Raster 3×3: Zeilen 1–5, 8–11, 14–18 und Spalten 1–5, 8–11, 14–18
  const band = (x: number) => (x >= 1 && x <= 5 ? 0 : x >= 8 && x <= 11 ? 1 : x >= 14 && x <= 18 ? 2 : -1);
  const a = band(r), b = band(c);
  return a < 0 || b < 0 ? -1 : a * 3 + b;
}
const ROOM_FILL = ["#efe2c9", "#e8dccb", "#eadfd0", "#dfe9d6", "#f0dccb", "#e6dccd", "#dcd6d0", "#ece1cf", "#e3d5c6"];

function HouseBoard({ s, reach, onPick, mine }: { s: SpState; reach: Map<Pos, number> | null; onPick?: (p: Pos) => void; mine: string | null }) {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (roomAtCell(r, c) >= 0) continue;
    const p = r * SIZE + c;
    const floor = (r === 0 && (c === 6 || c === 13)) || (r === 19 && c === 13) || (c === 0 && r === 12) || (c === 19 && (r === 6 || r === 13)) || (r >= 1 && r <= 18 && c >= 1 && c <= 18);
    if (!floor) continue;
    const can = reach?.has(p);
    cells.push(
      <rect key={p} x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.12}
        className={cn(can ? "fill-[#9fd3ea] cursor-pointer" : "fill-[#f7f0e2]")} stroke="#d9cdb6" strokeWidth={0.04}
        onClick={can && onPick ? () => onPick(p) : undefined} data-testid={can ? `cell-${p}` : undefined} />,
    );
  }
  // Figuren im Flur und in Räumen
  const inRoom: Record<number, string[]> = {};
  const tokens: React.ReactNode[] = [];
  SUSPECTS.forEach((x) => {
    const p = s.token[x.id];
    if (isRoom(p)) { (inRoom[roomOf(p)] ??= []).push(x.id); return; }
    const r = Math.floor(p / SIZE), c = p % SIZE;
    tokens.push(<Token key={x.id} id={x.id} x={c + 0.5} y={r + 0.5} me={mine === x.id} />);
  });
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="aspect-square w-full touch-manipulation select-none" role="img" aria-label="Spielbrett: das Landhaus" data-testid="house">
      <rect x={0} y={0} width={SIZE} height={SIZE} rx={0.4} fill="#5b4632" />
      {cells}
      {ROOM_RECTS.map((rc, i) => {
        const can = reach?.has(roomPos(i));
        const here = inRoom[i] ?? [];
        const weapons = WEAPONS.filter((w) => s.weaponAt[w.id] === i);
        return (
          <g key={i} onClick={can && onPick ? () => onPick(roomPos(i)) : undefined} className={cn(can && "cursor-pointer")} data-testid={can ? `room-${i}` : `room-static-${i}`}>
            <rect x={rc.x + 0.08} y={rc.y + 0.08} width={rc.w - 0.16} height={rc.h - 0.16} rx={0.3} fill={can ? "#cfe9f5" : ROOM_FILL[i]}
              stroke={can ? "#2a8ec0" : "#8b7356"} strokeWidth={can ? 0.24 : 0.08} />
            <text x={rc.x + rc.w / 2} y={rc.y + 0.95} textAnchor="middle" fontSize={ROOMS[i].name.length > 11 ? 0.5 : 0.62} fontWeight={700} fill="#3d2f22">{ROOMS[i].name}</text>
            {PASSAGES[i] !== undefined && <text x={rc.x + (i % 3 === 0 ? 0.55 : rc.w - 0.55)} y={rc.y + rc.h - 0.35} textAnchor="middle" fontSize={0.7} fill="#6b4d2e" aria-label="Geheimgang">⇵</text>}
            {weapons.map((w, k) => (
              <text key={w.id} x={rc.x + rc.w / 2} y={rc.y + rc.h - 0.45 - k * 0.6} textAnchor="middle" fontSize={0.48} fill="#5b4632" fontStyle="italic">{w.name}</text>
            ))}
            {here.map((id, k) => <Token key={id} id={id} x={rc.x + 0.75 + (k % 4) * 0.95} y={rc.y + 1.85 + Math.floor(k / 4) * 0.95} me={mine === id} />)}
          </g>
        );
      })}
      {/* Türen: kleine Schwelle zwischen Flurfeld und Raum */}
      {DOORS.flatMap((doors, i) => doors.map(([r, c]) => {
        const rc = ROOM_RECTS[i];
        const x = c < rc.x ? rc.x : c >= rc.x + rc.w ? rc.x + rc.w : c + 0.5;
        const y = r < rc.y ? rc.y : r >= rc.y + rc.h ? rc.y + rc.h : r + 0.5;
        const vertical = c < rc.x || c >= rc.x + rc.w;
        return <rect key={`${i}-${r}-${c}`} x={vertical ? x - 0.12 : x - 0.4} y={vertical ? y - 0.4 : y - 0.12} width={vertical ? 0.24 : 0.8} height={vertical ? 0.8 : 0.24} rx={0.08} fill="#a77b4a" />;
      }))}
      {tokens}
    </svg>
  );
}

function Token({ id, x, y, me }: { id: string; x: number; y: number; me: boolean }) {
  const sus = SUSPECTS[suspectIndex(id)];
  return (
    <g data-testid={`token-${id}`}>
      <circle cx={x} cy={y} r={0.42} fill={sus.color} stroke={me ? "#fff" : "#00000055"} strokeWidth={me ? 0.14 : 0.06} />
      <text x={x} y={y + 0.2} textAnchor="middle" fontSize={0.52} fontWeight={700} fill="#fff">{sus.mark}</text>
    </g>
  );
}

// ── Karten ──────────────────────────────────────────────────────────────────────────────────────────────

function CardChip({ c, selected, onClick, disabled, testId }: { c: Card; selected?: boolean; onClick?: () => void; disabled?: boolean; testId?: string }) {
  const k = kindOf(c);
  const sus = k === "suspect" ? SUSPECTS[suspectIndex(c.slice(2))] : null;
  return (
    <button type="button" onClick={onClick} disabled={disabled || !onClick} aria-pressed={onClick ? !!selected : undefined} data-testid={testId}
      className={cn("flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-left text-xs leading-tight font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
        selected ? "bg-primary text-primary-foreground ring-primary" : "bg-paper text-paper-ink ring-black/10", disabled && onClick && "opacity-40")}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: sus?.color ?? (k === "weapon" ? "#6b5a45" : "#b9a27e") }} aria-hidden="true" />
      <span className="truncate">{cardName(c)}</span>
    </button>
  );
}

// ── Notizblock ──────────────────────────────────────────────────────────────────────────────────────────

const MARKS = ["", "✗", "?", "✓"] as const;
function useNotes(key: string) {
  const [notes, setNotes] = useState<Record<string, string>>(() => { try { return JSON.parse(readStr(key) ?? "{}"); } catch { return {}; } });
  useEffect(() => { try { setNotes(JSON.parse(readStr(key) ?? "{}")); } catch { setNotes({}); } }, [key]);
  const cycle = (c: Card) => setNotes((n) => {
    const next = { ...n, [c]: MARKS[(MARKS.indexOf((n[c] ?? "") as (typeof MARKS)[number]) + 1) % MARKS.length] };
    writeStr(key, JSON.stringify(next));
    return next;
  });
  return { notes, cycle };
}

function Notebook({ s, viewer, open, onOpenChange, notesKey }: { s: SpState; viewer: string; open: boolean; onOpenChange: (o: boolean) => void; notesKey: string }) {
  const { notes, cycle } = useNotes(notesKey);
  const own = new Set(s.hands[viewer] ?? []);
  const seen = new Map((s.seen[viewer] ?? []).map((x) => [x.card, x.by]));
  const groups: [string, Card[]][] = [
    ["Wer?", SUSPECTS.map((x) => `s:${x.id}`)],
    ["Womit?", WEAPONS.map((x) => `w:${x.id}`)],
    ["Wo?", ROOMS.map((x) => `r:${x.id}`)],
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notizblock</SheetTitle>
          <SheetDescription>Eigene und gezeigte Karten trägt die App ein. Antippen: ✗ · ? · ✓</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" data-testid="notebook">
          {groups.map(([title, cards]) => (
            <div key={title} className="grid content-start gap-1">
              <b className="text-xs text-muted-foreground">{title}</b>
              {cards.map((c) => {
                const auto = own.has(c) ? "deine" : seen.has(c) ? `von ${nameIn(s, seen.get(c))}` : null;
                const mark = notes[c] ?? "";
                return (
                  <button key={c} type="button" onClick={() => cycle(c)} data-testid={`note-${c}`}
                    className={cn("flex min-h-8 items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-left text-[0.7rem] leading-tight ring-1 ring-inset ring-border",
                      auto ? "bg-secondary text-muted-foreground" : "bg-paper text-paper-ink")}>
                    <span className="min-w-0"><span className={cn(auto && "line-through")}>{cardName(c)}</span>{auto && <span className="block text-[0.6rem] opacity-80">{auto}</span>}</span>
                    <b className="shrink-0 text-sm">{auto ? "✗" : mark}</b>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Spiel ───────────────────────────────────────────────────────────────────────────────────────────────

function Play({ room, game: s, me, canAct, act }: Props) {
  const local = me === null;
  // Wer bedient das Gerät? Lokal: wer am Zug ist bzw. widerlegt
  const actorId = s.phase === "refute" ? s.refuterId : s.curId;
  const { covered, reveal } = useHandoff(local, actorId, Object.keys(s.role).length);
  const viewer = local ? (covered ? null : actorId) : me;
  const myTurn = !!viewer && viewer === s.curId && (local || canAct) && s.phase !== "refute";
  const myRefute = !!viewer && s.phase === "refute" && viewer === s.refuterId;
  const meTok = viewer ? s.role[viewer] : null;
  const total = s.dice ? s.dice.reduce((a, b) => a + b, 0) : 0;
  const reach = useMemo(() => (myTurn && s.phase === "moving" && meTok ? reachable(s, meTok, total) : null), [myTurn, s, meTok, total]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [accuse, setAccuse] = useState(false);
  const [pick, setPick] = useState<{ suspect: string | null; weapon: string | null; room: number | null }>({ suspect: null, weapon: null, room: null });
  useEffect(() => { setPick({ suspect: null, weapon: null, room: null }); setAccuse(false); }, [s.curId, s.phase]);
  const notesKey = `spieltisch:notes:spurensuche:${s.gid}:${viewer ?? "-"}`;

  const cur = nameIn(s, s.curId);
  const here = meTok ? roomOf(s.token[meTok]) : -1;
  const last = s.history.at(-1);
  const shownToMe = s.lastShown && viewer && s.lastShown.to === viewer && s.lastShown.card ? s.lastShown : null;

  const status = covered ? `${nameIn(s, actorId)} ist dran.`
    : s.phase === "refute" ? (myRefute ? `Widerlege ${nameIn(s, s.pending?.by)}: zeig eine Karte.` : `${nameIn(s, s.refuterId)} sucht eine Karte für ${nameIn(s, s.pending?.by)} …`)
    : !myTurn ? `${cur} ist am Zug.`
    : s.phase === "move" ? "Würfeln – oder anklagen, wenn du dir sicher bist."
    : s.phase === "moving" ? `${total} gewürfelt – Feld oder Raum antippen.`
    : s.phase === "suggest" ? `Verdacht ${ROOMS[here]?.in ?? ""}: wer und womit?`
    : "Anklagen oder Zug beenden.";

  const send = (a: SpAction) => { vibrate(10); act(a); };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 pt-1 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-2 px-1 text-sm">
        <span data-testid="status" className={cn("min-w-0 flex-1 leading-tight", (myTurn || myRefute) && "font-semibold")}><SmoothText>{status}</SmoothText></span>
        {s.dice && <span className="flex shrink-0 gap-0.5" aria-label={`Gewürfelt: ${total}`}>{s.dice.map((d, i) => <Die key={i} value={d} className="size-6" />)}</span>}
        {viewer && !covered && <Button size="sm" variant="secondary" onClick={() => setNotesOpen(true)} data-testid="notes-open"><BookOpen className="size-4" />Notizen</Button>}
        <RulesSheet gameId={room.gameId} />
      </div>

      <div className="mx-auto w-full max-w-[min(100%,46dvh)] shrink-0">
        <HouseBoard s={s} reach={reach} mine={meTok} onPick={(p) => send({ type: "move", to: p })} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
        {covered && actorId ? <HandoffCover name={nameIn(s, actorId)} onReveal={reveal} /> : (
          <>
            {/* Was zuletzt geschah */}
            {last && !myRefute && !(myTurn && (s.phase === "suggest" || accuse)) && <LastSuggestion s={s} last={last} viewer={viewer} />}
            {shownToMe ? (
              <p className="glass rounded-xl px-3 py-1.5 text-center text-sm" data-testid="shown-to-me">
                {nameIn(s, shownToMe.by)} zeigt dir: <b>{cardName(shownToMe.card!)}</b>
              </p>
            ) : last && s.phase === "after" && last.by === viewer && !last.shownBy ? (
              <p className="glass rounded-xl px-3 py-1.5 text-center text-sm font-semibold" data-testid="no-refute">Niemand konnte widerlegen!</p>
            ) : null}

            {myRefute && s.pending && viewer ? (
              <div className="glass grid gap-2 rounded-2xl p-2.5" data-testid="refute">
                <p className="text-center text-sm">Verdacht: <b>{SUSPECTS[suspectIndex(s.pending.suspect)].name}</b>, <b>{WEAPONS[weaponIndex(s.pending.weapon)].name}</b>, <b>{ROOMS[s.pending.room].name}</b></p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {matching(s, viewer, s.pending).map((c) => <Button key={c} onClick={() => send({ type: "show", card: c })} data-testid={`show-${c}`}>{cardName(c)} zeigen</Button>)}
                </div>
              </div>
            ) : myTurn && s.phase === "suggest" && !accuse ? (
              <Picker s={s} pick={pick} setPick={setPick} room={here}
                onGo={() => pick.suspect && pick.weapon && send({ type: "suggest", suspect: pick.suspect, weapon: pick.weapon })}
                goLabel="Verdächtigen" testId="suggest" onSkip={() => send({ type: "noSuggest" })} skipLabel="Kein Verdacht" />
            ) : myTurn && accuse ? (
              <Picker s={s} pick={pick} setPick={setPick} room={null} accuse
                onGo={() => pick.suspect && pick.weapon && pick.room !== null && send({ type: "accuse", suspect: pick.suspect, weapon: pick.weapon, room: pick.room })}
                goLabel="Anklagen – endgültig" testId="accuse" onSkip={() => setAccuse(false)} skipLabel="Zurück" />
            ) : myTurn ? (
              <div className="grid gap-2">
                {s.phase === "move" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="lg" onClick={() => send({ type: "roll" })} data-testid="roll">Würfeln</Button>
                    {here >= 0 && PASSAGES[here] !== undefined ? <Button size="lg" variant="secondary" onClick={() => send({ type: "passage" })} data-testid="passage"><DoorOpen className="size-4" />Geheimgang</Button>
                      : viewer && s.summoned.includes(viewer) && canSuggestHere(s, viewer) ? <Button size="lg" variant="secondary" onClick={() => send({ type: "stay" })} data-testid="stay">Hier verdächtigen</Button>
                        : <Button size="lg" variant="secondary" onClick={() => setAccuse(true)} data-testid="accuse-open"><Gavel className="size-4" />Anklagen</Button>}
                  </div>
                )}
                {s.phase === "moving" && <p className="text-center text-xs text-muted-foreground">Blau: so weit kommst du. Ein Raum beendet den Zug.</p>}
                {s.phase === "after" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="lg" variant="secondary" onClick={() => setAccuse(true)} data-testid="accuse-open"><Gavel className="size-4" />Anklagen</Button>
                    <Button size="lg" onClick={() => send({ type: "end" })} data-testid="end">Zug beenden</Button>
                  </div>
                )}
              </div>
            ) : null}

            {viewer && <MyCards s={s} viewer={viewer} />}
          </>
        )}
      </div>
      {viewer && <Notebook s={s} viewer={viewer} open={notesOpen} onOpenChange={setNotesOpen} notesKey={notesKey} />}
    </div>
  );
}

function LastSuggestion({ s, last, viewer }: { s: SpState; last: SpState["history"][number]; viewer: string | null }) {
  const who = (id: string | null) => (id === viewer ? "du" : nameIn(s, id));
  return (
    <div className="glass rounded-xl px-3 py-1.5 text-xs leading-snug text-muted-foreground" data-testid="last-suggestion">
      <b className="text-foreground">{who(last.by) === "du" ? "Du" : who(last.by)}</b> {last.by === viewer ? "hast" : "hat"} verdächtigt: <b className="text-foreground">{SUSPECTS[suspectIndex(last.suspect)].name}</b>, <b className="text-foreground">{WEAPONS[weaponIndex(last.weapon)].name}</b>, <b className="text-foreground">{ROOMS[last.room].name}</b>.
      {last.passed.length > 0 && <> {last.passed.map(who).join(", ")}: nichts.</>}
      {" "}{last.shownBy ? <>{who(last.shownBy) === "du" ? "Du hast" : `${who(last.shownBy)} hat`} eine Karte gezeigt.</> : <>Niemand konnte widerlegen.</>}
    </div>
  );
}

function MyCards({ s, viewer }: { s: SpState; viewer: string }) {
  const hand = s.hands[viewer] ?? [];
  const sus = SUSPECTS[suspectIndex(s.role[viewer] ?? "")];
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="hand" aria-label="Deine Karten">
      {sus && <span className="mr-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="size-3 rounded-full" style={{ background: sus.color }} />Du: <b className="text-foreground">{sus.short}</b>{s.out.includes(viewer) && " (raus)"}</span>}
      {hand.map((c) => <CardChip key={c} c={c} />)}
    </div>
  );
}

function Picker({ s, pick, setPick, room, accuse, onGo, goLabel, onSkip, skipLabel, testId }: {
  s: SpState; pick: { suspect: string | null; weapon: string | null; room: number | null }; setPick: (p: { suspect: string | null; weapon: string | null; room: number | null }) => void;
  room: number | null; accuse?: boolean; onGo: () => void; goLabel: string; onSkip: () => void; skipLabel: string; testId: string;
}) {
  const ready = !!pick.suspect && !!pick.weapon && (!accuse || pick.room !== null);
  void s;
  return (
    <div className="glass grid gap-1.5 rounded-2xl p-2" data-testid={testId}>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Wer?">
        {SUSPECTS.map((x) => <CardChip key={x.id} c={`s:${x.id}`} selected={pick.suspect === x.id} onClick={() => setPick({ ...pick, suspect: x.id })} testId={`pick-s-${x.id}`} />)}
      </div>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Womit?">
        {WEAPONS.map((x) => <CardChip key={x.id} c={`w:${x.id}`} selected={pick.weapon === x.id} onClick={() => setPick({ ...pick, weapon: x.id })} testId={`pick-w-${x.id}`} />)}
      </div>
      {accuse ? (
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Wo?">
          {ROOMS.map((x, i) => <CardChip key={x.id} c={`r:${x.id}`} selected={pick.room === i} onClick={() => setPick({ ...pick, room: i })} testId={`pick-r-${i}`} />)}
        </div>
      ) : room !== null && room >= 0 ? <p className="text-center text-xs text-muted-foreground">Ort: <b className="text-foreground">{ROOMS[room].name}</b> (hier)</p> : null}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="ghost" onClick={onSkip}>{skipLabel}</Button>
        <Button disabled={!ready} onClick={onGo} variant={accuse ? "destructive" : "default"} data-testid={`${testId}-go`}>
          {accuse ? <Gavel className="size-4" /> : <Search className="size-4" />}{goLabel}
        </Button>
      </div>
      {accuse && <p className="text-center text-[0.68rem] text-muted-foreground">Nur eine Anklage pro Spiel – falsch heißt: raus (du zeigst aber weiter Karten).</p>}
    </div>
  );
}
