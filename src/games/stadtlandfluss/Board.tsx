import { useEffect, useRef, useState } from "react";
import { ThumbsDown } from "lucide-react";
import {
  active, deadlineOf, downFor, liveMark, MAX_ANSWER, scoreCategory, votersFor, type Mark, type SlfAction, type SlfState,
} from "@shared/games/stadtlandfluss/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { speak } from "@/platform/speech";
import { cn, vibrate } from "@/lib/utils";
import { narration } from "./narration";

type P = BoardProps<SlfState, SlfAction>;
const nameIn = (s: SlfState, players: P["room"]["players"], id: string | null) => (id && (s.names[id] ?? players.find((p) => p.id === id)?.name)) || "?";

/** Vorlesen wie ein Spielleiter: lokal das Gerät, online nur das Handy des Hosts (sonst hallt es) */
function useNarration({ game: s, me, isHost, room }: P) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<SlfState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(s, room.players, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [active]);
  return now;
}

/** Uhr: bis zum Ende der Runde – nach dem Stopp rot */
function Clock({ s }: { s: SlfState }) {
  const end = deadlineOf(s);
  const now = useNow(end !== null);
  if (end === null) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return <span className={cn("shrink-0 rounded-full bg-[#2b2118] px-3 py-1 text-lg font-bold text-white tabular-nums", (left <= 10 || s.stopAt !== null) && "bg-[#c2492e]")} role="timer" data-testid="clock">{left}</span>;
}

/** Zeit um: das Handy meldet es nach kurzer Zeit (falls ein Handy weg ist, geht es trotzdem weiter) */
function useTimeUp(s: SlfState, act: P["act"], delay: number) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { act({ type: "timeUp" }); iv = setInterval(() => act({ type: "timeUp" }), 2500); }, Math.max(0, deadline - Date.now()) + delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, delay, act]);
}

/** Der gezogene Buchstabe als Papierkärtchen */
function Letter({ s, big }: { s: SlfState; big?: boolean }) {
  return (
    <span className={cn("grid shrink-0 -rotate-3 place-items-center rounded-xl bg-[#fffdf8] font-black text-[#c2492e] shadow-md ring-1 ring-[#2b2118]/25",
      big ? "size-16 text-5xl" : "size-11 text-3xl")} data-testid="slf-letter" aria-label={`Buchstabe ${s.letter}`}>{s.letter}</span>
  );
}

export function Board(props: P) {
  const { game: s, room, isHost, me, dispatch } = props;
  useNarration(props);
  useTimeUp(s, props.act, 2000);
  if (s.phase === "over") {
    const ranking = active(s).map((id) => ({ id, name: nameIn(s, room.players, id), score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
    const best = ranking[0]?.score ?? 0;
    return <ResultScreen winner={ranking.filter((r) => r.score === best).map((r) => r.name).join(" & ")} subtitle={`${s.history.length} ${s.history.length === 1 ? "Runde" : "Runden"}: ${s.history.map((h) => h.letter).join(" · ")}`} ranking={ranking} isHost={isHost || me === null} dispatch={dispatch} scoreLabel="Punkte" />;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {s.phase === "write" ? <Write {...props} /> : s.phase === "review" ? <Review {...props} /> : <Score {...props} />}
    </div>
  );
}

function Head({ s, title, sub }: { s: SlfState; title: string; sub: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-1">
      <Letter s={s} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg leading-tight font-bold" data-testid="slf-title">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{sub}</p>
      </div>
      <Clock s={s} />
    </div>
  );
}

/** Schreiben – oder warten, bis alle fertig sind */
function Write(props: P) {
  const { room, game: s, me } = props;
  const local = me === null;
  const still = active(s).filter((id) => !s.done.includes(id));
  const cur = local ? still[0] ?? null : me;
  const [shownFor, setShownFor] = useState<string | null>(null);
  const status = `${s.done.length}/${active(s).length} fertig`;
  const canPlay = !!cur && s.order.includes(cur) && !s.left.includes(cur) && !s.done.includes(cur);
  const stopLine = s.stopAt !== null ? `Stopp! ${s.stopBy ? `${nameIn(s, room.players, s.stopBy)} ist fertig` : "Der Host beendet die Runde"}` : null;
  if (!canPlay) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center" data-testid="slf-wait">
        <Letter s={s} big />
        <p className="text-xl font-semibold">{s.order.includes(me ?? "") && !s.left.includes(me ?? "") ? "Fertig! Die anderen schreiben noch." : "Alle schreiben …"}</p>
        {stopLine && <p className="font-semibold text-[#c2492e]">{stopLine}</p>}
        <p className="text-muted-foreground" data-testid="slf-status">{status} · noch dran: {still.map((id) => nameIn(s, room.players, id)).join(", ") || "–"}</p>
        <Clock s={s} />
      </div>
    );
  }
  if (local && shownFor !== cur) {
    const name = nameIn(s, room.players, cur);
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="glass grid gap-3 rounded-2xl p-4 text-center" data-testid="handoff">
          <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{name}</b>.</p>
          <Button size="lg" onClick={() => setShownFor(cur)}>Ich bin {name} – los</Button>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
    );
  }
  return <Form key={`${cur}-${s.round}`} {...props} id={cur!} status={stopLine ?? `Runde ${s.round + 1}/${s.rounds} · ${status}`} />;
}

/** Die Felder: Entwurf geht laufend an den Server (zählt bei Zeitablauf), kurz vor Ablauf gibt das Handy selbst ab */
function Form({ game: s, me, act, id, status }: P & { id: string; status: string }) {
  const local = me === null;
  const who = local ? { player: id } : {};
  const [vals, setVals] = useState<string[]>(() => s.cats.map((_, i) => s.answers[id]?.[i] ?? ""));
  const latest = useRef(vals);
  latest.current = vals;
  const sent = useRef(0);
  // Entwurf nach kurzer Pause speichern
  useEffect(() => {
    if (local) return;
    const t = setTimeout(() => act({ type: "fill", answers: latest.current }), 700);
    return () => clearTimeout(t);
  }, [vals, local, act]);
  const finish = (stop: boolean) => {
    // doppelt getippt? (kam die Abgabe nicht an, darf man nach kurzer Zeit nochmal)
    if (Date.now() - sent.current < 2000) return;
    sent.current = Date.now();
    vibrate(stop ? 30 : 10);
    act({ type: "done", answers: latest.current, stop, ...who });
  };
  const deadline = deadlineOf(s);
  const fin = useRef(finish);
  fin.current = finish;
  useEffect(() => {
    if (deadline === null) return;
    const t = setTimeout(() => fin.current(false), Math.max(0, deadline - Date.now() - 300));
    return () => clearTimeout(t);
  }, [deadline]);
  const full = vals.every((v) => v.trim());
  const many = s.cats.length > 6;
  const canStop = full && s.stopAt === null && !local;
  return (
    <form className="flex min-h-0 flex-1 flex-col gap-2" onSubmit={(e) => { e.preventDefault(); finish(canStop); }}>
      <Head s={s} title={local ? `${s.names[id]} schreibt` : s.stopAt !== null ? "Schnell, fertig schreiben!" : `Alles mit ${s.letter}!`} sub={status} />
      <div className={cn("grid min-h-0 flex-1 content-start gap-x-2", many ? "grid-cols-2 gap-y-1" : "gap-y-2")}>
        {s.cats.map((c, i) => (
          <label key={c} className={cn("min-w-0", many ? "grid gap-0.5" : "flex items-center gap-2")}>
            <span className={cn("truncate font-semibold", many ? "px-1 text-xs text-muted-foreground" : "w-24 shrink-0 text-sm")}>{c}</span>
            <input value={vals[i]} maxLength={MAX_ANSWER} autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label={c} data-testid={`slf-in-${i}`}
              placeholder={`${s.letter} …`}
              onChange={(e) => { const v = e.target.value; setVals((xs) => xs.map((x, j) => (j === i ? v : x))); }}
              className={cn("w-full min-w-0 flex-1 rounded-lg bg-background px-3 text-base ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring", many ? "h-10" : "h-11")} />
          </label>
        ))}
      </div>
      <Button type="submit" size="lg" className={cn("shrink-0", canStop && "bg-[#c2492e] text-white hover:bg-[#a83c24]")} data-testid="slf-done">
        {canStop ? "Stopp!" : full || s.stopAt !== null || local ? "Fertig" : "Abgeben (noch nicht alles)"}
      </Button>
    </form>
  );
}

const MARK_TEXT: Record<Mark | "tie", string> = { ok: "", no: "abgelehnt", letter: "falscher Buchstabe", empty: "–", tie: "Gleichstand" };

/** Auswertung einer Kategorie: alle Antworten, Daumen runter, Punkte als Vorschau */
function Review({ room, game: s, me, isHost, act }: P) {
  const local = me === null;
  const ids = active(s);
  const marks = Object.fromEntries(ids.map((id) => [id, liveMark(s, id)]));
  const answers = Object.fromEntries(ids.map((id) => [id, s.answers[id]?.[s.cat] ?? ""]));
  const pts = scoreCategory(answers, Object.fromEntries(ids.map((id) => [id, marks[id] === "tie" ? "ok" : marks[id]])) as Record<string, Mark>);
  const steer = isHost || local;
  const last = s.cat + 1 >= s.cats.length;
  const tight = ids.length > 7;
  return (
    <>
      <Head s={s} title={s.cats[s.cat]} sub={`Kategorie ${s.cat + 1}/${s.cats.length} · ${local ? "Tippen lehnt ab" : "Daumen runter lehnt ab"}`} />
      <ul className={cn("grid min-h-0 flex-1 content-start", tight ? "gap-1" : "gap-1.5")} data-testid="slf-review">
        {ids.map((id) => {
          const a = answers[id];
          const m = marks[id];
          const mine = id === me;
          const down = local ? 0 : downFor(s, id);
          const voted = !local && !!me && !!s.votes[me]?.includes(id);
          const canVote = !!a && m !== "letter" && (local || (!mine && ids.includes(me ?? "")));
          return (
            <li key={id} className={cn("glass flex items-center gap-2 rounded-xl px-3", tight ? "py-1" : "py-2")} data-testid="slf-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{mine ? "Du" : nameIn(s, room.players, id)}{MARK_TEXT[m] && a ? ` · ${MARK_TEXT[m]}` : ""}</p>
                <p className={cn("truncate font-semibold", tight ? "text-base" : "text-lg", (m === "no" || m === "letter") && "text-muted-foreground line-through")} data-testid="slf-answer">{a || "–"}</p>
              </div>
              {m === "tie" && isHost && !local && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => act({ type: "decide", target: id, reject: false })}>gilt</Button>
                  <Button size="sm" variant="secondary" onClick={() => act({ type: "decide", target: id, reject: true })}>raus</Button>
                </div>
              )}
              <b className={cn("w-9 shrink-0 text-right tabular-nums", pts[id] ? "text-primary" : "text-muted-foreground")} data-testid="slf-pts">+{pts[id] ?? 0}</b>
              {canVote && (
                <button type="button" aria-pressed={local ? s.decided[id] === true : voted} aria-label={`Antwort von ${nameIn(s, room.players, id)} ablehnen`} data-testid="slf-vote"
                  onClick={() => { vibrate(8); act({ type: "vote", target: id }); }}
                  className={cn("flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                    (local ? s.decided[id] : voted) ? "bg-[#c2492e] text-white ring-[#c2492e]" : "bg-secondary")}>
                  <ThumbsDown className="size-4" />{!local && <span className="text-sm tabular-nums">{down}/{votersFor(s, id).length}</span>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {steer ? (
        <Button size="lg" className="shrink-0" onClick={() => { vibrate(8); act({ type: "next" }); }} data-testid="slf-next">{last ? "Runde werten" : `Weiter: ${s.cats[s.cat + 1]}`}</Button>
      ) : (
        <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Der Host geht weiter, wenn alle geschaut haben.</p>
      )}
    </>
  );
}

/** Rundenwertung: Punkte dieser Runde und gesamt */
function Score({ room, game: s, me, isHost, act }: P) {
  const local = me === null;
  const last = s.history[s.history.length - 1]?.points ?? {};
  const ids = active(s).sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0));
  const end = s.round + 1 >= s.rounds;
  return (
    <>
      <Head s={s} title={`Runde ${s.round + 1} von ${s.rounds}`} sub="Punkte dieser Runde und gesamt" />
      <ul className={cn("grid min-h-0 flex-1 content-start", ids.length > 7 ? "gap-1" : "gap-1.5")} data-testid="slf-score">
        {ids.map((id) => (
          <li key={id} className={cn("glass flex items-center gap-2 rounded-xl px-3", ids.length > 7 ? "py-1.5" : "py-2.5")}>
            <span className="min-w-0 flex-1 truncate font-semibold">{id === me ? "Du" : nameIn(s, room.players, id)}</span>
            <span className="text-sm text-primary tabular-nums">+{last[id] ?? 0}</span>
            <b className="w-12 text-right text-lg tabular-nums">{s.scores[id] ?? 0}</b>
          </li>
        ))}
      </ul>
      {isHost || local ? (
        <Button size="lg" className="shrink-0" onClick={() => { vibrate(8); act({ type: "next" }); }} data-testid="slf-next">{end ? "Zum Ergebnis" : "Nächster Buchstabe"}</Button>
      ) : (
        <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Der Host zieht gleich den nächsten Buchstaben.</p>
      )}
    </>
  );
}
