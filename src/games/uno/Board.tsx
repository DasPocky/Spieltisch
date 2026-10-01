import { useId, useState } from "react";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { PlayerRow } from "@/platform/PlayerRow";
import {
  canPlay, colorOf, COLOR_NAME, COLORS, cardLabel, isWild, leaders, top, valueOf,
  type UnoAction, type UnoCard as Card, type UnoColor, type UnoState,
} from "@shared/games/uno/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { HintChip } from "@/platform/HintChip";
import { usePrefs } from "@/lib/prefs";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";

/** Kartenfarben wie beim Original: kräftiges Rot, Grün, Blau, Gelb */
export const UNO_BG: Record<UnoColor, string> = { r: "#d72600", g: "#379711", b: "#0956bf", y: "#ecd407" };

const INK = "#161616";
/** Text mit dunkler Kontur (Kontur unter der Füllung) */
const outl = (w: number) => ({ stroke: INK, strokeWidth: w, paintOrder: "stroke", strokeLinejoin: "round" }) as const;

/** Aussetzen: Kreis mit Schrägstrich */
const SkipMark = ({ fill }: { fill: string }) => (
  <g fill="none" strokeLinecap="round">
    <g stroke={INK} strokeWidth={5}><circle r={7.5} /><path d="M-5 5L5-5" /></g>
    <g stroke={fill} strokeWidth={3}><circle r={7.5} /><path d="M-5 5L5-5" /></g>
  </g>
);

/** Richtungswechsel: zwei gegenläufige Pfeile */
const ARROW = "M-1.8 9V-1.5H-5L0-8.5L5-1.5H1.8V9Z";
const RevMark = ({ fill }: { fill: string }) => (
  <g fill={fill} stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
    <path d={ARROW} transform="translate(-3.4 -3.4) rotate(45)" />
    <path d={ARROW} transform="translate(3.4 3.4) rotate(225)" />
  </g>
);

/** Vier Farbviertel (Farbwahl-Oval) */
const Quads = ({ w, h }: { w: number; h: number }) => (
  <>
    <rect x={-w} y={-h} width={w} height={h} fill={UNO_BG.r} /><rect y={-h} width={w} height={h} fill={UNO_BG.b} />
    <rect x={-w} width={w} height={h} fill={UNO_BG.y} /><rect width={w} height={h} fill={UNO_BG.g} />
  </>
);

/** Kleine Karte für +2/+4 */
const Mini = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <rect x={x - 5} y={y - 7.5} width={10} height={15} rx={1.8} fill={fill} stroke={INK} strokeWidth={1.1} />
);

/** Eine Uno-Karte – weißer Rand, Farbfläche, schräges Oval mit Wert, Ecken-Indizes */
export function UnoCardView({ card, dim, className }: { card: Card; dim?: boolean; className?: string }) {
  const id = useId();
  const c = colorOf(card);
  const v = valueOf(card);
  const fill = c ? UNO_BG[c] : INK;
  const num = /^\d$/.test(v) ? v : null;
  const label = num ?? (v === "plus2" ? "+2" : v === "plus4" ? "+4" : null);
  // Ecken-Index: Zahl/„+2“ als Text, sonst verkleinertes Symbol
  const corner = label ? (
    <text textAnchor="middle" dominantBaseline="central" fontSize={label.length > 1 ? 10.5 : 13.5} fontWeight={800} fill="#fff" style={outl(1.6)}
      textDecoration={num === "6" || num === "9" ? "underline" : undefined}>{label}</text>
  ) : v === "skip" ? <g transform="scale(.6)"><SkipMark fill="#fff" /></g>
    : v === "rev" ? <g transform="scale(.55)"><RevMark fill="#fff" /></g>
    : <g transform="rotate(30) scale(1.15)"><g clipPath={`url(#${id}c)`}><Quads w={4} h={6.5} /></g><ellipse rx={3.6} ry={6} fill="none" stroke="#fff" strokeWidth={0.9} /></g>;
  return (
    <div role="img" aria-label={cardLabel(card)}
      className={cn("@container relative aspect-[5/7] overflow-hidden rounded-[12%] bg-white shadow-md ring-1 ring-black/20 transition", dim && "card-dim", className)}>
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <clipPath id={`${id}o`}><ellipse rx={15.5} ry={27} /></clipPath>
          <clipPath id={`${id}c`}><ellipse rx={3.6} ry={6} /></clipPath>
        </defs>
        <rect x={2.6} y={2.6} width={44.8} height={64.8} rx={4.6} fill={fill} />
        <g transform="translate(25 35) rotate(30)">
          {v === "wild" ? (
            <g clipPath={`url(#${id}o)`}><Quads w={16} h={28} /></g>
          ) : <ellipse rx={15.5} ry={27} fill="#fff" />}
        </g>
        <g transform="translate(25 35)">
          {num && (
            <g fontWeight={800} textAnchor="middle" dominantBaseline="central" fontSize={30}>
              <text x={1.3} y={1.5} fill={INK} style={outl(2.4)}>{num}</text>
              <text fill={fill} style={outl(2.4)}>{num}</text>
              {(num === "6" || num === "9") && <rect x={-6} y={12.5} width={12} height={2.6} rx={1} fill={fill} stroke={INK} strokeWidth={1} />}
            </g>
          )}
          {v === "skip" && <g transform="scale(1.25)"><SkipMark fill={fill} /></g>}
          {v === "rev" && <g transform="scale(1.15)"><RevMark fill={fill} /></g>}
          {v === "plus2" && <><Mini x={-3} y={3} fill={fill} /><Mini x={3} y={-3} fill={fill} /></>}
          {v === "plus4" && <><Mini x={-5.5} y={3} fill={UNO_BG.b} /><Mini x={-1.5} y={-4} fill={UNO_BG.g} /><Mini x={2} y={5} fill={UNO_BG.r} /><Mini x={6} y={-2} fill={UNO_BG.y} /></>}
        </g>
        <g transform="translate(9 11)">{corner}</g>
        <g transform="translate(41 59) rotate(180)">{corner}</g>
      </svg>
    </div>
  );
}

/** Rückseite: schwarz mit weißem Rand und schrägem roten Oval – ohne Schriftzug */
export function UnoBack({ count }: { count: number }) {
  return (
    <div className="relative aspect-[5/7] h-full overflow-hidden rounded-[12%] bg-white shadow-md ring-1 ring-black/20">
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        <rect x={2.6} y={2.6} width={44.8} height={64.8} rx={4.6} fill={INK} />
        <ellipse cx={25} cy={35} rx={15.5} ry={27} transform="rotate(30 25 35)" fill={UNO_BG.r} />
      </svg>
      {/* Restkarten als kleines Schild – nicht wie ein Kartenwert in der Mitte */}
      <span className="absolute bottom-[7%] left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-[#1a1a1a] tabular-nums shadow">{count}</span>
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
  const { hints } = usePrefs();
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
  // Spielhilfe: gezogene Karte passt – mit einem Tipp direkt legen
  const drawnFits = hints && !covered && !!s.drawn && playable(s.drawn);
  const status = s.phase === "roundEnd" ? `${players.find((p) => p.id === s.lastRound?.winner)?.name ?? "?"} gewinnt Runde ${s.round} (+${s.lastRound?.points ?? 0})`
    : !myTurn ? `${cur?.name} ist am Zug`
    : s.drawn ? (playable(s.drawn) ? "Gezogene Karte legen – oder passen." : "Die gezogene Karte passt nicht – tippe auf Passen.")
    : s.pendingDraw ? `Leg drauf oder zieh ${s.pendingDraw} Karten.`
    : hand.some(playable) ? "Leg eine passende Karte." : "Nichts passt – zieh eine Karte.";

  return (
    <>
      {/* Mitspieler mit Kartenzahl (und Punkten) */}
      <PlayerRow>
        {players.map((p) => (
          <div key={p.id} data-cur={p.id === s.curId}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold",
              p.id === s.curId && s.phase === "play" ? "turn" : "glass")}>
            {online && <span className={cn("size-1.5 rounded-full", online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} />}
            <span className="max-w-[7rem] truncate">{p.id === me ? "Du" : p.name}</span>
            <span className="flex items-center gap-1 tabular-nums" aria-label={`${s.counts[p.id] ?? 0} Karten`}>
              <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-navy-300/80 ring-1 ring-white/40" />{s.counts[p.id] ?? 0}
            </span>
            {scored && <span className="text-xs font-normal tabular-nums opacity-75">{s.scores[p.id] ?? 0}</span>}
          </div>
        ))}
      </PlayerRow>

      {/* Mitte: Stapel, Ablage, gefragte Farbe */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2">
        <div className="flex h-full max-h-48 min-h-0 w-full items-start justify-center gap-5 pt-5">
          <button type="button" disabled={!myTurn || !!s.drawn || covered} onClick={() => { vibrate(8); act({ type: "draw" }); }}
            aria-label={s.pendingDraw ? `${s.pendingDraw} Karten ziehen` : "Karte ziehen"}
            className={cn("relative h-[68%] rounded-[12%] outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", mustDraw && "target-glow")}>
            <UnoBack count={s.pileCount} />
            {s.pendingDraw > 0 && <span className="absolute -top-2 -right-2 rounded-full bg-destructive px-2 py-0.5 text-sm font-bold text-navy-950">+{s.pendingDraw}</span>}
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Stapel</span>
          </button>
          <div className="relative h-[86%]" key={s.discard.length}>
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Ablage</span>
            <UnoCardView card={top(s)} className="card-land h-full" />
            {isWild(top(s)) && (
              <span className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy-950/90 px-2.5 py-1 text-xs font-bold whitespace-nowrap ring-1 ring-border" data-testid="color">
                <span className="size-3 rounded-full" style={{ background: UNO_BG[s.color] }} />{COLOR_NAME[s.color]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {drawnFits ? <span data-testid="status"><HintChip onClick={() => (isWild(s.drawn!) ? setWild(s.drawn) : play(s.drawn!))}>Passt – direkt legen?</HintChip></span>
            : <span data-testid="status" className={cn((myTurn || s.phase === "roundEnd") && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>}
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
            <Fan count={hand.length}>
                {hand.map((c, i) => {
                  const ok = playable(c);
                  return (
                    <button key={`${c}-${hand.slice(0, i).filter((x) => x === c).length}`} type="button" disabled={!ok} data-card={c} style={dealDelay(i)}
                      onClick={() => (isWild(c) ? setWild(c) : play(c))}
                      className={cn("card-in w-[min(17vw,4.5rem)] shrink-0 rounded-[12%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                        ok && "-translate-y-2.5", c === s.drawn ? "ring-[3px] ring-ice" : ok && hints && "hint-glow")}>
                      <UnoCardView card={c} dim={myTurn && !ok} />
                    </button>
                  );
                })}
            </Fan>
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
