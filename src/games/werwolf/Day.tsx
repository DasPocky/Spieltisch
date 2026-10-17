import { useEffect, useState } from "react";
import { Pause, Play, Sun } from "lucide-react";
import { aliveIds, ROLES, voters, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconTitle, nameOf, News, Panel, Picker } from "./parts";
import { DAWN_SAY } from "./script";
import { speak, useSpokenCountdown } from "./useSpeech";
import { tempoOf, useCountdown } from "./Auto";
import { morningSay } from "./narration";

/** Urteil des Dorfes zum Vorlesen, wenn danach die Nacht beginnt */
export function verdictSay(s: WerwolfState, players: Player[]) {
  if (s.news?.kind !== "day") return "";
  const d = s.news.deaths;
  if (s.news.idiot) return `${nameOf(players, s.news.idiot)} ist der Dorfdepp und bleibt am Leben. `;
  if (!d.length) return "Das Dorf hat niemanden verurteilt. ";
  return d.map((x) => `${nameOf(players, x.id)} ist tot${s.revealDead ? ` und war ${ROLES[s.roles[x.id]].name}` : ""}.`).join(" ") + " ";
}

export type DayStage = "talk" | "count" | "pick" | "secret";

/**
 * Tag mit Diskussions-Timer und Abstimmung: zeigen („3, 2, 1“), geheim reihum oder gemeinsam.
 * Das Handy liegt offen in der Mitte – hier darf die App sprechen.
 */
export function Day({ s, players, act, options, speech }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; options: Options; speech: boolean }) {
  const mode = options.vote === "secret" ? "secret" : options.vote === "talk" ? "talk" : "point";
  const minutes = tempoOf(options).talk;
  const [stage, setStage] = useState<DayStage>("talk");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [count, setCount] = useState(3);
  const [tie, setTie] = useState<string[]>([]);
  const left = useCountdown(deadline, pausedLeft !== null);
  const say = (text: string) => (speech ? speak(text) : Promise.resolve());
  useSpokenCountdown(stage === "talk" && pausedLeft === null ? left : null, speech, minutes * 60);

  useEffect(() => {
    let alive = true;
    void say(`${s.night === 0 ? "" : `${DAWN_SAY} `}${morningSay(s, players)} Ihr habt ${minutes} Minuten.`).then(() => { if (alive) setDeadline(Date.now() + minutes * 60_000); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (stage !== "talk" || pausedLeft !== null) return;
    if (left === 0) startVote(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  // „3, 2, 1 – zeigt!“
  useEffect(() => {
    if (stage !== "count") return;
    if (count === 0) { setStage("pick"); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, count]);

  function startVote(timeUp: boolean) {
    const pre = timeUp ? "Die Zeit ist um. " : "";
    setDeadline(null);
    if (mode === "point") { setCount(3); void say(`${pre}Auf drei zeigt jeder auf einen Verdächtigen.`).then(() => { setStage("count"); void say("Eins. Zwei. Drei!"); }); }
    else if (mode === "secret") { setStage("secret"); void say(`${pre}Gebt das Handy reihum zur geheimen Abstimmung.`); }
    else { setStage("pick"); void say(`${pre}Einigt euch, wen das Dorf verurteilt.`); }
  }
  const shown = pausedLeft ?? left;
  const mmss = shown === null ? "…" : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, "0")}`;

  return (
    <>
      <News s={s} players={players} />
      {stage === "talk" && (
        <>
          <Panel title={<IconTitle icon={Sun}>Tag {s.night} – diskutiert!</IconTitle>} sub="Wer könnte ein Werwolf sein? Wenn die Zeit um ist, wird abgestimmt.">
            <div className="grid flex-1 place-content-center justify-items-center gap-2">
              <span className={cn("text-6xl font-bold tabular-nums", shown !== null && shown <= 60 && "text-ice")} data-testid="day-timer">{mmss}</span>
              <span className="text-sm text-muted-foreground">{pausedLeft !== null ? "Angehalten" : shown !== null && shown <= 60 ? "Letzte Minute" : "Diskussion läuft"}</span>
            </div>
          </Panel>
          <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2">
            <Button size="lg" variant="secondary" aria-label={pausedLeft !== null ? "Weiterlaufen lassen" : "Anhalten"}
              onClick={() => { if (pausedLeft !== null) { setDeadline(Date.now() + pausedLeft * 1000); setPausedLeft(null); } else setPausedLeft(left ?? 0); }}>
              {pausedLeft !== null ? <Play /> : <Pause />}
            </Button>
            <Button size="lg" onClick={() => startVote(false)}>Jetzt abstimmen</Button>
          </div>
        </>
      )}
      {stage === "count" && (
        <Panel title={<IconTitle icon={Sun}>Gleich zeigen alle …</IconTitle>} sub="Auf drei zeigt jeder auf einen Verdächtigen.">
          <div className="grid flex-1 place-items-center">
            <span key={count} className="pop text-8xl font-bold text-ice tabular-nums" data-testid="vote-count">{count || "Zeigt!"}</span>
          </div>
        </Panel>
      )}
      {stage === "secret" && <SecretVote s={s} players={players} onResult={(target, tied) => {
        // Gleichstand ohne Wahl des Hauptmanns: am Tisch klären; sonst gilt seine Stimme (der Sündenbock geht vor)
        if (tied.length && !target) { setTie(tied); setStage("pick"); } else act({ type: "lynch", target, tie: tied.length > 0 || undefined });
      }} />}
      {stage === "pick" && <Verdict s={s} players={players} act={act} tie={tie} pointed={mode === "point"} />}
    </>
  );
}

/**
 * Ergebnis eintragen: wer hat die meisten Stimmen bzw. auf wen hat sich das Dorf geeinigt?
 * Gleichstand: Ein lebender Sündenbock stirbt (die Logik weiß, ob es ihn gibt), sonst entscheidet der Hauptmann.
 */
export function Verdict({ s, players, act, tie, pointed }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; tie: string[]; pointed: boolean }) {
  const [pick, setPick] = useState<string | null | undefined>(undefined);
  const [tied, setTied] = useState(tie.length > 0);
  const captain = s.captain && s.alive[s.captain] ? nameOf(players, s.captain) : null;
  const onTie = captain ? `Gleichstand: Lebt ein Sündenbock, stirbt er. Sonst entscheidet Hauptmann ${captain} – tippt an, wen er wählt.` : "Gleichstand: Lebt ein Sündenbock, stirbt er – sonst niemand.";
  const sub = tie.length ? `Gleichstand zwischen ${tie.map((id) => nameOf(players, id)).join(" und ")}. ${onTie}`
    : tied ? onTie
    : pointed ? `Auf wen zeigen die meisten Finger?${captain ? ` ${captain} zählt als Hauptmann doppelt.` : ""} Bei Gleichstand: „Gleichstand“ antippen.` : "Wen verurteilt das Dorf?";
  return (
    <>
      <Panel title={<IconTitle icon={Sun}>Urteil</IconTitle>} sub={sub}>
        <Picker ids={tie.length ? tie : aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={(id) => setPick(id === pick ? undefined : id)}
          extra={{ label: "Niemand", selected: pick === null, onPick: () => setPick(pick === null ? undefined : null) }} />
        {!tie.length && (
          <button type="button" aria-pressed={tied} onClick={() => setTied(!tied)}
            className={cn("mt-1.5 h-11 shrink-0 rounded-xl px-3 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              tied ? "bg-ice text-navy-950" : "text-muted-foreground ring-1 ring-inset ring-border")}>
            Gleichstand
          </button>
        )}
      </Panel>
      <Button size="lg" className="shrink-0" disabled={pick === undefined} onClick={() => act({ type: "lynch", target: pick ?? null, tie: tied || undefined })}>
        {pick ? `${nameOf(players, pick)} verurteilen` : pick === null ? (tied ? "Gleichstand – weiter" : "Niemanden verurteilen") : "Auswahl treffen"}
      </Button>
    </>
  );
}

/** Geheime Abstimmung: das Handy geht reihum, die App zählt (Hauptmann doppelt, Rabe +2) */
export function SecretVote({ s, players, onResult }: { s: WerwolfState; players: Player[]; onResult: (target: string | null, tie: string[]) => void }) {
  const list = voters(s);
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [votes, setVotes] = useState<Record<string, string | null>>({});
  const cur = list[i];
  const cast = (target: string | null) => {
    const next = { ...votes, [cur]: target };
    setVotes(next);
    setReady(false);
    if (i + 1 < list.length) { setI(i + 1); return; }
    const tally = new Map<string, number>();
    for (const [voter, t] of Object.entries(next)) if (t) tally.set(t, (tally.get(t) ?? 0) + (voter === s.captain ? 2 : 1));
    if (s.raven && s.alive[s.raven]) tally.set(s.raven, (tally.get(s.raven) ?? 0) + 2);
    if (!tally.size) { onResult(null, []); return; }
    const max = Math.max(...tally.values());
    const top = [...tally].filter(([, n]) => n === max).map(([id]) => id);
    if (top.length === 1) { onResult(top[0], []); return; }
    // Gleichstand: Der Hauptmann entscheidet, wenn er für einen der Gleichstehenden gestimmt hat
    const cv = s.captain ? next[s.captain] : null;
    onResult(cv && top.includes(cv) ? cv : null, top);
  };
  if (!ready) {
    return (
      <>
        <Panel title={`Geheime Abstimmung · ${i + 1} von ${list.length}`} sub={`Gib das Handy an ${nameOf(players, cur)}. Die anderen schauen weg.`} />
        <Button size="lg" className="shrink-0" onClick={() => setReady(true)}>Ich bin {nameOf(players, cur)}</Button>
      </>
    );
  }
  return (
    <Panel title={`${nameOf(players, cur)} stimmt ab`} sub="Antippen – dann sofort weitergeben.">
      <Picker ids={aliveIds(s).filter((id) => id !== cur)} players={players} selected={[]} onPick={(id) => cast(id)}
        extra={{ label: "Enthaltung", selected: false, onPick: () => cast(null) }} />
    </Panel>
  );
}
