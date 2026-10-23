import { useEffect, useState } from "react";
import { Check, RotateCcw, Send } from "lucide-react";
import { deadlineOf, OWN_CAT, OWN_KAT, type Answer, type QAction, type QState } from "@shared/games/quiz/logic";
import { KAT_BY_ID } from "@shared/games/quiz/fragen";
import { WATCH_ID } from "@shared/platform/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, vibrate } from "@/lib/utils";
import { fmt, LETTERS, parseNumber, solution, TONES } from "./text";

type P = BoardProps<QState, QAction>;
const nameIn = (players: P["room"]["players"], id: string, me?: string | null) => (id === me ? "Du" : players.find((p) => p.id === id)?.name ?? "?");
export function Clock({ s, className }: { s: QState; className?: string }) {
  const end = deadlineOf(s);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (end === null) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return <span className={cn("rounded-full bg-[#2b2118] px-3 py-1 text-lg font-bold text-white tabular-nums", left <= 5 && "bg-[#c2492e]", className)} role="timer" data-testid="clock">{left}</span>;
}

/** Zeit um: alle melden etwas versetzt (der Server nimmt den ersten) */
function useTimeUp(s: QState, act: P["act"], on: boolean) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null || !on) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { act({ type: "timeUp" }); iv = setInterval(() => act({ type: "timeUp" }), 2500); }, Math.max(0, deadline - Date.now()) + 300 + Math.random() * 700);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, act, on]);
}

export function Board(props: P) {
  const { room, game: s, me, isHost, act, dispatch, online } = props;
  const players = room.players;
  const local = me === null;
  const watch = me === WATCH_ID;
  useTimeUp(s, act, !local && !watch);

  if (s.phase === "over") {
    const ranking = s.order.map((id) => ({ id, name: nameIn(players, id), score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
    const best = ranking[0]?.score ?? 0;
    return <ResultScreen winner={ranking.filter((r) => r.score === best).map((r) => r.name).join(" & ")} subtitle={`${s.total} Fragen`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
  }
  const sh = s.shown;
  if (!sh) return <p className="m-auto text-muted-foreground">Keine Frage gefunden.</p>;
  const entries = s.order.map((id) => ({ id, name: nameIn(players, id), score: s.scores[id] ?? 0 }));
  const kat = sh.cat === OWN_CAT ? OWN_KAT : KAT_BY_ID[sh.cat];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {!watch && <Scoreboard entries={entries} currentId={null} me={me} online={online} />}
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
        <span>{kat ? `${kat.emoji} ${kat.name}` : ""}</span>
        <Clock s={s} />
      </div>
      <h2 className="shrink-0 px-1 text-xl leading-snug font-bold" data-testid="question">{sh.text}{sh.kind === "zahl" && sh.unit ? <span className="ml-1 text-base font-normal text-muted-foreground">(in {sh.unit})</span> : null}</h2>
      {s.phase === "ask" ? (local ? <LocalAsk {...props} /> : watch ? <Waiting s={s} players={players} /> : <AskView {...props} />) : <RevealView {...props} />}
    </div>
  );
}

function Waiting({ s, players }: { s: QState; players: P["room"]["players"] }) {
  return <p className="glass mt-auto rounded-xl py-3 text-center text-muted-foreground" data-testid="waiting">{s.answered.length} von {s.order.length} haben geantwortet{s.answered.length ? ` (${s.answered.map((id) => nameIn(players, id)).join(", ")})` : ""}</p>;
}

/** Am eigenen Handy antworten */
function AskView({ room, game: s, me, isHost, act }: P) {
  const sh = s.shown!;
  const mine = me ? s.answers[me] : undefined;
  const [text, setText] = useState("");
  const [seq, setSeq] = useState<number[]>([]);
  useEffect(() => { setText(""); setSeq([]); }, [sh.id]);
  const send = (value: Answer) => { vibrate(10); act({ type: "answer", value }); };

  if (mine !== undefined) {
    return (
      <div className="mt-auto grid gap-2">
        <p className="rounded-xl bg-ok/20 py-3 text-center font-semibold" data-testid="answered"><Check className="mr-1 inline size-5" />Antwort ist drin.</p>
        <Waiting s={s} players={room.players} />
        {isHost && <Button variant="secondary" onClick={() => act({ type: "reveal" })}>Jetzt auflösen</Button>}
      </div>
    );
  }
  if (sh.kind === "wahl") {
    return (
      <div className="mt-auto grid grid-cols-1 gap-2" role="group" aria-label="Antworten">
        {sh.options.map((o, i) => (
          <button key={o} type="button" onClick={() => send(i)} className="flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2 text-left text-lg font-semibold text-white shadow outline-none active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring" style={{ background: TONES[i] }}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/25 font-bold">{LETTERS[i]}</span>{o}
          </button>
        ))}
      </div>
    );
  }
  if (sh.kind === "zahl") {
    const n = parseNumber(text);
    return (
      <form className="mt-auto grid gap-2" onSubmit={(e) => { e.preventDefault(); if (n !== null) send(n); }}>
        <div className="flex items-center gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value.slice(0, 16))} inputMode="decimal" placeholder="Deine Schätzung" aria-label="Deine Schätzung" autoComplete="off" className="h-14 text-2xl font-bold" />
          {sh.unit && <span className="shrink-0 text-lg font-semibold text-muted-foreground">{sh.unit}</span>}
        </div>
        <Button type="submit" size="lg" disabled={n === null}><Send />Schätzen</Button>
      </form>
    );
  }
  // Ordnen: der Reihe nach antippen
  return (
    <div className="mt-auto grid gap-2">
      <p className="text-center text-sm text-muted-foreground">Tippe die Begriffe in der richtigen Reihenfolge an.</p>
      <div className="grid gap-1.5" role="group" aria-label="Begriffe">
        {sh.options.map((o, i) => {
          const pos = seq.indexOf(i);
          return (
            <button key={o} type="button" disabled={pos >= 0} onClick={() => { vibrate(6); const next = [...seq, i]; setSeq(next); if (next.length === 4) send(next); }}
              className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold ring-1 ring-inset ring-border outline-none", pos >= 0 ? "bg-ice/30" : "bg-secondary")}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-950/10 font-bold tabular-nums">{pos >= 0 ? pos + 1 : ""}</span>{o}
            </button>
          );
        })}
      </div>
      <Button variant="ghost" disabled={!seq.length} onClick={() => setSeq([])}><RotateCcw />Neu ordnen</Button>
    </div>
  );
}

/** Ein Handy für alle: Frage zeigen, alle rufen – dann auflösen */
function LocalAsk({ game: s, act }: P) {
  const sh = s.shown!;
  return (
    <div className="mt-auto grid gap-2">
      {sh.kind !== "zahl" && (
        <div className="grid gap-1.5">
          {sh.options.map((o, i) => (
            <div key={o} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 font-semibold text-white" style={{ background: sh.kind === "wahl" ? TONES[i] : "#475569" }}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/25 font-bold">{LETTERS[i]}</span>{o}
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-sm text-muted-foreground">{sh.kind === "zahl" ? "Jeder sagt seine Schätzung laut." : sh.kind === "folge" ? "Jeder sagt seine Reihenfolge laut." : "Jeder ruft seine Antwort."}</p>
      <Button size="lg" onClick={() => act({ type: "reveal" })}>Auflösen</Button>
    </div>
  );
}

/** Auflösung: Lösung, eigene Punkte, alle Antworten */
function RevealView({ room, game: s, me, act }: P) {
  const players = room.players;
  const sh = s.shown!;
  const last = s.last;
  const local = me === null;
  const watch = me === WATCH_ID;
  const [picked, setPicked] = useState<string[]>([]);
  const ans = last?.answers ?? {};
  const desc = (id: string) => {
    const a = ans[id];
    if (a === undefined) return "–";
    if (sh.kind === "zahl") return fmt(a as number);
    if (sh.kind === "folge") return (a as number[]).map((i) => sh.options[i]).join(" → ");
    return LETTERS[a as number];
  };
  const rows = s.order.map((id) => ({ id, p: last?.points[id] ?? 0 }))
    .sort((a, b) => (sh.kind === "zahl" && typeof ans[a.id] === "number" && typeof ans[b.id] === "number"
      ? Math.abs((ans[a.id] as number) - (last!.key as number)) - Math.abs((ans[b.id] as number) - (last!.key as number)) : b.p - a.p));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="reveal">
      <p className="shrink-0 rounded-2xl bg-ok/20 px-4 py-3 text-center text-lg font-bold" data-testid="solution">{solution(s)}</p>
      {local ? (
        <>
          <p className="text-center text-sm font-semibold">{sh.kind === "zahl" ? "Wer lag am nächsten?" : "Wer hatte es richtig?"}</p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Richtig lagen">
            {s.order.map((id) => (
              <Button key={id} variant={picked.includes(id) ? "default" : "secondary"} aria-pressed={picked.includes(id)} onClick={() => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))}>{nameIn(players, id)}</Button>
            ))}
          </div>
          <Button size="lg" className="mt-auto" onClick={() => act({ type: "award", ids: picked })}>{picked.length ? `+100 für ${picked.length} – weiter` : "Keiner – weiter"}</Button>
        </>
      ) : (
        <>
          <ul className="no-scrollbar grid min-h-0 content-start gap-1 overflow-hidden" data-testid="answers">
            {rows.slice(0, 8).map(({ id, p }) => (
              <li key={id} className={cn("flex items-center justify-between gap-2 rounded-xl px-3 py-1.5", id === me ? "bg-primary/15" : "glass")}>
                <span className="min-w-0 truncate font-semibold">{nameIn(players, id, me)}</span>
                <span className="min-w-0 truncate text-sm text-muted-foreground">{desc(id)}</span>
                <b className={cn("shrink-0 tabular-nums", p ? "text-ok" : "text-muted-foreground")}>+{p}</b>
              </li>
            ))}
          </ul>
          {!watch && <Button size="lg" className="mt-auto" onClick={() => act({ type: "next" })}>{s.idx + 1 >= s.total ? "Zum Ergebnis" : "Nächste Frage"}</Button>}
        </>
      )}
    </div>
  );
}
