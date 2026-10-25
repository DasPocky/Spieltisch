import { useCallback, useEffect, useRef, useState } from "react";
import { Check, SkipForward, X } from "lucide-react";
import {
  deadlineOf, seesWord, stageStart, standings, STYLES, styleOf, teamName, teamOf, termText, turnPoints, type ErkAction, type ErkState,
} from "@shared/games/erklaerspiel/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { nameOf, Panel } from "@/games/werwolf/parts";
import { TEAM_COLORS } from "@/games/stirnraten/colors";
import { useCountdown } from "@/platform/Countdown";
import { HandoffCover } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { playSound } from "@/platform/sound";
import { speak } from "@/platform/speech";
import { cn, vibrate } from "@/lib/utils";
import { erklSay } from "./narration";

export type P = BoardProps<ErkState, ErkAction>;
const color = (t: number | null) => (t === null || t < 0 ? undefined : TEAM_COLORS[t % TEAM_COLORS.length]);

/** Vorlesen wie ein Spielleiter: lokal das Gerät, online nur das Handy des Hosts */
function useNarration({ game: s, me, isHost, room }: P) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<ErkState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = erklSay(before, s, room.players);
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

/** Zeit um: das Handy des Erklärers meldet sofort, die anderen etwas später (falls es weg ist) */
function useTimeUp(s: ErkState, act: P["act"], delay: number) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      act({ type: "timeUp" });
      iv = setInterval(() => act({ type: "timeUp" }), 2500);
    }, Math.max(0, deadline - Date.now()) + delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, delay, act]);
}

export function Board(props: P) {
  const { game: s, me, isHost, act } = props;
  useNarration(props);
  useTimeUp(s, act, me === null || me === s.explainer ? 300 : isHost ? 1500 : 3000);
  if (s.phase === "over") return <Over {...props} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <TeamBar s={s} />
      {s.phase === "ready" ? <Ready {...props} /> : s.phase === "play" ? <Play {...props} /> : <Review {...props} />}
    </div>
  );
}

/** Punkte aller Teams in einer Zeile, das Team am Zug hervorgehoben */
function TeamBar({ s }: { s: ErkState }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" data-testid="teams">
      {s.teams.map((_, i) => (
        <span key={i} className={cn("flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold ring-1 ring-inset", i === s.team ? "bg-secondary ring-2" : "ring-border opacity-75")}
          style={i === s.team ? { boxShadow: `inset 0 0 0 2px ${color(i)}` } : undefined}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(i) }} aria-hidden="true" />
          <span className="truncate">{teamName(i).replace("Team ", "")}</span>
          <b className="tabular-nums" data-testid={`score-${i}`}>{s.teamScores[i] ?? 0}</b>
        </span>
      ))}
    </div>
  );
}

function Mates({ s, players, team }: { s: ErkState; players: Player[]; team: number }) {
  return <>{(s.teams[team] ?? []).filter((id) => id !== s.explainer).map((id) => nameOf(players, id)).join(", ")}</>;
}

/** Vor dem Zug: Erklärer nimmt das Handy (lokal mit Sichtschutz) und startet */
function Ready({ room, game: s, me, isHost, act }: P) {
  const players = room.players;
  const local = me === null;
  const explains = local || me === s.explainer;
  const [handed, setHanded] = useState(!local);
  const st = STYLES[styleOf(s)];
  const t = s.team ?? 0;
  const mine = me !== null && teamOf(s, me) === t;
  const round = s.variant === "drei" ? `Runde ${s.stage + 1} von 3 · noch ${s.left} von ${s.poolSize} Begriffen` : `Zug ${s.turn + 1} von ${s.turns}`;
  useEffect(() => { setHanded(!local); }, [local, s.turn, s.explainer]);
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-sm text-muted-foreground" data-testid="round">{round}</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      {stageStart(s) && s.stage > 0 && (
        <div className="glass shrink-0 rounded-xl px-3 py-2 text-center" data-testid="stage">
          <b>Neue Runde: {st.emoji} {st.name}</b><p className="text-sm text-muted-foreground">Dieselben Begriffe – {st.hint}.</p>
        </div>
      )}
      <div className="turn shrink-0 rounded-xl px-3 py-2" style={{ boxShadow: `inset 4px 0 0 ${color(t)}` }} data-testid="explainer">
        <div className="truncate text-lg font-bold">{nameOf(players, s.explainer)} erklärt <span className="font-semibold opacity-80">· {teamName(t)}</span></div>
        <div className="truncate text-sm opacity-80">Es raten: <Mates s={s} players={players} team={t} /></div>
      </div>
      {local && !handed ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center"><HandoffCover name={nameOf(players, s.explainer)} onReveal={() => setHanded(true)} /></div>
      ) : (
        <Panel title={explains ? "Du erklärst!" : mine ? "Ihr ratet gleich" : "Gleich ist das andere Team dran"}
          sub={explains ? `Nur du siehst die Begriffe. ${s.seconds} Sekunden – dein Team ruft, du tippst „Richtig“ oder „Weiter“.`
            : mine ? `${nameOf(players, s.explainer)} erklärt euch die Begriffe. Ruft, was euch einfällt!`
            : s.control ? "Ihr seht die Begriffe zur Kontrolle – nicht vorsagen! Sagt der Erklärer das Wort, nehmt ihr den Treffer nachher zurück." : "Zuhören und aufpassen, dass das Wort nicht fällt."}>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="text-5xl" aria-hidden="true">{st.emoji}</span>
            <b className="text-xl">{st.name}</b>
            <p className="text-sm text-muted-foreground">{st.hint}{s.minus ? " · Überspringen kostet einen Punkt" : ""}</p>
          </div>
        </Panel>
      )}
      {explains && (!local || handed) && <Button size="lg" className="shrink-0" data-testid="go" onClick={() => { vibrate(20); act({ type: "start" }); }}>Los geht's</Button>}
      {!explains && isHost && <p className="shrink-0 text-center text-xs text-muted-foreground">Ist {nameOf(players, s.explainer)} nicht da? Menü → „Jemand anderes erklärt“.</p>}
    </>
  );
}

function Clock({ s, players, big }: { s: ErkState; players: Player[]; big?: boolean }) {
  const left = useCountdown(deadlineOf(s), false);
  const { hits } = turnPoints(s);
  const warn = left !== null && left <= 10;
  return (
    <div className={cn("flex shrink-0 items-center justify-between rounded-xl px-3 py-1.5 ring-1 ring-inset", warn ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-secondary/60 ring-border")} data-testid="clock">
      <span className="min-w-0 truncate text-sm">{nameOf(players, s.explainer)} erklärt · ✓ {hits}{s.variant === "drei" ? ` · ${s.left} übrig` : ""}</span>
      <b className={cn("tabular-nums", big ? "text-3xl" : "text-xl")} data-testid="time">{left ?? ""}</b>
    </div>
  );
}

/** Schriftgröße nach dem längsten Wort */
function fitSize(text: string) {
  const longest = Math.max(5, ...text.split(/\s+/).map((w) => w.length));
  return `min(${Math.min(16, 95 / longest).toFixed(1)}vw, 4.5rem)`;
}

/** Während des Zugs: Erklärer mit Begriff und Knöpfen, Gegner mit Begriff zur Kontrolle, das ratende Team mit Uhr */
function Play(props: P) {
  const { room, game: s, me, isHost, act } = props;
  const players = room.players;
  const local = me === null;
  const explains = local || me === s.explainer;
  const i = s.cards.length - 1;
  const cur = s.cards[i];
  const st = STYLES[styleOf(s)];
  const left = useCountdown(deadlineOf(s), false);
  const busy = useRef(false);
  const mark = useCallback((r: "hit" | "pass") => {
    if (busy.current || !cur) return;
    busy.current = true;
    playSound(r === "hit" ? "turn" : "draw");
    vibrate(r === "hit" ? [30] : [10, 30, 10]);
    act({ type: "mark", i, r });
    setTimeout(() => { busy.current = false; }, 350);
  }, [act, cur, i]);
  useEffect(() => { if (left !== null && left <= 5 && left > 0 && explains) vibrate(25); if (left === 0) playSound("error"); }, [left, explains]);

  if (explains) {
    const text = termText(cur?.w ?? "");
    return (
      <>
        <Clock s={s} players={players} big />
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-paper px-4 py-3 text-center text-paper-ink shadow-sm" data-testid="explain-card">
          <span className="rounded-full bg-black/5 px-3 py-0.5 text-sm font-semibold"><span aria-hidden="true">{st.emoji}</span> {st.name}</span>
          <p className="leading-[1.05] font-black tracking-tight break-words hyphens-auto" lang="de" style={{ fontSize: fitSize(text) }} data-testid="word">{text}</p>
          <p className="text-sm opacity-70">{st.hint}</p>
        </section>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button size="lg" variant="secondary" className="h-16 text-lg" onClick={() => mark("pass")} data-testid="pass"><SkipForward />Weiter</Button>
          <Button size="lg" className="h-16 bg-emerald-600 text-lg text-white hover:bg-emerald-600/90" onClick={() => mark("hit")} data-testid="hit"><Check />Richtig</Button>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 self-center" onClick={() => act({ type: "stop" })}>Zug beenden</Button>
      </>
    );
  }
  const control = seesWord(s, me);
  const mine = teamOf(s, me) === s.team;
  return (
    <>
      <Clock s={s} players={players} />
      <Panel title={mine ? "Ratet!" : control ? "Kontrolle" : "Das andere Team rät"}
        sub={mine ? `${nameOf(players, s.explainer)} erklärt – ruft laut, was es sein könnte.` : control ? "Nicht vorsagen – passt auf, dass das Wort nicht fällt." : "Zuhören und aufpassen."}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="rounded-full bg-secondary px-3 py-1 font-semibold ring-1 ring-inset ring-border"><span aria-hidden="true">{st.emoji}</span> {st.name}</span>
          {control && cur?.w ? <p className="text-4xl font-black tracking-tight break-words" data-testid="control-word">{termText(cur.w)}</p>
            : <p className="text-7xl font-black tabular-nums" aria-label={`${turnPoints(s).hits} erraten`}>✓ {turnPoints(s).hits}</p>}
          <p className="text-sm text-muted-foreground">{st.hint}</p>
        </div>
      </Panel>
      {isHost && <Button variant="outline" size="sm" className="shrink-0 self-center" onClick={() => act({ type: "stop" })}>Zug für {nameOf(players, s.explainer)} beenden</Button>}
    </>
  );
}

/** Nach dem Zug: Treffer prüfen – Gegner (und Host) nehmen zurück, der Erklärer trägt nach; dann bestätigen */
function Review({ room, game: s, me, isHost, act }: P) {
  const players = room.players;
  const local = me === null;
  const explains = local || me === s.explainer;
  const opponent = me !== null && s.order.includes(me) && teamOf(s, me) !== s.team;
  const canConfirm = explains || isHost || opponent;
  const { hits, passes, points } = turnPoints(s);
  const many = s.cards.length > 8;
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-sm text-muted-foreground">Zug von {nameOf(players, s.explainer)} · {teamName(s.team)}</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <Panel title={<span data-testid="review-title">{hits} erraten · {points >= 0 ? "+" : ""}{points}</span>}
        sub={opponent || isHost || local ? "Ist das Wort gefallen? Treffer antippen nimmt ihn zurück." : explains ? "Falsch getippt? Antippen korrigiert." : `${s.minus && passes ? `${passes} übersprungen · ` : ""}Die Gegner prüfen.`}>
        <ul className={cn("grid content-start gap-1", many && "grid-cols-2")} data-testid="review">
          {s.cards.map((c, i) => {
            const can = c.r === "hit" ? explains || isHost || opponent : explains || isHost;
            return (
              <li key={i}>
                <button type="button" disabled={!can} onClick={() => act({ type: "fix", i })}
                  className={cn("flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 text-left ring-1 ring-inset outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                    many ? "py-1 text-sm" : "py-1.5", c.r === "hit" ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-secondary/60 text-muted-foreground ring-border")}>
                  {c.r === "hit" ? <Check className="size-4 shrink-0 text-emerald-600" /> : <X className="size-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate font-semibold">{termText(c.w)}</span>
                </button>
              </li>
            );
          })}
          {!s.cards.length && <li className="text-muted-foreground">Kein Begriff gewertet.</li>}
        </ul>
      </Panel>
      {canConfirm ? <Button size="lg" className="shrink-0" data-testid="confirm" onClick={() => act({ type: "confirm" })}>Passt – weiter</Button>
        : <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Die Gegner prüfen und bestätigen …</p>}
    </>
  );
}

function Over({ room, game: s, isHost, dispatch }: P) {
  const players = room.players;
  const rows = standings(s);
  const best = rows[0]?.score;
  const top = rows.filter((r) => r.score === best).map((r) => r.label);
  const ranking = rows.map((r) => ({ id: r.ids[0] ?? `t${r.team}`, name: `${r.label.replace("Team ", "")} (${r.ids.map((id) => nameOf(players, id)).join(", ")})`, score: r.score }));
  const sub = s.variant === "drei" ? `Drei Runden mit ${s.poolSize} Begriffen` : `${s.teams.length} Teams · ${s.turn} Züge`;
  return <ResultScreen winner={top.join(" & ") || "Niemand"} subtitle={sub} ranking={ranking} scoreLabel="Pkt." isHost={isHost} dispatch={dispatch} />;
}
