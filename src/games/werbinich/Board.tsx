import { useEffect, useRef, useState } from "react";
import { Check, Eye, HelpCircle, Trash2, X } from "lucide-react";
import {
  ANSWER_TEXT, MAX_FIGURE, MAX_TEXT, active, counts, deadlineOf, voters, type Answer, type Note, type WbAction, type WbState,
} from "@shared/games/werbinich/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { speak } from "@/platform/speech";
import { cn, vibrate } from "@/lib/utils";
import { narration } from "./narration";

type P = BoardProps<WbState, WbAction>;
const nameIn = (s: WbState, players: P["room"]["players"], id: string | null) => (id && (s.names[id] ?? players.find((p) => p.id === id)?.name)) || "?";
const INPUT = "h-11 w-full min-w-0 rounded-lg bg-background px-3 text-base ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring";
const TONE: Record<Answer, string> = { ja: "bg-[#2f8f4e] text-white", nein: "bg-[#c2492e] text-white", egal: "bg-[#8a8178] text-white" };

/** Vorlesen wie ein Spielleiter: lokal das Gerät, online nur das Handy des Hosts (sonst hallt es) */
function useNarration({ game: s, me, isHost, room }: P) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<WbState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(s, room.players, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!on) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [on]);
  return now;
}

/** Zeit um: jedes Handy meldet es kurz danach (fehlt eins, geht es trotzdem weiter) */
function useTimeUp(s: WbState, act: P["act"]) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { act({ type: "timeUp" }); iv = setInterval(() => act({ type: "timeUp" }), 2500); }, Math.max(0, deadline - Date.now()) + 800);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, act]);
}

function Clock({ s }: { s: WbState }) {
  const end = deadlineOf(s);
  const now = useNow(end !== null);
  if (end === null) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return <span className={cn("shrink-0 rounded-full bg-[#2b2118] px-3 py-1 text-base font-bold text-white tabular-nums", left <= 10 && "bg-[#c2492e]")} role="timer" data-testid="clock">{left}</span>;
}

export function Board(props: P) {
  const { game: s } = props;
  useNarration(props);
  useTimeUp(s, props.act);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {s.phase === "over" ? <Over {...props} /> : s.phase === "write" ? <Write {...props} /> : props.me === null ? <LocalPlay {...props} /> : <Play {...props} />}
    </div>
  );
}

/* ---------- Gegenseitig vergeben ---------- */

function Write(props: P) {
  const { game: s, room, me, act } = props;
  const local = me === null;
  const missing = active(s).filter((id) => !s.drafts[id] && s.writeFor[id] && !s.left.includes(s.writeFor[id]));
  const cur = local ? missing[0] ?? null : me;
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const status = `${active(s).length - missing.length}/${active(s).length} fertig · noch: ${missing.map((id) => nameIn(s, room.players, id)).join(", ") || "–"}`;
  const writing = !!cur && missing.includes(cur);
  if (!writing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center" data-testid="wbi-wait">
        <p className="text-xl font-semibold">{s.order.includes(me ?? "") ? "Fertig! Die anderen schreiben noch." : "Alle schreiben Figuren …"}</p>
        <p className="text-muted-foreground" data-testid="wbi-status">{status}</p>
      </div>
    );
  }
  const target = nameIn(s, room.players, s.writeFor[cur!]);
  if (local && shownFor !== cur) {
    const name = nameIn(s, room.players, cur);
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="glass grid gap-3 rounded-2xl p-4 text-center" data-testid="handoff">
          <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{name}</b> – {target} schaut weg.</p>
          <Button size="lg" onClick={() => { setText(""); setShownFor(cur); }}>Ich bin {name} – los</Button>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
    );
  }
  const send = () => { if (!text.trim()) return; vibrate(10); act({ type: "write", text, ...(local ? { player: cur! } : {}) }); setText(""); };
  return (
    <form className="flex min-h-0 flex-1 flex-col justify-center gap-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="glass grid gap-3 rounded-2xl p-4">
        <p className="text-lg font-bold" data-testid="wbi-title">Wer soll {target} sein?</p>
        <p className="text-sm text-muted-foreground">Eine Person, Figur, ein Tier oder Beruf, den alle kennen. {target} sieht sie nicht.</p>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_FIGURE} placeholder="z. B. Kleopatra" autoComplete="off" spellCheck={false}
          className={INPUT} data-testid="wbi-write" aria-label={`Figur für ${target}`} />
        <Button type="submit" size="lg" disabled={!text.trim()} data-testid="wbi-write-send">Abgeben</Button>
      </div>
      <p className="text-center text-sm text-muted-foreground">{status}</p>
    </form>
  );
}

/* ---------- Online: eigenes Handy ---------- */

function Play(props: P) {
  const { game: s, me } = props;
  const mine = me === s.asker;
  const [tab, setTab] = useState<"figuren" | "notizen">(mine ? "notizen" : "figuren");
  useEffect(() => setTab(mine ? "notizen" : "figuren"), [mine]);
  const player = s.order.includes(me ?? "") && !s.left.includes(me ?? "");
  return (
    <>
      <Status {...props} />
      {player && (
        <div className="flex shrink-0 gap-1 rounded-xl bg-secondary p-1 ring-1 ring-inset ring-border" role="tablist">
          {(["figuren", "notizen"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`wbi-tab-${t}`}
              className={cn("h-9 flex-1 rounded-lg text-sm font-semibold", tab === t ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {t === "figuren" ? "Figuren" : `Notizblock (${s.notes[me!]?.length ?? 0})`}
            </button>
          ))}
        </div>
      )}
      {tab === "notizen" && player ? <Notes {...props} owner={me!} /> : <Figures {...props} />}
      <Actions {...props} />
    </>
  );
}

/** Kopf: wer dran ist, was gerade passiert, letzte Antwort */
function Status({ game: s, room, me }: P) {
  const who = s.asker === me ? "Du bist dran" : `${nameIn(s, room.players, s.asker)} ist dran`;
  const l = s.last;
  const lastLine = l ? `${l.asker === me ? "Du" : nameIn(s, room.players, l.asker)}: ${l.kind === "frage" ? `${l.text} – ${ANSWER_TEXT[l.result]}` : l.result === "ja" ? "erraten!" : `${l.text || "laut geraten"} – falsch`}` : null;
  const sub = s.phase === "ask" ? (s.asked ? `Frage ${s.asked + 1} von höchstens ${s.perTurn} in diesem Zug` : "stellt laut eine Ja/Nein-Frage")
    : s.phase === "vote" ? (s.question ? `„${s.question}“` : "fragt laut – stimmt ab") : `rät${s.guess ? `: „${s.guess}“` : " laut"}`;
  return (
    <div className="glass flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2" data-testid="wbi-status">
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg leading-tight font-bold" data-testid="wbi-title">{who}</p>
        <p className="truncate text-sm text-muted-foreground">{sub}</p>
        {lastLine && <p className="truncate text-xs text-muted-foreground" data-testid="wbi-last">Zuletzt · {lastLine}</p>}
      </div>
      <Clock s={s} />
    </div>
  );
}

/** Alle Figuren außer der eigenen (die fehlt schon in der Sicht vom Server) */
function Figures({ game: s, room, me }: P) {
  const ids = s.order;
  const tight = ids.length > 6;
  return (
    <ul className={cn("grid min-h-0 flex-1 grid-cols-2 content-start overflow-hidden", tight ? "gap-1" : "gap-1.5")} data-testid="wbi-figures">
      {ids.map((id) => {
        const self = id === me;
        const fig = s.figures[id];
        const done = s.solved.includes(id);
        return (
          <li key={id} data-testid="wbi-figure" data-self={self || undefined}
            className={cn("glass min-w-0 rounded-xl px-2.5", tight ? "py-1" : "py-2", id === s.asker && "ring-2 ring-[#c2492e]", s.left.includes(id) && "opacity-50")}>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">{self ? "Du" : nameIn(s, room.players, id)}{done && <Check className="size-3.5 text-[#2f8f4e]" aria-label="erraten" />}{done && <span>+{s.scores[id]}</span>}</p>
            <p className={cn("line-clamp-2 leading-tight font-bold break-words", tight ? "text-sm" : "text-base")} data-testid="wbi-figure-name">{fig ?? (self ? "??? – das bist du" : "–")}</p>
            {!tight && <p className="truncate text-xs text-muted-foreground">{s.cats[id] ?? "geheim"}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Notizblock: Antworten auf die eigenen Fragen und eigene Zeilen */
function Notes({ game: s, act, owner, me }: P & { owner: string }) {
  const notes: Note[] = s.notes[owner] ?? [];
  const [text, setText] = useState("");
  const local = me === null;
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [notes.length]);
  const add = () => { if (!text.trim()) return; act({ type: "note", text, ...(local ? { player: owner } : {}) }); setText(""); };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <ul className="no-scrollbar grid min-h-0 flex-1 content-start gap-1 overflow-y-auto" data-testid="wbi-notes">
        {notes.length === 0 && <li className="py-3 text-center text-sm text-muted-foreground">Noch nichts notiert – jede Antwort landet hier.</li>}
        {notes.map((n, i) => (
          <li key={i} ref={i === notes.length - 1 ? end : undefined} className="glass flex items-center gap-2 rounded-lg px-2.5 py-1" data-testid="wbi-note">
            {n.a ? <span className={cn("shrink-0 rounded px-1.5 text-xs font-bold", TONE[n.a])}>{ANSWER_TEXT[n.a]}</span> : <span className="shrink-0 text-xs text-muted-foreground">Notiz</span>}
            <span className="min-w-0 flex-1 truncate text-sm">{n.q}</span>
            <button type="button" aria-label="Notiz löschen" className="shrink-0 p-1 text-muted-foreground" onClick={() => act({ type: "unnote", i, ...(local ? { player: owner } : {}) })}><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      <form className="flex shrink-0 gap-1.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} placeholder="Eigene Notiz …" className={cn(INPUT, "h-9 text-sm")} data-testid="wbi-note-in" aria-label="Eigene Notiz" />
        <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()}>Merken</Button>
      </form>
    </div>
  );
}

/** Frage eintippen (freiwillig) oder raten */
function AskForm({ game: s, act }: P) {
  const [mode, setMode] = useState<"frage" | "raten">("frage");
  const [text, setText] = useState("");
  const send = () => {
    vibrate(10);
    act(mode === "frage" ? { type: "ask", text } : { type: "guess", text });
    setText("");
    setMode("frage");
  };
  return (
    <form className="grid shrink-0 gap-1.5" onSubmit={(e) => { e.preventDefault(); send(); }} data-testid="wbi-ask">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={mode === "frage" ? MAX_TEXT : MAX_FIGURE} autoComplete="off" spellCheck={false}
        placeholder={mode === "frage" ? "Frage eintippen (freiwillig) …" : "Wer bist du? Leer lassen = laut raten"} className={INPUT}
        data-testid="wbi-text" aria-label={mode === "frage" ? "Frage" : "Tipp"} />
      {mode === "frage" ? (
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <Button type="submit" size="lg" data-testid="wbi-ask-send">Frage stellen</Button>
          <Button type="button" size="lg" variant="secondary" onClick={() => setMode("raten")} data-testid="wbi-guess-open"><HelpCircle className="size-4" />Raten</Button>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <Button type="submit" size="lg" className="bg-[#c2492e] text-white hover:bg-[#a83c24]" data-testid="wbi-guess-send">{text.trim() ? "Das bin ich!" : "Ich rate laut"}</Button>
          <Button type="button" size="lg" variant="secondary" onClick={() => setMode("frage")}>Zurück</Button>
        </div>
      )}
      {s.asked > 0 && mode === "frage" && <Button type="button" variant="ghost" size="sm" onClick={() => act({ type: "pass" })} data-testid="wbi-pass">Zug beenden – der Nächste fragt</Button>}
    </form>
  );
}

function VoteButtons({ game: s, me, act }: P) {
  const c = counts(s);
  const guess = s.phase === "guess";
  const options: Answer[] = guess ? ["ja", "nein"] : ["ja", "nein", "egal"];
  const mineVote = me ? s.votes[me] : undefined;
  return (
    <div className={cn("grid shrink-0 gap-1.5", guess ? "grid-cols-2" : "grid-cols-3")} data-testid="wbi-vote">
      {options.map((a) => (
        <button key={a} type="button" aria-pressed={mineVote === a} data-testid={`wbi-vote-${a}`}
          onClick={() => { vibrate(10); act({ type: "vote", a }); }}
          className={cn("grid h-16 place-items-center rounded-xl text-lg font-bold ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            mineVote === a ? TONE[a] : "bg-secondary")}>
          <span className="leading-tight">{guess ? (a === "ja" ? "Richtig" : "Falsch") : ANSWER_TEXT[a]}</span>
          {me !== null && <span className="text-xs font-semibold tabular-nums opacity-80">{c[a]}</span>}
        </button>
      ))}
    </div>
  );
}

/** Unten: was ich gerade tun kann */
function Actions(props: P) {
  const { game: s, room, me, isHost, act } = props;
  const mine = me === s.asker;
  const voter = voters(s).includes(me ?? "");
  const c = counts(s);
  const n = voters(s).length;
  if (s.phase === "ask") {
    if (mine) return <AskForm {...props} />;
    return <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">{nameIn(s, room.players, s.asker)} überlegt sich eine Frage …</p>;
  }
  const tally = <p className="text-center text-sm text-muted-foreground tabular-nums" data-testid="wbi-tally">{c.ja + c.nein + c.egal} von {n} haben abgestimmt</p>;
  if (mine) {
    return (
      <div className="grid shrink-0 gap-1.5">
        <p className="glass rounded-xl py-3 text-center font-semibold">{s.phase === "vote" ? "Die anderen stimmen ab …" : "Die anderen prüfen deinen Tipp …"}</p>
        {tally}
        {isHost && (
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            Host setzt:
            {(s.phase === "vote" ? (["ja", "nein", "egal"] as Answer[]) : (["ja", "nein"] as Answer[])).map((a) => (
              <Button key={a} size="sm" variant="ghost" onClick={() => act({ type: "decide", a })}>{s.phase === "guess" ? (a === "ja" ? "richtig" : "falsch") : ANSWER_TEXT[a]}</Button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (!voter) return <div className="shrink-0">{tally}</div>;
  return (
    <div className="grid shrink-0 gap-1.5">
      {s.phase === "guess" && (
        <p className="glass rounded-xl px-3 py-2 text-center leading-snug" data-testid="wbi-check">
          <span className="block truncate">{s.guess ? <>Tipp: „<b>{s.guess}</b>“</> : "Laut geraten"}</span>
          <span className="block truncate">gesucht: <b>{s.figures[s.asker!] ?? "?"}</b></span>
        </p>
      )}
      <VoteButtons {...props} />
      {tally}
    </div>
  );
}

/* ---------- Ein Handy für alle ---------- */

/** Halten zeigt die Figur des Fragenden – er schaut weg */
function Peek({ s, name }: { s: WbState; name: string }) {
  const [peek, setPeek] = useState(false);
  return (
    <button type="button" data-testid="wbi-peek"
      onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)} onContextMenu={(e) => e.preventDefault()}
      className="glass grid min-h-24 shrink-0 place-items-center gap-1 rounded-2xl px-3 py-3 text-center select-none">
      {peek ? (
        <>
          <span className="text-xs text-muted-foreground">{name} ist:</span>
          <span className="text-2xl font-black" data-testid="wbi-peek-figure">{s.figures[s.asker!]}</span>
          <span className="text-xs text-muted-foreground">{s.cats[s.asker!]}</span>
        </>
      ) : (
        <>
          <Eye className="size-6 text-muted-foreground" />
          <span className="font-semibold">Halten: Figur von {name} zeigen</span>
          <span className="text-xs text-muted-foreground">{name} schaut weg!</span>
        </>
      )}
    </button>
  );
}

function LocalPlay(props: P) {
  const { game: s, room, act } = props;
  const name = nameIn(s, room.players, s.asker);
  return (
    <>
      <div className="glass shrink-0 rounded-2xl px-3 py-2">
        <p className="truncate text-lg leading-tight font-bold" data-testid="wbi-title">{name} ist dran</p>
        <p className="truncate text-sm text-muted-foreground">
          {s.phase === "ask" ? "fragt laut – die anderen antworten gemeinsam" : s.phase === "vote" ? (s.question ? `„${s.question}“` : "Was ist die Antwort?") : `rät${s.guess ? `: „${s.guess}“` : " laut"} – stimmt das?`}
        </p>
      </div>
      <Peek s={s} name={name} />
      <Notes {...props} owner={s.asker!} />
      {s.phase === "ask" ? <AskForm {...props} /> : (
        <div className={cn("grid shrink-0 gap-1.5", s.phase === "guess" ? "grid-cols-2" : "grid-cols-3")} data-testid="wbi-vote">
          {(s.phase === "guess" ? (["ja", "nein"] as Answer[]) : (["ja", "nein", "egal"] as Answer[])).map((a) => (
            <Button key={a} size="lg" className={cn("h-14 px-2 text-lg leading-tight whitespace-normal", a === "egal" && "text-base", TONE[a])} onClick={() => { vibrate(10); act({ type: "vote", a }); }} data-testid={`wbi-vote-${a}`}>
              {s.phase === "guess" ? (a === "ja" ? <><Check className="size-5" />Richtig</> : <><X className="size-5" />Falsch</>) : ANSWER_TEXT[a]}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Auflösung ---------- */

function Over({ game: s, room, isHost, me, dispatch }: P) {
  const [reveal, setReveal] = useState(true);
  const ids = active(s);
  const ranking = ids.map((id) => ({ id, name: nameIn(s, room.players, id), score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
  const best = ranking[0]?.score ?? 0;
  if (reveal) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="wbi-reveal">
        <p className="shrink-0 pt-1 text-center text-2xl font-bold">Auflösung</p>
        <p className="shrink-0 text-center text-sm text-muted-foreground">{s.solved.length} von {ids.length} haben ihre Figur erraten</p>
        <ul className={cn("grid min-h-0 flex-1 content-start overflow-hidden", ids.length > 6 ? "grid-cols-2 gap-1" : "gap-1.5")}>
          {s.order.map((id) => {
            const rank = s.solved.indexOf(id);
            return (
              <li key={id} className={cn("glass flex min-w-0 items-center gap-2 rounded-xl px-3", ids.length > 6 ? "py-1" : "py-2", s.left.includes(id) && "opacity-50")} data-testid="wbi-reveal-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">{id === me ? "Du" : nameIn(s, room.players, id)}{rank >= 0 ? ` · ${rank + 1}. erraten` : " · nicht erraten"}</p>
                  <p className="truncate text-lg font-bold">{s.figures[id] ?? "?"}</p>
                </div>
                <b className={cn("shrink-0 tabular-nums", rank >= 0 ? "text-primary" : "text-muted-foreground")}>+{s.scores[id] ?? 0}</b>
              </li>
            );
          })}
        </ul>
        <Button size="lg" className="shrink-0" onClick={() => setReveal(false)} data-testid="wbi-podium">Zur Siegerehrung</Button>
      </div>
    );
  }
  return (
    <>
      <ResultScreen winner={best > 0 ? ranking.filter((r) => r.score === best).map((r) => r.name).join(" & ") : "Niemand"}
        subtitle={`${s.solved.length} von ${ids.length} erraten`} ranking={ranking} isHost={isHost || me === null} dispatch={dispatch} scoreLabel="Punkte">
        <Button variant="secondary" onClick={() => setReveal(true)}>Auflösung ansehen</Button>
      </ResultScreen>
    </>
  );
}
