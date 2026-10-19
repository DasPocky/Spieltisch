import { useId, useState } from "react";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { useDeskKeys } from "@/platform/desk/keys";
import { Seats } from "@/platform/Seats";
import {
  canPlay, colorOf, COLOR_NAME, COLORS, cardLabel, isWild, leaders, top, valueOf,
  type EinsAction, type EinsCard as Card, type EinsColor, type EinsState,
} from "@shared/games/eins/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { HintChip } from "@/platform/HintChip";
import { useHints } from "@/lib/prefs";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";

/** Kartenfarben wie beim Original: kräftiges Rot, Grün, Blau, Gelb */
export const EINS_BG: Record<EinsColor, string> = { r: "#d72600", g: "#379711", b: "#0956bf", y: "#ecd407" };

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
    <rect x={-w} y={-h} width={w} height={h} fill={EINS_BG.r} /><rect y={-h} width={w} height={h} fill={EINS_BG.b} />
    <rect x={-w} width={w} height={h} fill={EINS_BG.y} /><rect width={w} height={h} fill={EINS_BG.g} />
  </>
);

/** Kleine Karte für +2/+4 */
const Mini = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <rect x={x - 5} y={y - 7.5} width={10} height={15} rx={1.8} fill={fill} stroke={INK} strokeWidth={1.1} />
);

/** Eine Eins-Karte – weißer Rand, Farbfläche, runder weißer Kreis mit Wert (gerade, kein Oval), Ecken-Indizes */
export function EinsCardView({ card, dim, className }: { card: Card; dim?: boolean; className?: string }) {
  const id = useId();
  const c = colorOf(card);
  const v = valueOf(card);
  const fill = c ? EINS_BG[c] : INK;
  const num = /^\d$/.test(v) ? v : null;
  const label = num ?? (v === "plus2" ? "+2" : v === "plus4" ? "+4" : null);
  // Ecken-Index: Zahl/„+2“ als Text, sonst verkleinertes Symbol
  const corner = label ? (
    <text textAnchor="middle" dominantBaseline="central" fontSize={label.length > 1 ? 10.5 : 13.5} fontWeight={800} fill="#fff" style={outl(1.6)}
      textDecoration={num === "6" || num === "9" ? "underline" : undefined}>{label}</text>
  ) : v === "skip" ? <g transform="scale(.6)"><SkipMark fill="#fff" /></g>
    : v === "rev" ? <g transform="scale(.55)"><RevMark fill="#fff" /></g>
    : <g><g clipPath={`url(#${id}c)`}><Quads w={5} h={5} /></g><circle r={4.8} fill="none" stroke="#fff" strokeWidth={0.9} /></g>;
  return (
    <div role="img" aria-label={cardLabel(card)}
      className={cn("@container relative aspect-[5/7] overflow-hidden rounded-[12%] bg-white shadow-md ring-1 ring-black/20 transition", dim && "card-dim", className)}>
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <clipPath id={`${id}o`}><circle r={17.5} /></clipPath>
          <clipPath id={`${id}c`}><circle r={4.8} /></clipPath>
        </defs>
        <rect x={2.6} y={2.6} width={44.8} height={64.8} rx={4.6} fill={fill} />
        <g transform="translate(25 35)">
          {v === "wild" ? (
            <g clipPath={`url(#${id}o)`}><Quads w={18} h={18} /></g>
          ) : <circle r={17.5} fill="#fff" />}
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
          {v === "plus4" && <><Mini x={-5.5} y={3} fill={EINS_BG.b} /><Mini x={-1.5} y={-4} fill={EINS_BG.g} /><Mini x={2} y={5} fill={EINS_BG.r} /><Mini x={6} y={-2} fill={EINS_BG.y} /></>}
        </g>
        <g transform="translate(9 11)">{corner}</g>
        <g transform="translate(41 59) rotate(180)">{corner}</g>
      </svg>
    </div>
  );
}

/** Rückseite: dunkel mit weißem Rand und vier farbigen Punkten im Quadrat – ohne Schriftzug */
export function EinsBack({ count }: { count: number }) {
  return (
    <div className="relative aspect-[5/7] h-full overflow-hidden rounded-[12%] bg-white shadow-md ring-1 ring-black/20">
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        <rect x={2.6} y={2.6} width={44.8} height={64.8} rx={4.6} fill={INK} />
        {(["r", "y", "g", "b"] as const).map((k, i) => <circle key={k} cx={i % 2 ? 31 : 19} cy={i < 2 ? 29 : 41} r={5.5} fill={EINS_BG[k]} stroke="#fff" strokeWidth={1} />)}
      </svg>
      {/* Restkarten als kleines Schild – nicht wie ein Kartenwert in der Mitte */}
      <span className="absolute bottom-[7%] left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-[#1a1a1a] tabular-nums shadow">{count}</span>
    </div>
  );
}

export function Board(props: BoardProps<EinsState, EinsAction>) {
  if (props.game.phase === "over") return <Result {...props} />;
  return props.game.mode === "table" ? <TableBoard {...props} /> : <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: BoardProps<EinsState, EinsAction>) {
  const win = leaders(s, room.players).map((id) => room.players.find((p) => p.id === id)?.name ?? "?");
  const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
  const single = room.options.target === "round";
  return <ResultScreen winner={win.join(" & ")} subtitle={single ? "hat alle Karten abgelegt" : `mit ${ranking[0]?.score ?? 0} Punkten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

function AppBoard({ room, game: s, me, online, canAct, act, desk }: BoardProps<EinsState, EinsAction>) {
  const players = room.players;
  const local = me === null;
  const [eins, setEins] = useState(false);
  const [wild, setWild] = useState<Card | null>(null);
  const [seven, setSeven] = useState<Card | null>(null);
  const hints = useHints();
  const { covered, reveal } = useHandoff(local && s.phase === "play", s.curId, players.length);
  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = canAct && s.phase === "play" && viewer === s.curId;
  const playable = (c: Card) => myTurn && (!s.drawn || c === s.drawn) && canPlay(s, c, room.options, hand);
  const einsRule = room.options.eins !== false;
  const scored = room.options.target !== "round";

  // Nichts passt: der Stapel leuchtet, damit klar ist, was zu tun ist
  const mustDraw = myTurn && !s.drawn && !covered && !s.pickColor && !hand.some(playable);
  const play = (c: Card, color?: EinsColor, target?: string) => {
    vibrate(10);
    act({ type: "play", card: c, color, eins, target });
    setEins(false);
    setWild(null);
    setSeven(null);
  };
  // Hausregel 7-0: bei der 7 erst den Tauschpartner wählen
  const others = players.filter((p) => p.id !== viewer && p.id in s.counts);
  const pick = (c: Card) => (isWild(c) ? setWild(c)
    : room.options.sevenZero === true && valueOf(c) === "7" && hand.length > 1 && others.length > 1 ? setSeven(c) : play(c));
  const byName = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";
  // Spielhilfe: gezogene Karte passt – mit einem Tipp direkt legen
  const drawnFits = hints && !covered && !!s.drawn && playable(s.drawn);
  const status = s.phase === "roundEnd" ? `${players.find((p) => p.id === s.lastRound?.winner)?.name ?? "?"} gewinnt Runde ${s.round} (+${s.lastRound?.points ?? 0})`
    : !myTurn ? `${cur?.name} ist am Zug`
    : s.pickColor ? "Startkarte Farbwahl – du bestimmst die Farbe."
    : s.challenge ? `${byName(s.challenge.by)} legt +4 – ziehen oder anzweifeln?`
    : s.drawn ? (playable(s.drawn) ? "Gezogene Karte legen – oder passen." : "Die gezogene Karte passt nicht – tippe auf Passen.")
    : s.pendingDraw ? `Leg drauf oder zieh ${s.pendingDraw} Karten.`
    : hand.some(playable) ? "Leg eine passende Karte." : "Nichts passt – zieh eine Karte.";

  // Am Rechner am Tisch: Stapel, Ablage und Mitspieler zeigt der Tisch darüber – hier nur die eigene Hand
  if (desk) {
    return <EinsDesk {...{ s, hand, playable, myTurn, eins, setEins, einsRule, wild, setWild, seven, setSeven, others, play, pick, act, status, drawnFits, hints }} />;
  }

  return (
    <>
      {/* Mitspieler mit Kartenzahl (und Punkten) */}
      <Seats me={me} online={online} seats={players.map((p) => ({
        id: p.id, name: p.name, cur: p.id === s.curId && s.phase === "play",
        value: <span className="inline-flex items-center gap-0.5" aria-label={`${s.counts[p.id] ?? 0} Karten`}><span className="inline-block h-3 w-2 rounded-[2px] bg-current opacity-60" />{s.counts[p.id] ?? 0}</span>,
        sub: scored ? `${s.scores[p.id] ?? 0} Pkt.` : undefined,
      }))} />

      {/* Mitte: Stapel, Ablage, gefragte Farbe */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2">
        <div className="flex h-full max-h-48 min-h-0 w-full items-start justify-center gap-5 pt-5">
          <button type="button" disabled={!myTurn || !!s.drawn || covered || !!s.pickColor} onClick={() => { vibrate(8); act({ type: "draw" }); }}
            aria-label={s.challenge ? "4 Karten ziehen" : s.pendingDraw ? `${s.pendingDraw} Karten ziehen` : "Karte ziehen"}
            className={cn("relative h-[68%] rounded-[12%] outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", mustDraw && "target-glow")}>
            <EinsBack count={s.pileCount} />
            {s.pendingDraw > 0 && <span className="absolute -top-2 -right-2 rounded-full bg-destructive px-2 py-0.5 text-sm font-bold text-navy-950">+{s.pendingDraw}</span>}
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Stapel</span>
          </button>
          <div className="relative h-[86%]" key={s.discard.length}>
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Ablage</span>
            <EinsCardView card={top(s)} className="card-land h-full" />
            {isWild(top(s)) && !s.pickColor && (
              <span className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy-950/90 px-2.5 py-1 text-xs font-bold whitespace-nowrap ring-1 ring-border" data-testid="color">
                <span className="size-3 rounded-full" style={{ background: EINS_BG[s.color] }} />{COLOR_NAME[s.color]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {drawnFits ? <span data-testid="status"><HintChip onClick={() => pick(s.drawn!)}>Passt – direkt legen?</HintChip></span>
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
        ) : seven ? (
          <div className="glass rounded-2xl p-3">
            <p className="mb-2 text-center text-sm font-semibold">Mit wem tauschst du die Karten?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {others.map((p) => <Button key={p.id} variant="secondary" onClick={() => play(seven, undefined, p.id)}>{p.name} ({s.counts[p.id] ?? 0})</Button>)}
            </div>
            <Button variant="ghost" className="mt-1 w-full text-muted-foreground" onClick={() => setSeven(null)}>Abbrechen</Button>
          </div>
        ) : wild ? (
          <div className="glass rounded-2xl p-3">
            <p className="mb-2 text-center text-sm font-semibold">Welche Farbe soll es sein?</p>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => play(wild, c)} aria-label={COLOR_NAME[c]}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-navy-800/60 py-2 text-xs font-bold ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  <span className="size-8 rounded-full ring-2 ring-white/30" style={{ background: EINS_BG[c] }} />{COLOR_NAME[c]}
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
                      onClick={() => pick(c)}
                      className={cn("card-in w-[min(17vw,4.5rem)] shrink-0 rounded-[12%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                        ok && "-translate-y-2.5", c === s.drawn ? "ring-[3px] ring-ice" : ok && hints && "hint-glow")}>
                      <EinsCardView card={c} dim={myTurn && !ok} />
                    </button>
                  );
                })}
            </Fan>
            {myTurn && s.pickColor ? (
              // Startkarte Farbwahl: Farbe mit Blick auf die eigene Hand wählen
              <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Startfarbe wählen">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => { vibrate(10); act({ type: "color", color: c }); }} aria-label={COLOR_NAME[c]}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-navy-800/60 text-xs font-bold ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                    <span className="size-5 rounded-full ring-2 ring-white/30" style={{ background: EINS_BG[c] }} />{COLOR_NAME[c]}
                  </button>
                ))}
              </div>
            ) : (
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 [&>button]:min-w-0 [&>button]:px-3">
              <Button variant="secondary" size="lg" disabled={!myTurn || !!s.drawn} onClick={() => act({ type: "draw" })}>
                {s.challenge ? "4 ziehen" : s.pendingDraw ? `${s.pendingDraw} ziehen` : "Ziehen"}
              </Button>
              {einsRule ? (
                <Button size="lg" variant={eins ? "ice" : "secondary"} aria-pressed={eins} disabled={!myTurn || hand.length !== 2} onClick={() => { vibrate(20); setEins((u) => !u); }}>
                  Eins!
                </Button>
              ) : <span />}
              {s.challenge ? <Button size="lg" disabled={!myTurn} onClick={() => act({ type: "doubt" })}>Anzweifeln</Button>
                : <Button variant="secondary" size="lg" disabled={!myTurn || !s.drawn} onClick={() => act({ type: "pass" })}>Passen</Button>}
            </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Echte Karten: die anderen tragen ihre Handpunkte ein, der Sieger bekommt die Summe */
function TableBoard(props: BoardProps<EinsState, EinsAction>) {
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

/** Eins! am Rechner: große Hand, Knöpfe und Tastatur (1–9 legen, Z ziehen, U Eins!, P passen, A anzweifeln, 1–4 Farbe, Esc zurück) */
function EinsDesk({ s, hand, playable, myTurn, eins, setEins, einsRule, wild, setWild, seven, setSeven, others, play, pick, act, status, drawnFits, hints }: {
  s: EinsState; hand: Card[]; playable: (c: Card) => boolean; myTurn: boolean; eins: boolean; setEins: (f: (u: boolean) => boolean) => void; einsRule: boolean;
  wild: Card | null; setWild: (c: Card | null) => void; seven: Card | null; setSeven: (c: Card | null) => void; others: { id: string; name: string }[];
  play: (c: Card, color?: EinsColor, target?: string) => void; pick: (c: Card) => void; act: (a: EinsAction) => void; status: string; drawnFits: boolean; hints: boolean;
}) {
  useDeskKeys((e) => {
      const n = Number(e.key);
      if (wild || (myTurn && s.pickColor)) {
        if (e.key === "Escape") setWild(null);
        else if (n >= 1 && n <= 4) (wild ? play(wild, COLORS[n - 1]) : act({ type: "color", color: COLORS[n - 1] }));
        return;
      }
      if (seven) {
        if (e.key === "Escape") setSeven(null);
        else if (n >= 1 && n <= others.length) play(seven, undefined, others[n - 1].id);
        return;
      }
      if (s.phase === "roundEnd") { if (e.key === "Enter") act({ type: "nextRound" }); return; }
      if (!myTurn) return;
      const k = e.key.toLowerCase();
      if (n >= 1 && n <= hand.length && playable(hand[n - 1])) pick(hand[n - 1]);
      else if (k === "z" && !s.drawn) act({ type: "draw" });
      else if (k === "p" && s.drawn) act({ type: "pass" });
      else if (k === "a" && s.challenge) act({ type: "doubt" });
      else if (k === "u" && einsRule && hand.length === 2) setEins((u) => !u);
  });

  const colorPick = (onPick: (c: EinsColor) => void, title: string, onCancel?: () => void) => (
    <div className="glass mx-auto rounded-2xl p-4">
      <p className="mb-2 text-center font-semibold">{title} <span className="font-normal text-muted-foreground">(1–4{onCancel ? ", Esc" : ""})</span></p>
      <div className="grid grid-cols-4 gap-3">
        {COLORS.map((c, i) => (
          <button key={c} type="button" onClick={() => onPick(c)} aria-label={COLOR_NAME[c]} title={`${i + 1}: ${COLOR_NAME[c]}`}
            className="flex w-24 flex-col items-center gap-1.5 rounded-xl bg-navy-800/60 py-3 font-bold ring-1 ring-inset ring-border outline-none transition hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring">
            <span className="size-10 rounded-full ring-2 ring-white/30" style={{ background: EINS_BG[c] }} />{COLOR_NAME[c]}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-3 text-base">
        {drawnFits ? <span data-testid="status"><HintChip onClick={() => pick(s.drawn!)}>Passt – direkt legen?</HintChip></span>
          : <span data-testid="status" className={cn(myTurn && "font-semibold")}><SmoothText>{status}</SmoothText></span>}
      </div>
      {s.phase === "roundEnd" ? (
        <Button size="lg" className="mx-auto" onClick={() => act({ type: "nextRound" })}>Nächste Runde <kbd className="ml-1 text-xs opacity-60">Enter</kbd></Button>
      ) : wild ? colorPick((c) => play(wild, c), "Welche Farbe soll es sein?", () => setWild(null))
        : myTurn && s.pickColor ? colorPick((c) => act({ type: "color", color: c }), "Startkarte Farbwahl – welche Farbe?")
        : seven ? (
          <div className="glass mx-auto rounded-2xl p-4">
            <p className="mb-2 text-center font-semibold">Mit wem tauschst du die Karten? <span className="font-normal text-muted-foreground">(Zahl, Esc)</span></p>
            <div className="flex flex-wrap justify-center gap-2">
              {others.map((p, i) => <Button key={p.id} variant="secondary" onClick={() => play(seven, undefined, p.id)}>{i + 1}: {p.name}</Button>)}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-center gap-2" data-testid="hand">
              {hand.map((c, i) => {
                const ok = playable(c);
                return (
                  <button key={`${c}-${hand.slice(0, i).filter((x) => x === c).length}`} type="button" disabled={!ok} onClick={() => pick(c)}
                    title={`${i + 1}: ${ok ? "legen" : myTurn ? "passt gerade nicht" : "warte, bis du dran bist"}`}
                    className={cn("card-in w-24 shrink-0 rounded-[12%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default xl:w-28",
                      ok && "-translate-y-3 hover:-translate-y-6", c === s.drawn ? "ring-[3px] ring-ice" : ok && hints && "hint-glow")}>
                    <EinsCardView card={c} dim={myTurn && !ok} />
                  </button>
                );
              })}
            </div>
            <div className="mx-auto grid w-full max-w-xl grid-cols-[1fr_auto_1fr] gap-2">
              <Button variant="secondary" size="lg" disabled={!myTurn || !!s.drawn} onClick={() => act({ type: "draw" })} title="Z">
                {s.challenge ? "4 ziehen" : s.pendingDraw ? `${s.pendingDraw} ziehen` : "Ziehen"} <kbd className="ml-1 text-xs opacity-60">Z</kbd>
              </Button>
              {einsRule ? (
                <Button size="lg" variant={eins ? "ice" : "secondary"} aria-pressed={eins} disabled={!myTurn || hand.length !== 2} onClick={() => setEins((u) => !u)} title="U">
                  Eins! <kbd className="ml-1 text-xs opacity-60">U</kbd>
                </Button>
              ) : <span />}
              {s.challenge ? <Button size="lg" disabled={!myTurn} onClick={() => act({ type: "doubt" })} title="A">Anzweifeln <kbd className="ml-1 text-xs opacity-60">A</kbd></Button>
                : <Button variant="secondary" size="lg" disabled={!myTurn || !s.drawn} onClick={() => act({ type: "pass" })} title="P">Passen <kbd className="ml-1 text-xs opacity-60">P</kbd></Button>}
            </div>
          </>
        )}
    </div>
  );
}
