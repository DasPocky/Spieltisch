import { useEffect, useState } from "react";
import { Check, Eraser, Send, Undo2 } from "lucide-react";
import { COLORS, deadlineOf, WIDTHS, type ZAction, type ZState } from "@shared/games/zeichnen/logic";
import { wordText } from "@shared/games/stirnraten/cards";
import { WATCH_ID } from "@shared/platform/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, vibrate } from "@/lib/utils";
import { Paper } from "./Canvas";

type P = BoardProps<ZState, ZAction>;
const nameIn = (players: P["room"]["players"], id: string | null, me?: string | null) => (id && id === me ? "Du" : players.find((p) => p.id === id)?.name ?? "?");

/** Uhr bis zum Ende des Zeichnens */
function Clock({ s }: { s: ZState }) {
  const end = deadlineOf(s);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (end === null) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return <span className={cn("rounded-full bg-[#2b2118] px-3 py-1 text-lg font-bold text-white tabular-nums", left <= 10 && "bg-[#c2492e]")} role="timer" data-testid="clock">{left}</span>;
}

/** Zeit um: wer zeichnet, meldet sofort, die anderen etwas später (falls das Handy weg ist) */
function useTimeUp(s: ZState, act: P["act"], delay: number) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { act({ type: "timeUp" }); iv = setInterval(() => act({ type: "timeUp" }), 2500); }, Math.max(0, deadline - Date.now()) + delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, delay, act]);
}

/** Begriff (wer ihn kennt) oder Lücken mit Buchstabenzahl */
function Word({ s }: { s: ZState }) {
  const w = s.word ? wordText(s.word) : null;
  return w
    ? <span className="text-xl font-bold" data-testid="word">{w}</span>
    : <span className="font-mono text-xl font-bold tracking-[0.25em]" aria-label={`${s.mask.replace(/[^_]/g, "").length} Buchstaben`} data-testid="mask">{s.mask}</span>;
}

export function Board(props: P) {
  const { room, game: s, me, isHost, act, dispatch, online } = props;
  const players = room.players;
  const local = me === null;
  const watch = me === WATCH_ID;
  const drawing = local || me === s.drawer;
  // Ein Handy für alle: die drei Begriffe sieht nur, wer zeichnet
  const { covered, reveal } = useHandoff(local && s.phase === "pick", s.drawer, players.length);
  useTimeUp(s, act, drawing ? 0 : 3000);

  if (s.phase === "over") {
    const ranking = s.order.map((id) => ({ id, name: nameIn(players, id), score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
    const best = ranking[0]?.score ?? 0;
    return <ResultScreen winner={ranking.filter((r) => r.score === best).map((r) => r.name).join(" & ")} subtitle={`${s.turns} Bilder gemalt`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
  }

  const entries = s.order.map((id) => ({ id, name: nameIn(players, id), score: s.scores[id] ?? 0 }));
  const drawer = nameIn(players, s.drawer, me);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {!watch && <Scoreboard entries={entries} currentId={s.drawer} me={me} online={online} />}

      {s.phase === "pick" && (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3" data-testid="pick">
          {drawing && !watch ? (covered ? <HandoffCover name={drawer} onReveal={reveal} /> : (
            <>
              <p className="text-center text-lg font-semibold">{local ? `${drawer}, was` : "Was"} zeichnest du?</p>
              <div className="grid gap-2" role="group" aria-label="Begriff wählen">
                {s.choices.map((w, i) => (
                  <Button key={w} size="lg" variant="secondary" className="h-14 text-lg" onClick={() => { vibrate(10); act({ type: "pick", i }); }}>{wordText(w)}</Button>
                ))}
              </div>
            </>
          )) : <p className="glass rounded-2xl px-4 py-6 text-center text-lg"><b>{drawer}</b> sucht sich einen Begriff aus …</p>}
        </div>
      )}

      {s.phase === "draw" && (drawing && !watch ? <DrawerView {...props} /> : <GuesserView {...props} />)}

      {s.phase === "reveal" && s.last && (
        <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="reveal">
          <p className="text-center text-lg">{nameIn(players, s.last.drawer, me)} {s.last.drawer === me ? "hast" : "hat"} <b className="text-xl">„{wordText(s.last.word)}“</b> gezeichnet</p>
          <Paper strokes={s.strokes} className="min-h-0 flex-1" label={`Zeichnung: ${wordText(s.last.word)}`} />
          <p className="text-center text-sm" data-testid="solved">{s.last.solved.length ? `Erraten von ${s.last.solved.map((id) => nameIn(players, id, me)).join(", ")}` : "Keiner hat's erraten."}</p>
          {!watch && <Button size="lg" onClick={() => act({ type: "next" })}>{s.turn + 1 >= s.turns ? "Zum Ergebnis" : "Nächstes Bild"}</Button>}
        </div>
      )}
    </div>
  );
}

/** Wer zeichnet: Blatt, Farben, Stärke, Rückgängig, Löschen – und beim Rufen: wer hatte es? */
function DrawerView({ room, game: s, me, act }: P) {
  const players = room.players;
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [who, setWho] = useState(false);
  const others = s.order.filter((id) => id !== s.drawer);
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <Word s={s} />
        <Clock s={s} />
      </div>
      <Paper strokes={s.strokes} onStroke={(k) => act({ type: "stroke", ...k })} color={color} width={width} className="min-h-0 flex-1" label="Dein Blatt" />
      <div className="flex shrink-0 items-center justify-center gap-1.5" role="group" aria-label="Farbe">
        {COLORS.map((c, i) => (
          <button key={c} type="button" aria-label={`Farbe ${i + 1}`} aria-pressed={color === i} onClick={() => setColor(i)}
            className={cn("size-8 rounded-full ring-1 ring-black/20 outline-none transition", color === i && "ring-[3px] ring-ice scale-110")} style={{ background: c }} />
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2">
        <div className="flex shrink-0 gap-1" role="group" aria-label="Stärke">
          {WIDTHS.map((w, i) => (
            <button key={w} type="button" aria-label={`Stärke ${i + 1}`} aria-pressed={width === i} onClick={() => setWidth(i)}
              className={cn("grid size-9 place-items-center rounded-lg bg-secondary ring-1 ring-inset ring-border outline-none", width === i && "ring-[3px] ring-ice")}>
              <span className="rounded-full bg-foreground" style={{ width: Math.max(3, w * 0.9), height: Math.max(3, w * 0.9) }} />
            </button>
          ))}
        </div>
        <Button variant="secondary" size="icon" aria-label="Rückgängig" disabled={!s.strokes.length} onClick={() => act({ type: "undo" })}><Undo2 /></Button>
        <Button variant="secondary" size="icon" aria-label="Alles löschen" disabled={!s.strokes.length} onClick={() => act({ type: "clear" })}><Eraser /></Button>
        {s.mode === "rufen"
          ? <Button className="flex-1 whitespace-nowrap" onClick={() => setWho(true)} data-testid="who">Wer hat's?</Button>
          : <Button variant="secondary" className="flex-1 whitespace-nowrap" onClick={() => act({ type: "done" })}>Aufgeben</Button>}
      </div>
      {s.mode === "tippen" && <p className="shrink-0 text-center text-sm text-muted-foreground" data-testid="solved">{s.solved.length ? `Erraten: ${s.solved.map((id) => nameIn(players, id, me)).join(", ")}` : "Noch hat es keiner."}</p>}
      {who && (
        <div className="glass grid shrink-0 gap-2 rounded-2xl p-2.5" role="group" aria-label="Wer hat es erraten?">
          <p className="text-center text-sm font-semibold">Wer hat es zuerst gerufen?</p>
          <div className="grid grid-cols-2 gap-1.5">
            {others.map((id) => <Button key={id} variant="secondary" onClick={() => act({ type: "award", to: id })}>{nameIn(players, id)}</Button>)}
            <Button variant="ghost" onClick={() => act({ type: "award", to: null })}>Keiner</Button>
            <Button variant="ghost" onClick={() => setWho(false)}>Weiter malen</Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Wer rät: Blatt live, Lücken, Uhr – beim Tippen ein Feld und die letzten Tipps */
function GuesserView({ room, game: s, me, act }: P) {
  const players = room.players;
  const watch = me === WATCH_ID;
  const [text, setText] = useState("");
  const mine = !!me && s.solved.includes(me);
  const send = () => { const t = text.trim(); if (!t) return; vibrate(8); act({ type: "guess", text: t }); setText(""); };
  const recent = s.guesses.slice(-4).reverse();
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="text-sm text-muted-foreground"><b className="text-foreground">{nameIn(players, s.drawer)}</b> zeichnet</span>
        <Word s={s} />
        <Clock s={s} />
      </div>
      <Paper strokes={s.strokes} className="min-h-0 flex-1" label={`Zeichnung von ${nameIn(players, s.drawer)}`} />
      {watch ? null : s.mode === "rufen" ? (
        <p className="glass shrink-0 rounded-xl py-3 text-center font-semibold" data-testid="shout">Ruft eure Tipps! {nameIn(players, s.drawer)} tippt an, wer es hatte.</p>
      ) : mine ? (
        <p className="shrink-0 rounded-xl bg-ok/20 py-3 text-center font-semibold" data-testid="got-it"><Check className="mr-1 inline size-5" />Richtig! Warte auf die anderen.</p>
      ) : (
        <>
          <ul className="grid shrink-0 gap-0.5 text-sm" aria-label="Tipps" data-testid="guesses">
            {recent.map((g, i) => (
              <li key={`${i}-${g.by}-${g.text}`} className={cn("truncate", g.ok && "font-semibold text-ok")}>
                {nameIn(players, g.by, me)}: {g.ok ? (g.text || "hat es! ✓") : g.text}
              </li>
            ))}
          </ul>
          <form className="flex shrink-0 gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={40} placeholder="Was ist es?" aria-label="Dein Tipp" autoComplete="off" className="h-12 text-lg" />
            <Button type="submit" size="lg" aria-label="Tipp abschicken" disabled={!text.trim()}><Send /></Button>
          </form>
        </>
      )}
    </>
  );
}
