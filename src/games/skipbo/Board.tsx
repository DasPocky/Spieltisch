import { useId, useState } from "react";
import { PlayerRow } from "@/platform/PlayerRow";
import { fits, JOKER, leaders, needs, topOf, type SbAction, type SbCard, type SbState, type Source } from "@shared/games/skipbo/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";

/** Zahlenfarbe wie beim Original: 1–4 blau, 5–8 grün, 9–12 rot */
const ink = (c: number) => (c <= 4 ? "#1d5fc4" : c <= 8 ? "#23913c" : "#d3262b");
const STAR = "M0-10L2.9-4 9.5-3.1 4.7 1.5 5.9 8.1 0 5 -5.9 8.1-4.7 1.5-9.5-3.1-2.9-4Z";

/** Eine Karte. `shown` überschreibt die Zahl (Joker auf dem Aufbaustapel zählt als die Stelle, an der er liegt). */
export function SbCardView({ card, shown, className, small }: { card: SbCard | undefined; shown?: number; className?: string; small?: boolean }) {
  const id = useId();
  if (card === undefined) return <div className={cn("aspect-[5/7] rounded-[12%] ring-1 ring-inset ring-border ring-dashed", className)} />;
  const joker = card === JOKER;
  const value = shown ?? card;
  const col = joker ? "#fff" : ink(card);
  const line = joker ? { stroke: "#5a1030", strokeWidth: 2, paintOrder: "stroke", strokeLinejoin: "round" } as const : undefined;
  // Ecke: Zahl, beim reinen Joker ein Stern
  const corner = joker && !shown ? <path d={STAR} transform="scale(.42)" fill="#fff" stroke="#5a1030" strokeWidth={2} />
    : <text textAnchor="middle" dominantBaseline="central" fontSize={value > 9 ? 8.5 : 10} fontWeight={800} fill={col} style={line}>{value}</text>;
  return (
    <div role="img" aria-label={joker ? (shown ? `Skip-Bo als ${shown}` : "Skip-Bo") : String(card)}
      className={cn("@container relative aspect-[5/7] overflow-hidden rounded-[12%] shadow ring-1 ring-black/15", joker ? "bg-[#e8501f]" : "bg-[#fbf8f1]", className)}>
      <svg viewBox="0 0 50 70" className="absolute inset-0 size-full" aria-hidden="true">
        {joker ? (
          <>
            <defs><linearGradient id={`${id}j`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7941d" /><stop offset=".55" stopColor="#e8501f" /><stop offset="1" stopColor="#c2185b" /></linearGradient></defs>
            <rect width={50} height={70} fill={`url(#${id}j)`} />
            <rect x={3.5} y={3.5} width={43} height={63} rx={4} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={1.4} />
          </>
        ) : <rect x={3.5} y={3.5} width={43} height={63} rx={4} fill="none" stroke={col} strokeWidth={1.6} />}
        <g transform="translate(25 35)">
          {joker && !shown ? <path d={STAR} transform={`scale(${small ? 1.9 : 1.6})`} fill="#fff" stroke="#5a1030" strokeWidth={1.2} strokeLinejoin="round" />
            : <text textAnchor="middle" dominantBaseline="central" fontWeight={800} fontSize={(small ? 36 : 30) * (value > 9 ? 0.8 : 1)} letterSpacing={value > 9 ? -1.5 : 0}
                fill={col} style={line}>{value}</text>}
        </g>
        {!small && <>
          <g transform="translate(10 11.5)">{corner}</g>
          <g transform="translate(40 58.5) rotate(180)">{corner}</g>
        </>}
        {small && joker && !!shown && <path d={STAR} transform="translate(25 60) scale(.35)" fill="#fff" />}
      </svg>
    </div>
  );
}

export function Board(props: BoardProps<SbState, SbAction>) {
  if (props.game.phase === "over") return <Result {...props} />;
  return props.game.mode === "table" ? <TableBoard {...props} /> : <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: BoardProps<SbState, SbAction>) {
  const single = room.options.target !== "500";
  const win = single && s.roundWinner ? [s.roundWinner] : leaders(s, room.players);
  const names = win.map((id) => room.players.find((p) => p.id === id)?.name ?? "?");
  const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: single ? s.stockCounts[p.id] ?? 0 : s.scores[p.id] ?? 0 }))
    .sort((a, b) => (single ? a.score - b.score : b.score - a.score));
  return <ResultScreen winner={names.join(" & ")} subtitle={single ? "hat den Vorrat als Erster los" : `mit ${s.scores[win[0]] ?? 0} Punkten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel={single ? "Vorrat übrig" : "Punkte"} />;
}

type Pick = Source | null;

/** Kleine Bereichs-Überschrift */
const Label = ({ children }: { children: React.ReactNode }) => <span className="text-[0.66rem] font-bold tracking-wider text-muted-foreground uppercase">{children}</span>;
const same = (a: Pick, b: Pick) => !!a && !!b && a.from === b.from && (a.from !== "hand" || a.card === (b as typeof a).card) && (a.from !== "discard" || a.i === (b as typeof a).i);

function AppBoard({ room, game: s, me, online, canAct, act }: BoardProps<SbState, SbAction>) {
  const players = room.players;
  const local = me === null;
  const [pick, setPick] = useState<Pick>(null);
  const { covered, reveal } = useHandoff(local && s.phase === "play", s.curId, players.length);
  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const myTurn = canAct && s.phase === "play" && viewer === s.curId && !covered;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const stock = viewer ? s.stocks[viewer] ?? [] : [];
  const discards = viewer ? s.discards[viewer] ?? [[], [], [], []] : [[], [], [], []];
  const others = players.filter((p) => p.id !== viewer);

  const cardOf = (p: Pick): SbCard | undefined => !p ? undefined : p.from === "hand" ? p.card : p.from === "stock" ? topOf(stock) : topOf(discards[p.i]);
  const picked = cardOf(pick);
  const select = (p: Source) => { if (!myTurn) return; vibrate(6); setPick((q) => (same(q, p) ? null : p)); };
  const playTo = (to: number) => {
    if (!pick || picked === undefined || !fits(s.builds[to], picked)) return;
    vibrate(10);
    act({ type: "play", to, ...pick } as SbAction);
    setPick(null);
  };
  const discardTo = (to: number) => {
    if (!myTurn) return;
    if (pick?.from === "hand") { vibrate(10); act({ type: "discard", card: pick.card, to }); setPick(null); }
    else if (!hand.length) act({ type: "discard", card: -1, to });
  };

  const status = s.phase === "roundEnd" ? `${players.find((p) => p.id === s.lastRound?.winner)?.name ?? "?"} gewinnt Runde ${s.round} (+${s.lastRound?.points ?? 0})`
    : !myTurn ? `${cur?.name} ist am Zug`
    : pick?.from === "hand" ? "Auf einen Aufbaustapel legen – oder auf deine Ablage, dann ist der Zug vorbei."
    : pick ? "Auf einen passenden Aufbaustapel legen."
    : !hand.length ? "Keine Karten mehr – tipp auf eine Ablage, um den Zug zu beenden."
    : "Karte antippen: Vorrat, Ablage oder Hand.";

  return (
    <div className="flex min-h-0 flex-1 flex-col [--c:clamp(2.6rem,9.5vh,4.6rem)]">
      {/* Mitspieler: oberste Vorratskarte, Vorrat, Ablagen */}
      <PlayerRow>
        {others.map((p) => (
          <div key={p.id} data-cur={p.id === s.curId} aria-label={`${p.name}: Vorrat ${s.stockCounts[p.id] ?? 0}`}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm", p.id === s.curId && s.phase === "play" ? "turn" : "glass")}>
            <div className="grid gap-0.5">
              <span className="flex max-w-[6rem] items-center gap-1.5 truncate font-semibold">
                {online && <span className={cn("size-1.5 shrink-0 rounded-full", online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} />}{p.name}
              </span>
              <span className="text-xs tabular-nums opacity-75">Vorrat {s.stockCounts[p.id] ?? 0}</span>
            </div>
            <SbCardView key={s.stockCounts[p.id]} card={topOf(s.stocks[p.id] ?? [])} className="card-in w-8 ring-2 ring-ice/50" small />
            <span className="w-px self-stretch bg-current opacity-20" aria-hidden="true" />
            <div className="flex gap-0.5" aria-label="Ablagen">
              {(s.discards[p.id] ?? []).map((d, i) => <SbCardView key={i} card={topOf(d)} className="w-5 rounded-[18%]" small />)}
            </div>
          </div>
        ))}
      </PlayerRow>

      {/* Aufbau: vier gemeinsame Stapel von 1 bis 12 */}
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5" aria-label="Aufbaustapel">
        <Label>Aufbau für alle · 1 → 12</Label>
        <div className="flex items-start gap-2" data-testid="builds">
          {s.builds.map((b, i) => {
            const ok = picked !== undefined && fits(b, picked);
            const t = topOf(b);
            return (
              <div key={i} className="grid justify-items-center gap-1">
                <button type="button" disabled={!ok} onClick={() => playTo(i)} aria-label={`Aufbaustapel ${i + 1}, braucht ${needs(b)}`}
                  className={cn("relative w-[min(19vw,calc(var(--c)*1.4))] rounded-[12%] outline-none transition duration-200 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", ok && "target-glow -translate-y-1")}>
                  {b.length > 1 && <span className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-[12%] bg-paper/25" aria-hidden="true" />}
                  {t === undefined ? (
                    <div className="grid aspect-[5/7] place-items-center rounded-[12%] bg-navy-950/30 text-lg font-bold text-muted-foreground/70 ring-1 ring-inset ring-border ring-dashed">1</div>
                  ) : <SbCardView key={b.length} card={t} shown={t === JOKER ? b.length : undefined} className="card-land relative" />}
                </button>
                <span aria-hidden="true" className={cn("rounded-full px-2 py-px text-[0.7rem] font-semibold whitespace-nowrap tabular-nums", ok ? "bg-ice text-navy-950" : "bg-navy-950/60 text-muted-foreground")}>
                  <SmoothText>{`→ ${needs(b)}`}</SmoothText>
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">Nachziehstapel {s.pileCount}</p>
      </section>

      <div className="flex min-h-10 shrink-0 items-center justify-center gap-2 px-1 py-1 text-sm">
        <span data-testid="status" className={cn("text-center leading-snug", myTurn || s.phase === "roundEnd" ? "font-semibold" : "text-muted-foreground")}><SmoothText>{status}</SmoothText></span>
        <RulesSheet gameId={room.gameId} />
      </div>

      {/* Eigener Bereich: Vorrat (loswerden!) und vier Ablagen */}
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "roundEnd" ? (
          <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Nächste Runde</Button>
        ) : (
          <>
            <div className="glass mb-2 flex items-stretch justify-center gap-2.5 rounded-2xl px-2.5 py-2">
              <div className="grid content-start justify-items-center gap-1">
                <Label>Vorrat</Label>
                <button type="button" disabled={!myTurn || !stock.length} onClick={() => select({ from: "stock" })} aria-label={`Vorrat, oben ${stock.length ? topOf(stock) : "leer"}`}
                  className={cn("relative w-[calc(var(--c)*1.05)] rounded-[12%] outline-none transition duration-200 disabled:cursor-default", pick?.from === "stock" && "-translate-y-1.5 ring-[3px] ring-ice")}>
                  {/* angedeuteter Stapel darunter */}
                  <span className="absolute inset-0 translate-x-[4px] translate-y-[4px] rounded-[12%] bg-paper/20" aria-hidden="true" />
                  <span className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-[12%] bg-paper/40" aria-hidden="true" />
                  <SbCardView key={s.stockCounts[viewer ?? ""]} card={topOf(stock)} className="card-in relative ring-2 ring-ice/60" />
                  <span className="absolute -top-2 -right-2 rounded-full bg-ice px-1.5 text-[0.7rem] font-bold text-navy-950 tabular-nums" data-testid="stock">{viewer ? s.stockCounts[viewer] ?? 0 : 0}</span>
                </button>
              </div>
              <span className="w-px self-stretch bg-border" aria-hidden="true" />
              <div className="grid content-start justify-items-center gap-1">
                <Label>Ablagen</Label>
                <div className="flex gap-1.5">
                  {discards.map((d, i) => {
                    const target = myTurn && (pick?.from === "hand" || !hand.length);
                    const source = myTurn && !pick && d.length > 0;
                    const sel = pick?.from === "discard" && pick.i === i;
                    const under = d.slice(-4, -1);
                    return (
                      <div key={i} className="grid justify-items-center gap-0.5">
                        <span className="flex h-3.5 gap-0.5 text-[0.62rem] leading-none font-bold text-muted-foreground tabular-nums" aria-hidden="true">
                          {d.length > 4 && <span>…</span>}{under.map((c, k) => <span key={k}>{c === JOKER ? "SB" : c}</span>)}
                        </span>
                        <button type="button" disabled={!target && !source && !sel} data-testid={`discard-${i}`}
                          onClick={() => (target ? discardTo(i) : select({ from: "discard", i }))}
                          aria-label={target ? `Auf Ablage ${i + 1} ablegen und Zug beenden` : `Ablage ${i + 1}${d.length ? `, oben ${topOf(d)}` : " leer"}`}
                          className={cn("relative w-[calc(var(--c)*0.82)] rounded-[12%] outline-none transition duration-200 disabled:cursor-default", sel && "-translate-y-1.5 ring-[3px] ring-ice", target && "target-glow")}>
                          {d.length > 1 && <span className="absolute inset-0 -translate-y-[3px] rounded-[12%] bg-paper/30" aria-hidden="true" />}
                          <SbCardView key={d.length} card={topOf(d)} small className={cn("relative", d.length > 0 && "card-in")} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {covered ? <HandoffCover name={cur?.name ?? "?"} onReveal={reveal} /> : (
              <div className="flex justify-center gap-1.5" data-testid="hand">
                {hand.map((c, i) => {
                  const sel = pick?.from === "hand" && pick.card === c && hand.indexOf(c) === i;
                  return (
                    <button key={`${c}-${i}`} type="button" disabled={!myTurn} onClick={() => select({ from: "hand", card: c })}
                      className={cn("w-[min(17vw,calc(var(--c)*1.15))] rounded-[12%] outline-none transition duration-200 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", sel && "-translate-y-2 ring-[3px] ring-ice")}>
                      <SbCardView card={c} className="card-in" />
                    </button>
                  );
                })}
                {!hand.length && <p className="py-4 text-sm text-muted-foreground">Keine Handkarten</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Echte Karten: Sieger antippen, die anderen tragen ihren Rest-Vorrat ein */
function TableBoard(props: BoardProps<SbState, SbAction>) {
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
  const pts = 25 + 5 * players.reduce((t, p) => t + (p.id === w ? 0 : s.entries[p.id] ?? 0), 0);
  const scored = room.options.target === "500";

  return (
    <>
      {scored && <Scoreboard entries={entries} currentId={null} me={me} online={props.online} />}
      <div className="flex shrink-0 items-center justify-between px-1 pt-1 text-sm text-muted-foreground">
        <span>Runde {s.round}{scored ? " · bis 500" : ""}</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">Tippt an, wer den Vorrat los ist. Alle anderen tragen ein, wie viele Vorratskarten sie noch haben – der Sieger bekommt 25 + 5 je Karte.</p>
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {players.map((p) => {
          const editable = local || isHost || p.id === me;
          const isW = w === p.id;
          const val = isW ? "0" : draft[p.id] ?? (s.entries[p.id] === null || s.entries[p.id] === undefined ? "" : String(s.entries[p.id]));
          return (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}</span>
              <Input value={val} disabled={!editable || isW} inputMode="numeric" aria-label={`Vorrat ${p.name}`} className="h-10 w-16 text-center text-lg font-bold"
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                onBlur={() => commit(p.id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <button type="button" aria-pressed={isW} aria-label={`${p.name} hat gewonnen`}
                onClick={() => { setDraft((d) => { const n = { ...d }; delete n[p.id]; return n; }); act({ type: "setWinner", player: isW ? null : p.id }); }}
                className={cn("rounded-lg px-2 py-2 text-xs font-bold ring-1 ring-inset", isW ? "bg-ice text-navy-950 ring-transparent" : "text-muted-foreground ring-border")}>Sieg</button>
            </div>
          );
        })}
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isHost ? (
          <Button size="lg" disabled={!w || missing > 0} onClick={() => { vibrate(10); setDraft({}); act({ type: "finishRound" }); }}>
            {!w ? "Wer hat gewonnen?" : missing ? `Noch ${missing} ${missing === 1 ? "Eintrag" : "Einträge"}` : `+${pts} für ${players.find((p) => p.id === w)?.name}`}
          </Button>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">{missing || !w ? "Trag deinen Vorrat ein." : "Der Host schließt die Runde ab."}</p>}
      </div>
    </>
  );
}
