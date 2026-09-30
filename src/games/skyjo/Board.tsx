import { useState } from "react";
import { Undo2 } from "lucide-react";
import { leaders, visibleSum, type Cell, type SkAction, type SkState } from "@shared/games/skyjo/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";
import { MUTED } from "@/lib/palette";

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

/** Farben angelehnt ans Original, aber gedämpft: Minus Navy, 0 Eisblau, 1–4 Blaugrün, 5–8 Ocker, 9–12 Weinrot */
export function cardColor(v: number): { bg: string; fg: string } {
  if (v < 0) return { bg: MUTED.navy, fg: "#fff" };
  if (v === 0) return { bg: MUTED.ice, fg: "#10223d" };
  if (v <= 4) return { bg: MUTED.teal, fg: "#fff" };
  if (v <= 8) return { bg: MUTED.ochre, fg: "#1f1a0c" };
  return { bg: MUTED.red, fg: "#fff" };
}

/** Eine Karte: offen mit Zahl, verdeckt mit Rückseite, abgeräumt als leerer Platz */
export function SkCard({ cell, small, pick, onClick, label }: { cell: Cell | null; small?: boolean; pick?: boolean; onClick?: () => void; label?: string }) {
  if (!cell) return <div className={cn("rounded-[18%] border border-dashed border-border/60", small ? "size-full" : "h-full")} aria-hidden="true" />;
  const up = cell.up && cell.v !== null;
  const c = up ? cardColor(cell.v!) : null;
  return (
    <button type="button" disabled={!onClick} onClick={onClick} aria-label={label ?? (up ? `Karte ${cell.v}` : "verdeckte Karte")}
      className={cn("grid place-items-center overflow-hidden rounded-[18%] font-extrabold shadow outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
        small ? "size-full text-[0.55rem]" : "h-full w-full text-[clamp(1rem,6vw,1.8rem)]", !up && "card-back", pick && "ring-[3px] ring-ice", onClick && "active:scale-95")}
      style={c ? { background: c.bg, color: c.fg } : undefined}>
      {up ? cell.v : small ? "" : <span className="text-[0.6em] text-paper/70">SKYJO</span>}
    </button>
  );
}

export function Board(props: BoardProps<SkState, SkAction>) {
  return props.game.mode === "table" ? <TableBoard {...props} /> : <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: BoardProps<SkState, SkAction>) {
  const win = leaders(s, room.players).map((id) => nameOf(room.players, id));
  const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 })).sort((a, b) => a.score - b.score);
  return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${ranking[0]?.score ?? 0} Punkten – am wenigsten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

/** Karten in der App */
function AppBoard(props: BoardProps<SkState, SkAction>) {
  const { room, game: s, me, isHost, canAct, act } = props;
  const players = room.players;
  if (s.phase === "over") return <Result {...props} />;

  const local = me === null;
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 }));
  // Wessen Raster groß? Online das eigene, lokal wer gerade handelt
  const flipper = players.find((p) => s.grids[p.id] && s.grids[p.id].filter((c) => c?.up).length < 2)?.id ?? null;
  const focus = local ? (s.phase === "flip" ? flipper : s.curId) : me;
  const grid = focus ? s.grids[focus] : null;
  const myTurn = s.phase === "turn" && canAct && (local || s.curId === me);
  const needFlips = s.phase === "flip" && !!focus && (grid?.filter((c) => c?.up).length ?? 2) < 2;
  const deckCount = s.deck.length || s.deckCount;
  const top = s.discard[s.discard.length - 1];

  const tap = (i: number) => {
    if (!focus) return;
    vibrate(8);
    if (s.phase === "flip") act({ type: "flipStart", player: focus, i });
    else if (s.drawn !== null) act({ type: "swap", i });
    else if (s.mustFlip) act({ type: "flip", i });
  };
  const cellTappable = (c: Cell | null) => !!c && (s.phase === "flip" ? needFlips && !c.up : myTurn && (s.drawn !== null || (s.mustFlip && !c.up)));

  let hint: string;
  if (s.phase === "flip") hint = needFlips ? `${local ? nameOf(players, focus) + ": " : ""}Deck zwei Karten auf.` : "Warte, bis alle zwei Karten aufgedeckt haben.";
  else if (s.phase === "roundEnd") hint = "Runde vorbei – alle Karten sind aufgedeckt.";
  else if (!myTurn) hint = `Warte auf ${nameOf(players, s.curId)}.`;
  else if (s.drawn === null && !s.mustFlip) hint = "Ziehe vom Stapel oder nimm die offene Karte.";
  else if (s.mustFlip) hint = "Dreh eine verdeckte Karte um.";
  else if (s.drawnFrom === "discard") hint = "Tippe die Karte an, die du tauschst.";
  else hint = "Tauschen – oder ablegen und umdrehen.";

  const others = players.filter((p) => p.id !== focus && s.grids[p.id]);

  return (
    <>
      <Scoreboard entries={entries} currentId={s.curId} me={me} online={props.online} lowWins />

      {/* Die anderen, klein */}
      {others.length > 0 && (
        <div className="no-scrollbar -mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 py-1.5">
          {others.map((p) => (
            <div key={p.id} className={cn("shrink-0 rounded-xl px-2 py-1", p.id === s.curId ? "bg-navy-600/70 ring-1 ring-navy-300/60" : "glass")} data-testid={`mini-${p.name}`}>
              <div className="flex items-baseline justify-between gap-2 text-xs"><b className="max-w-[5rem] truncate">{p.name}</b><span className="tabular-nums text-muted-foreground">{visibleSum(s.grids[p.id])}</span></div>
              <div className="mt-0.5 grid w-[3.6rem] grid-cols-4 grid-rows-3 gap-0.5 [@media(min-height:700px)]:w-[4.6rem]" style={{ aspectRatio: "4 / 3.9" }}>
                {s.grids[p.id].map((c, i) => <SkCard key={i} cell={c} small />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stapel, Ablage, gezogene Karte */}
      <div className="flex shrink-0 items-center justify-center gap-3 py-1.5 [--pile:clamp(3.25rem,10vh,5rem)]">
        <button type="button" disabled={!myTurn || s.drawn !== null || s.mustFlip} onClick={() => { vibrate(10); act({ type: "draw", from: "deck" }); }}
          aria-label={`Vom Stapel ziehen (${deckCount})`} className="card-back grid h-(--pile) w-[calc(var(--pile)*0.714)] place-items-center rounded-xl text-sm font-bold text-paper shadow outline-none disabled:cursor-default">
          {deckCount}
        </button>
        <div className="aspect-[5/7] h-(--pile)">
          {top !== undefined
            ? <SkCard cell={{ v: top, up: true }} onClick={myTurn && s.drawn === null && !s.mustFlip ? () => act({ type: "draw", from: "discard" }) : undefined} label={`Offene Karte ${top} nehmen`} />
            : <div className="h-full rounded-xl border border-dashed border-border" />}
        </div>
        {s.drawn !== null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">→</span>
            <div className="aspect-[5/7] h-(--pile)" data-testid="drawn"><SkCard cell={{ v: s.drawn, up: true }} pick label={`Gezogen: ${s.drawn}`} /></div>
          </div>
        )}
      </div>

      {/* Das eigene Raster */}
      <div className="flex min-h-0 flex-1 flex-col items-center">
        <div className="mb-1 flex w-full items-center justify-between gap-2 px-1 text-sm">
          <span className="truncate font-semibold">{s.phase === "roundEnd" ? `Runde ${s.round} vorbei` : `${focus === me ? "Deine Karten" : nameOf(players, focus)} `}{s.phase !== "roundEnd" && <span className="text-muted-foreground tabular-nums">· offen {grid ? visibleSum(grid) : 0}</span>}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">R{s.round} · bis {s.target}<RulesSheet gameId={room.gameId} /></span>
        </div>
        {s.phase === "roundEnd" ? <RoundEnd {...props} /> : grid ? (
          <div className="grid min-h-0 w-full max-w-[22rem] flex-1 grid-cols-4 grid-rows-3 gap-1.5" role="group" aria-label="Deine Karten">
            {grid.map((c, i) => <div key={i} className="flex min-h-0 justify-center"><div className="aspect-[5/7] h-full max-w-full"><SkCard cell={c} onClick={cellTappable(c) ? () => tap(i) : undefined} /></div></div>)}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <p className="mb-1.5 text-center text-sm leading-snug font-semibold" data-testid="hint"><SmoothText>{`${s.ender && s.phase === "turn" ? "Letzte Runde! " : ""}${hint}`}</SmoothText></p>
        {s.phase === "roundEnd" ? (
          isHost ? <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Nächste Runde</Button>
            : <p className="glass rounded-xl py-3 text-center text-muted-foreground">Der Host startet die nächste Runde.</p>
        ) : myTurn && s.drawnFrom === "deck" && s.drawn !== null ? (
          <Button variant="secondary" className="h-11 w-full" onClick={() => act({ type: "discardDrawn" })}>Ablegen & umdrehen</Button>
        ) : null}
      </div>
    </>
  );
}

/** Rundenende: Punkte dieser Runde je Spieler */
function RoundEnd({ room, game: s }: BoardProps<SkState, SkAction>) {
  const last = s.rounds[s.rounds.length - 1];
  return (
    <ul className="grid w-full gap-1.5" data-testid="round-end">
      {room.players.map((p) => (
        <li key={p.id} className="glass flex items-center justify-between rounded-xl px-3 py-2">
          <span className="font-semibold">{p.name}{last?.ender === p.id && " (hat beendet)"}</span>
          <span className="tabular-nums"><b>{last?.points[p.id] ?? 0}</b>{last?.doubled && last.ender === p.id && <span className="ml-1 text-xs text-destructive">doppelt</span>}<span className="ml-2 text-muted-foreground">= {s.scores[p.id] ?? 0}</span></span>
        </li>
      ))}
    </ul>
  );
}

/** Echte Karten: Punkteblock – jeder trägt seine Punkte ein, der Host schließt die Runde ab */
function TableBoard(props: BoardProps<SkState, SkAction>) {
  const { room, game: s, me, isHost, act } = props;
  const players = room.players;
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (s.phase === "over") return <Result {...props} />;
  const local = me === null;
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 }));
  const commit = (id: string) => {
    const raw = draft[id];
    if (raw === undefined) return;
    const n = raw.trim() === "" ? null : Number(raw.replace("−", "-"));
    if (n !== null && !Number.isInteger(n)) return;
    act({ type: "enter", player: id, points: n });
  };
  const missing = players.filter((p) => s.entries[p.id] === null || s.entries[p.id] === undefined).length;

  return (
    <>
      <Scoreboard entries={entries} currentId={null} me={me} online={props.online} lowWins />
      <div className="flex shrink-0 items-center justify-between px-1 pt-1 text-sm text-muted-foreground">
        <span>Runde {s.round} · Ende ab {s.target}</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">Punkte der Runde eintragen und antippen, wer die Runde beendet hat – die Verdopplung rechnet die App.</p>
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {players.map((p) => {
          const editable = local || isHost || p.id === me;
          const val = draft[p.id] ?? (s.entries[p.id] === null || s.entries[p.id] === undefined ? "" : String(s.entries[p.id]));
          return (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}</span>
              <Input value={val} disabled={!editable} inputMode="numeric" aria-label={`Punkte ${p.name}`} className="h-10 w-20 text-center text-lg font-bold"
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value.replace(/[^\d−-]/g, "").slice(0, 4) }))}
                onBlur={() => commit(p.id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <button type="button" aria-pressed={s.tableEnder === p.id} aria-label={`${p.name} hat beendet`}
                onClick={() => act({ type: "setEnder", player: s.tableEnder === p.id ? null : p.id })}
                className={cn("rounded-lg px-2 py-2 text-xs font-bold ring-1 ring-inset", s.tableEnder === p.id ? "bg-ice text-navy-950 ring-transparent" : "text-muted-foreground ring-border")}>beendet</button>
            </div>
          );
        })}
        {s.rounds.length > 0 && (
          <details className="glass rounded-xl px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-muted-foreground">Bisherige Runden ({s.rounds.length})</summary>
            <ol className="mt-1.5 grid gap-1">
              {s.rounds.map((r, i) => (
                <li key={i} className="tabular-nums text-muted-foreground">{i + 1}: {players.map((p) => `${p.name} ${r.points[p.id] ?? 0}${r.doubled && r.ender === p.id ? "×2" : ""}`).join(" · ")}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isHost ? (
          <div className={cn("grid gap-2", s.rounds.length ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
            {s.rounds.length > 0 && <Button size="lg" variant="secondary" onClick={() => act({ type: "undoRound" })} aria-label="Letzte Runde zurücknehmen"><Undo2 /></Button>}
            <Button size="lg" disabled={missing > 0} onClick={() => { vibrate(10); setDraft({}); act({ type: "finishRound" }); }}>
              {missing ? `Noch ${missing} ${missing === 1 ? "Eintrag" : "Einträge"}` : `Runde ${s.round} abschließen`}
            </Button>
          </div>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">{missing ? "Trag deine Punkte ein." : "Der Host schließt die Runde ab."}</p>}
      </div>
    </>
  );
}
