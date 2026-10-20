import { useEffect, useState } from "react";
import { Eye, EyeOff, MessageCircle, VenetianMask } from "lucide-react";
import { catName, wordText } from "@shared/games/stirnraten/cards";
import { IMPOSTOR_POINTS, LAPS, type StirnState } from "@shared/games/stirnraten/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { nameOf, Panel, Picker } from "@/games/werwolf/parts";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { cn } from "@/lib/utils";
import { Standings, TopRow, type P } from "./parts";

/** Hochstapler: alle kennen den Begriff, einer nicht. Reihum ein Wort, dann abstimmen. */
export function ImpostorGame(props: P) {
  const { room, game: s, me, isHost, act } = props;
  const players = room.players;
  const local = me === null;
  const playing = me !== null && s.order.includes(me);
  const [pick, setPick] = useState<string | null | undefined>(undefined);
  useEffect(() => setPick(undefined), [s.phase, s.turn]);
  const head = <TopRow room={room}>Runde {Math.min(s.turn + 1, s.turns)} von {s.turns} · Kategorie: {catName(s.cat)}</TopRow>;

  if (s.phase === "look") {
    if (local) return <PassAround {...props} />;
    const ready = s.seen.includes(me ?? "");
    return (
      <>
        {head}
        <Panel title="Dein Begriff" sub="Tippe drauf und merk ihn dir – niemand darf mitlesen.">
          <div className="flex flex-1 flex-col justify-center">{playing ? <SecretWord key={s.turn} s={s} id={me!} /> : <p className="text-center text-muted-foreground">Du schaust zu.</p>}</div>
        </Panel>
        {ready || !playing ? <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Warte auf die anderen ({s.seen.length}/{s.order.length}) …</p>
          : <Button size="lg" className="shrink-0" onClick={() => act({ type: "seen" })}>Gesehen – bereit</Button>}
      </>
    );
  }

  if (s.phase === "talk") {
    const cur = s.speakOrder[s.speaker % s.speakOrder.length] ?? null;
    const lap = Math.floor(s.speaker / Math.max(1, s.speakOrder.length)) + 1;
    return (
      <>
        {head}
        <div className="turn flex shrink-0 items-center gap-2 rounded-xl px-3 py-2" data-testid="speaker">
          <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate text-lg font-bold">{nameOf(players, cur)} sagt ein Wort</span>
        </div>
        <Panel title={`Runde ${lap} von ${LAPS}`} sub="Jeder sagt reihum genau ein Wort, das zum Begriff passt – nicht zu offensichtlich, sonst rät der Hochstapler mit.">
          <Order s={s} players={players} />
          {playing && <div className="mt-3"><SecretWord s={s} id={me!} compact /></div>}
        </Panel>
        {(local || isHost || me === cur) && <Button size="lg" className="shrink-0" onClick={() => act({ type: "said" })}>{me === cur ? "Gesagt – weiter" : `${nameOf(players, cur)} hat's gesagt – weiter`}</Button>}
      </>
    );
  }

  if (s.phase === "vote") {
    if (local) {
      return (
        <>
          {head}
          <Panel title="Wer ist der Hochstapler?" sub="Auf drei zeigen alle auf ihren Verdacht. Wer die meisten Stimmen bekommt (mehr als die Hälfte), ist verurteilt.">
            <Picker ids={s.order} players={players} selected={pick ? [pick] : []} onPick={(id) => setPick(id === pick ? undefined : id)}
              extra={{ label: "Keine Mehrheit", selected: pick === null, onPick: () => setPick(pick === null ? undefined : null) }} />
          </Panel>
          <Button size="lg" className="shrink-0" disabled={pick === undefined} onClick={() => act({ type: "verdict", target: pick ?? null })}>
            {pick === undefined ? "Wen trifft es?" : pick === null ? "Keine Mehrheit" : `${nameOf(players, pick)} verurteilen`}
          </Button>
        </>
      );
    }
    const mine = s.votes[me ?? ""];
    return (
      <>
        {head}
        <Panel title="Wer ist der Hochstapler?" sub="Tippe auf deinen Verdacht. Mehr als die Hälfte der Stimmen verurteilt.">
          {playing && <Picker ids={s.order.filter((id) => id !== me)} players={players} selected={mine && mine !== "?" ? [mine] : []} onPick={(id) => act({ type: "vote", target: id })} />}
        </Panel>
        <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground" data-testid="vote-status">{Object.keys(s.votes).length}/{s.order.length} abgestimmt</p>
      </>
    );
  }

  if (s.phase === "guess") {
    const mineGuess = local || me === s.impostor;
    return (
      <>
        {head}
        <Panel title={<span className="flex items-center gap-2"><VenetianMask className="size-6 text-destructive" />Erwischt!</span>}
          sub={mineGuess ? "Letzte Chance: Welcher Begriff war es?" : "Der Hochstapler rät jetzt den Begriff …"}>
          {mineGuess && (
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Begriffe">
              {s.options.map((w) => (
                <button key={w} type="button" onClick={() => setPick(w)} aria-pressed={pick === w}
                  className={cn("min-w-0 truncate rounded-xl px-2.5 py-2 text-left text-sm font-semibold ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring", pick === w ? "bg-ice text-navy-950" : "bg-secondary/70")}>
                  {wordText(w)}
                </button>
              ))}
            </div>
          )}
        </Panel>
        {mineGuess && <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "guess", word: pick })}>{pick ? `Tipp: ${wordText(pick)}` : "Welcher Begriff?"}</Button>}
      </>
    );
  }

  // Auflösung
  return (
    <>
      {head}
      <Panel><Result s={s} players={players} /><div className="mt-3"><Standings s={s} players={players} /></div></Panel>
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "next" })}>Runde {s.turn + 1} von {s.turns} starten</Button>
    </>
  );
}

function Order({ s, players }: { s: StirnState; players: Player[] }) {
  const cur = s.speaker % Math.max(1, s.speakOrder.length);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Reihenfolge">
      {s.speakOrder.map((id, i) => (
        <li key={id} className={cn("rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ring-border", i === cur ? "bg-ice text-navy-950" : i < cur ? "bg-secondary/40 text-muted-foreground" : "bg-secondary/70")}>
          {nameOf(players, id)}
        </li>
      ))}
    </ol>
  );
}

/** Eigene Karte: Begriff oder „Du bist der Hochstapler“ – verdeckt, bis man sie antippt */
function SecretWord({ s, id, compact }: { s: StirnState; id: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const imp = s.impostor === id;
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} data-testid="secret-word" aria-label={open ? "Begriff verdecken" : "Begriff ansehen"}
      className={cn("w-full shrink-0 rounded-2xl text-center outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring", compact ? "px-3 py-2" : "px-4 py-6",
        !open ? "card-back text-paper" : imp ? "bg-gradient-to-b from-deep-700 to-deep-950 text-white ring-1 ring-inset ring-destructive/50" : "bg-paper text-paper-ink")}>
      {!open ? <span className="flex items-center justify-center gap-2 font-bold"><Eye className="size-5" />{compact ? "Begriff ansehen" : "Tippen: Begriff ansehen"}</span>
        : imp ? (
          <span className={cn("flex items-center gap-3", compact ? "justify-center" : "flex-col")}>
            <VenetianMask className={cn(compact ? "size-6" : "size-14", "text-destructive")} aria-hidden="true" />
            <span><span className={cn("block font-bold", compact ? "text-lg" : "text-3xl")} data-testid="word-text">Du bist der Hochstapler</span>
              {!compact && <span className="mt-1 block text-sm text-white/80">Kategorie: {catName(s.cat)}. Hör gut zu und tu so, als wüsstest du es.</span>}</span>
          </span>
        ) : (
          <span className={cn("block font-bold tracking-tight", compact ? "text-lg" : "text-3xl")} data-testid="word-text">{wordText(s.word)}</span>
        )}
      {open && !compact && <span className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold opacity-60"><EyeOff className="size-3.5" />Tippen zum Verdecken</span>}
    </button>
  );
}

/** Ein Handy für alle: Begriff reihum ansehen, mit Sichtschutz */
function PassAround({ room, game: s, act }: P) {
  const players = room.players;
  const cur = s.order.find((id) => !s.seen.includes(id)) ?? null;
  const { covered, reveal } = useHandoff(true, cur, 2);
  if (!cur) return null;
  return (
    <>
      <TopRow room={room}>Runde {s.turn + 1} von {s.turns} · Begriff ansehen ({s.seen.length}/{s.order.length})</TopRow>
      {covered ? <div className="flex min-h-0 flex-1 flex-col justify-center"><HandoffCover name={nameOf(players, cur)} onReveal={reveal} /></div> : (
        <>
          <Panel title={`${nameOf(players, cur)}, dein Begriff`} sub="Merk ihn dir. Dann verdecken und weitergeben.">
            <div className="flex flex-1 flex-col justify-center"><SecretWord key={`${s.turn}-${cur}`} s={s} id={cur} /></div>
          </Panel>
          <Button size="lg" className="shrink-0" onClick={() => act({ type: "seen", player: cur })}>{s.seen.length + 1 < s.order.length ? "Gesehen – weitergeben" : "Gesehen – los geht's"}</Button>
        </>
      )}
    </>
  );
}

function Result({ s, players }: { s: StirnState; players: Player[] }) {
  const r = s.result;
  if (!r) return null;
  const text = !r.caught ? (r.accused ? `${nameOf(players, r.accused)} war unschuldig.` : "Keine Mehrheit.")
    : r.winner === "impostor" ? `Erwischt – aber den Begriff erraten (+${IMPOSTOR_POINTS.guessed}).` : `Entlarvt${r.guessed ? ` – getippt: ${wordText(r.guessed)}` : ""}.`;
  return (
    <div className="grid gap-1 text-center" data-testid="impostor-result">
      <p className={cn("text-2xl font-bold tracking-tight", r.winner === "impostor" ? "text-destructive" : "text-ice")}>{r.winner === "impostor" ? "Der Hochstapler gewinnt" : "Hochstapler entlarvt!"}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-left">
        <div className="rounded-xl bg-paper px-3 py-2 text-paper-ink"><div className="text-xs opacity-70">Begriff</div><b data-testid="reveal-word">{wordText(r.word)}</b></div>
        <div className="rounded-xl bg-gradient-to-b from-deep-700 to-deep-950 px-3 py-2 text-white"><div className="text-xs opacity-70">Hochstapler</div><b className="block truncate">{nameOf(players, r.impostor)}</b></div>
      </div>
    </div>
  );
}
