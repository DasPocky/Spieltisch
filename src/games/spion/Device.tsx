import { useEffect, useState } from "react";
import { Eye, VenetianMask, Vote } from "lucide-react";
import { scoringOf, type SpionState } from "@shared/games/spion/logic";
import { placeName } from "@shared/games/spion/places";
import { Button } from "@/components/ui/button";
import { nameOf, Panel, Picker } from "@/games/werwolf/parts";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { RulesSheet } from "@/platform/RulesSheet";
import { cn } from "@/lib/utils";
import { type P, SecretCard, Clock, Asker, Chips, PlaceList, verdictHint, Reveal, TopRow } from "./parts";

/** Ein Handy für alle: das Gerät wandert reihum */
export function Device({ room, game: s, act }: P) {
  const players = room.players;
  const [step, setStep] = useState<null | "accuse" | "reveal" | "peek">(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null | undefined>(undefined);
  // Phasenwechsel: Zwischenschritte zurücksetzen
  useEffect(() => { setStep(null); setPick(undefined); setPeekId(null); }, [s.phase, s.round]);
  const order = players.map((p) => p.id).filter((id) => id in s.scores);

  if (s.phase === "look") return <PassAround s={s} room={room} act={act} order={order} />;
  if (s.phase === "reveal") return <Reveal s={s} players={players} act={act} />;

  if (s.phase === "vote" && s.vote) {
    return (
      <>
        <Clock s={s} leader act={act} talk={room.options.narrate !== false} />
        <Panel title={s.vote.final ? "Zeit ist um – wer ist der Spion?" : "Abstimmung"} sub={<>Auf drei zeigen alle auf ihren Verdacht. {verdictHint(room.options)}</>}>
          <Picker ids={order} players={players} selected={pick ? [pick] : []} onPick={(id) => setPick(id === pick ? undefined : id)}
            extra={{ label: "Keine Mehrheit", selected: pick === null, onPick: () => setPick(pick === null ? undefined : null) }} />
        </Panel>
        <div className={cn("grid shrink-0 gap-2", !s.vote.final && "grid-cols-[auto_1fr]")}>
          {!s.vote.final && <Button size="lg" variant="secondary" onClick={() => act({ type: "cancelVote" })}>Abbrechen</Button>}
          <Button size="lg" disabled={pick === undefined} onClick={() => act({ type: "verdict", target: pick ?? null })}>
            {pick === undefined ? "Wen trifft es?" : pick === null ? "Keine Mehrheit" : `${nameOf(players, pick)} verurteilen`}
          </Button>
        </div>
      </>
    );
  }

  if (s.phase === "guess" && s.guess) {
    return (
      <>
        <TopRow s={s} room={room}><b className="text-foreground">{nameOf(players, s.guess.spy)}</b> ist {s.spies.length > 1 ? "ein" : "der"} Spion{s.guess.caught ? " – letzte Chance" : ""}</TopRow>
        <PlaceList s={s} mode="pick" picked={pick ?? null} onPick={setPick} />
        <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "guess", place: pick })}>{pick ? `Tipp: ${placeName(pick)}` : "Welcher Ort ist es?"}</Button>
      </>
    );
  }

  // Fragerunde
  if (step === "peek") {
    if (peekId) {
      return (
        <>
          <Panel title={`Nur ${nameOf(players, peekId)} schaut!`}><SecretCard s={s} id={peekId} /></Panel>
          <Button size="lg" className="shrink-0" onClick={() => { setPeekId(null); setStep(null); }}>Verdeckt – zurück</Button>
        </>
      );
    }
    return (
      <>
        <Panel title="Karte nochmal ansehen" sub="Wer will? Tippe auf deinen Namen – die anderen schauen weg.">
          <Picker ids={order} players={players} selected={[]} onPick={setPeekId} />
        </Panel>
        <Button size="lg" variant="secondary" className="shrink-0" onClick={() => setStep(null)}>Zurück</Button>
      </>
    );
  }
  if (step === "accuse") {
    return (
      <>
        <Clock s={s} leader act={act} talk={room.options.narrate !== false} />
        <Panel title="Wer startet die Abstimmung?" sub="Jeder darf das einmal pro Runde. Wer den Spion so entlarvt, bekommt einen Extrapunkt.">
          <Picker ids={order} players={players} selected={[]} disabled={(id) => s.accusers.includes(id)} onPick={(id) => act({ type: "accuse", by: id })} />
        </Panel>
        <Button size="lg" variant="secondary" className="shrink-0" onClick={() => setStep(null)}>Zurück</Button>
      </>
    );
  }
  if (step === "reveal") {
    return (
      <>
        <Clock s={s} leader act={act} talk={room.options.narrate !== false} />
        <Panel title="Wer ist der Spion?" sub="Der Spion deckt auf und rät dann den Ort.">
          <Picker ids={order} players={players} selected={[]} onPick={(id) => act({ type: "reveal", spy: id })} />
        </Panel>
        <Button size="lg" variant="secondary" className="shrink-0" onClick={() => setStep(null)}>Zurück</Button>
      </>
    );
  }
  return (
    <>
      <Clock s={s} leader act={act} talk={room.options.narrate !== false} />
      <Asker s={s} players={players}>
        <Chips list={order.filter((id) => id !== s.asker)} players={players} label="… und fragt:" disabled={(id) => id === s.prevAsker && order.length > 2}
          onPick={(id) => act({ type: "ask", to: id })} />
      </Asker>
      <PlaceList s={s} mode="read" />
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Button size="lg" className="whitespace-nowrap px-3" onClick={() => (scoringOf(room.options) === "points" ? setStep("accuse") : act({ type: "accuse" }))}><Vote />Abstimmen</Button>
        <Button size="lg" variant="secondary" className="whitespace-nowrap px-3" onClick={() => setStep("reveal")}><VenetianMask />Spion rät</Button>
      </div>
      <div className="flex shrink-0 items-center justify-between px-1">
        <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground" onClick={() => setStep("peek")}><Eye className="size-4" />Karte nochmal ansehen</button>
        <RulesSheet gameId={room.gameId} />
      </div>
    </>
  );
}

/** Karten reihum ansehen – mit Sichtschutz beim Weitergeben */
function PassAround({ s, room, act, order }: { s: SpionState; room: P["room"]; act: P["act"]; order: string[] }) {
  const players = room.players;
  const cur = order.find((id) => !s.seen.includes(id)) ?? null;
  const { covered, reveal } = useHandoff(true, cur, 2);
  if (!cur) return null;
  return (
    <>
      <TopRow s={s} room={room}>Runde {s.round} von {s.rounds} · Karten ansehen ({s.seen.length}/{order.length})</TopRow>
      {covered ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center"><HandoffCover name={nameOf(players, cur)} onReveal={reveal} /></div>
      ) : (
        <>
          <Panel title={`${nameOf(players, cur)}, deine Karte`} sub="Merk sie dir gut. Dann verdecken und weitergeben.">
            <div className="flex flex-1 flex-col justify-center"><SecretCard key={`${s.round}-${cur}`} s={s} id={cur} /></div>
          </Panel>
          <Button size="lg" className="shrink-0" onClick={() => act({ type: "seen", player: cur })}>
            {s.seen.length + 1 < order.length ? "Gesehen – weitergeben" : "Gesehen – Fragerunde starten"}
          </Button>
        </>
      )}
    </>
  );
}

/* ───────────── Online: jeder am eigenen Handy ───────────── */
