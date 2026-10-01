import { useState } from "react";
import { Ban, Repeat2 } from "lucide-react";
import {
  canPlay, colorOf, COLOR_NAME, COLORS, cardLabel, isWild, leaders, top, valueOf,
  type UnoAction, type UnoCard as Card, type UnoColor, type UnoState,
} from "@shared/games/uno/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { MUTED } from "@/lib/palette";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";

/** Gedämpfte Kartenfarben: Rot, Grün (Petrol), Blau, Gelb (Ocker) */
export const UNO_BG: Record<UnoColor, string> = { r: MUTED.red, g: MUTED.teal, b: MUTED.blue, y: MUTED.ochre };

/** Eine Uno-Karte – Farbe als Fläche, Wert groß in der Mitte */
export function UnoCardView({ card, dim, className }: { card: Card; dim?: boolean; className?: string }) {
  const c = colorOf(card);
  const v = valueOf(card);
  const mark = v === "skip" ? <Ban className="size-[45cqw]" strokeWidth={2.5} />
    : v === "rev" ? <Repeat2 className="size-[45cqw]" strokeWidth={2.5} />
    : v === "plus2" ? "+2" : v === "plus4" ? "+4" : v === "wild" ? null : v;
  return (
    <div role="img" aria-label={cardLabel(card)}
      className={cn("@container relative grid aspect-[5/7] place-items-center overflow-hidden rounded-[12%] font-extrabold text-paper shadow-md ring-1 ring-white/25 transition", dim && "brightness-[0.45] saturate-50", className)}
      style={{ background: c ? UNO_BG[c] : MUTED.ink }}>
      {!c && (
        <div className="absolute grid aspect-square w-[68%] grid-cols-2 overflow-hidden rounded-full opacity-90">
          {COLORS.map((k) => <span key={k} style={{ background: UNO_BG[k] }} />)}
        </div>
      )}
      <span className="relative grid aspect-square w-[72%] place-items-center rounded-full bg-white/12 text-[34cqw] leading-none">{mark}</span>
      {mark && typeof mark === "string" && <span className="absolute top-[5%] left-[9%] text-[16cqw] leading-none opacity-80">{mark}</span>}
    </div>
  );
}

export function Board(props: BoardProps<UnoState, UnoAction>) {
  if (props.game.phase === "over") return <Result {...props} />;
  return props.game.mode === "table" ? <TableBoard {...props} /> : <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: BoardProps<UnoState, UnoAction>) {
  const win = leaders(s, room.players).map((id) => room.players.find((p) => p.id === id)?.name ?? "?");
  const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
  const single = room.options.target === "round";
  return <ResultScreen winner={win.join(" & ")} subtitle={single ? "hat alle Karten abgelegt" : `mit ${ranking[0]?.score ?? 0} Punkten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

function AppBoard({ room, game: s, me, online, canAct, act }: BoardProps<UnoState, UnoAction>) {
  const players = room.players;
  const local = me === null;
  const [uno, setUno] = useState(false);
  const [wild, setWild] = useState<Card | null>(null);
  const { covered, reveal } = useHandoff(local && s.phase === "play", s.curId, players.length);
  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = canAct && s.phase === "play" && viewer === s.curId;
  const playable = (c: Card) => myTurn && (!s.drawn || c === s.drawn) && canPlay(s, c, room.options, hand);
  const unoRule = room.options.uno !== false;
  const scored = room.options.target !== "round";

  // Nichts passt: der Stapel leuchtet, damit klar ist, was zu tun ist
  const mustDraw = myTurn && !s.drawn && !covered && !hand.some(playable);
  const play = (c: Card, color?: UnoColor) => {
    vibrate(10);
    act({ type: "play", card: c, color, uno });
    setUno(false);
    setWild(null);
  };
  const status = s.phase === "roundEnd" ? `${players.find((p) => p.id === s.lastRound?.winner)?.name ?? "?"} gewinnt Runde ${s.round} (+${s.lastRound?.points ?? 0})`
    : !myTurn ? `${cur?.name} ist am Zug`
    : s.drawn ? "Gezogene Karte legen – oder passen."
    : s.pendingDraw ? `Leg drauf oder zieh ${s.pendingDraw} Karten.`
    : hand.some(playable) ? "Leg eine passende Karte." : "Nichts passt – zieh eine Karte.";

  return (
    <>
      {/* Mitspieler mit Kartenzahl (und Punkten) */}
      <div className="no-scrollbar -mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Mitspieler">
        {players.map((p) => (
          <div key={p.id} data-cur={p.id === s.curId}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold",
              p.id === s.curId && s.phase === "play" ? "bg-gradient-to-b from-navy-400 to-primary text-white" : "glass")}>
            {online && <span className={cn("size-1.5 rounded-full", online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} />}
            <span className="max-w-[7rem] truncate">{p.id === me ? "Du" : p.name}</span>
            <span className="flex items-center gap-1 tabular-nums" aria-label={`${s.counts[p.id] ?? 0} Karten`}>
              <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-navy-300/80 ring-1 ring-white/40" />{s.counts[p.id] ?? 0}
            </span>
            {scored && <span className="text-xs font-normal tabular-nums opacity-75">{s.scores[p.id] ?? 0}</span>}
          </div>
        ))}
      </div>

      {/* Mitte: Stapel, Ablage, gefragte Farbe */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2">
        <div className="flex h-full max-h-48 min-h-0 w-full items-start justify-center gap-5 pt-5">
          <button type="button" disabled={!myTurn || !!s.drawn || covered} onClick={() => { vibrate(8); act({ type: "draw" }); }}
            aria-label={s.pendingDraw ? `${s.pendingDraw} Karten ziehen` : "Karte ziehen"}
            className={cn("relative h-[68%] rounded-[12%] outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", mustDraw && "target-glow")}>
            <div className="card-back grid aspect-[5/7] h-full place-items-center rounded-[12%] text-lg font-bold text-paper/85 shadow-md">{s.pileCount}</div>
            {s.pendingDraw > 0 && <span className="absolute -top-2 -right-2 rounded-full bg-destructive px-2 py-0.5 text-sm font-extrabold text-navy-950">+{s.pendingDraw}</span>}
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Stapel</span>
          </button>
          <div className="relative h-[86%]" key={s.discard.length}>
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Ablage</span>
            <UnoCardView card={top(s)} className="card-in h-full" />
            {isWild(top(s)) && (
              <span className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy-950/90 px-2.5 py-1 text-xs font-bold whitespace-nowrap ring-1 ring-border" data-testid="color">
                <span className="size-3 rounded-full" style={{ background: UNO_BG[s.color] }} />{COLOR_NAME[s.color]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn((myTurn || s.phase === "roundEnd") && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          {s.phase === "play" && <span aria-label={s.dir === 1 ? "Richtung im Uhrzeigersinn" : "Richtung gegen den Uhrzeigersinn"}>{s.dir === 1 ? "↻" : "↺"}</span>}
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      {/* Hand */}
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "roundEnd" ? (
          <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Nächste Runde</Button>
        ) : covered ? (
          <HandoffCover name={cur?.name ?? "?"} onReveal={reveal} />
        ) : wild ? (
          <div className="glass rounded-2xl p-3">
            <p className="mb-2 text-center text-sm font-semibold">Welche Farbe soll es sein?</p>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => play(wild, c)} aria-label={COLOR_NAME[c]}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-navy-800/60 py-2 text-xs font-bold ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  <span className="size-8 rounded-full ring-2 ring-white/30" style={{ background: UNO_BG[c] }} />{COLOR_NAME[c]}
                </button>
              ))}
            </div>
            <Button variant="ghost" className="mt-1 w-full text-muted-foreground" onClick={() => setWild(null)}>Abbrechen</Button>
          </div>
        ) : (
          <>
            <div className="no-scrollbar -mx-4 flex items-end overflow-x-auto px-4 pt-3 pb-1" data-testid="hand">
              <div className="mx-auto flex items-end">
                {hand.map((c, i) => {
                  const ok = playable(c);
                  return (
                    <button key={`${c}-${hand.slice(0, i).filter((x) => x === c).length}`} type="button" disabled={!ok} data-card={c}
                      onClick={() => (isWild(c) ? setWild(c) : play(c))}
                      className={cn("w-[min(17vw,4.5rem)] shrink-0 rounded-[12%] outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                        i > 0 && (hand.length > 6 ? "-ml-[min(8vw,2.2rem)]" : "-ml-[min(3vw,0.8rem)]"),
                        ok && "-translate-y-2.5", c === s.drawn && "ring-[3px] ring-ice")}>
                      <UnoCardView card={c} dim={myTurn && !ok} className="card-in" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 [&>button]:min-w-0 [&>button]:px-3">
              <Button variant="secondary" size="lg" disabled={!myTurn || !!s.drawn} onClick={() => act({ type: "draw" })}>
                {s.pendingDraw ? `${s.pendingDraw} ziehen` : "Ziehen"}
              </Button>
              {unoRule ? (
                <Button size="lg" variant={uno ? "ice" : "secondary"} aria-pressed={uno} disabled={!myTurn || hand.length !== 2} onClick={() => { vibrate(20); setUno((u) => !u); }}>
                  Uno!
                </Button>
              ) : <span />}
              <Button variant="secondary" size="lg" disabled={!myTurn || !s.drawn} onClick={() => act({ type: "pass" })}>Passen</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Echte Karten: die anderen tragen ihre Handpunkte ein, der Sieger bekommt die Summe */
function TableBoard(props: BoardProps<UnoState, UnoAction>) {
  const { room, game: s, me, isHost, act } = props;
  const players = room.players;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const local = me === null;
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 }));
  const commit = (id: string) => {
    const raw = draft[id];
    if (raw === undefined) return;
    const n = raw.trim() === "" ? null : Number(raw);
    if (n !== null && !Number.isInteger(n)) return;
    act({ type: "enter", player: id, points: n });
  };
  const w = s.tableWinner;
  const missing = w ? players.filter((p) => p.id !== w && (s.entries[p.id] === null || s.entries[p.id] === undefined)).length : 0;
  const sum = players.reduce((t, p) => t + (p.id === w ? 0 : s.entries[p.id] ?? 0), 0);
  const scored = room.options.target !== "round";

  return (
    <>
      {scored && <Scoreboard entries={entries} currentId={null} me={me} online={props.online} />}
      <div className="flex shrink-0 items-center justify-between px-1 pt-1 text-sm text-muted-foreground">
        <span>Runde {s.round}{scored ? " · bis 500" : ""}</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">Tippt an, wer leer ist. Alle anderen tragen ihre Kartenpunkte ein (Zahl = Wert, Aktion 20, Schwarz 50).</p>
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {players.map((p) => {
          const editable = local || isHost || p.id === me;
          const isW = w === p.id;
          const val = isW ? "0" : draft[p.id] ?? (s.entries[p.id] === null || s.entries[p.id] === undefined ? "" : String(s.entries[p.id]));
          return (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}</span>
              <Input value={val} disabled={!editable || isW} inputMode="numeric" aria-label={`Punkte ${p.name}`} className="h-10 w-20 text-center text-lg font-bold"
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                onBlur={() => commit(p.id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <button type="button" aria-pressed={isW} aria-label={`${p.name} ist leer`}
                onClick={() => { setDraft((d) => { const n = { ...d }; delete n[p.id]; return n; }); act({ type: "setWinner", player: isW ? null : p.id }); }}
                className={cn("rounded-lg px-2 py-2 text-xs font-bold ring-1 ring-inset", isW ? "bg-ice text-navy-950 ring-transparent" : "text-muted-foreground ring-border")}>leer</button>
            </div>
          );
        })}
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isHost ? (
          <Button size="lg" disabled={!w || missing > 0} onClick={() => { vibrate(10); setDraft({}); act({ type: "finishRound" }); }}>
            {!w ? "Wer ist leer?" : missing ? `Noch ${missing} ${missing === 1 ? "Eintrag" : "Einträge"}` : `+${sum} für ${players.find((p) => p.id === w)?.name}`}
          </Button>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">{missing || !w ? "Trag deine Punkte ein." : "Der Host schließt die Runde ab."}</p>}
      </div>
    </>
  );
}
