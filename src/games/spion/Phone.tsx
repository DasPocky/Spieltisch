import { useEffect, useState } from "react";
import { VenetianMask, Vote } from "lucide-react";
import { placeName } from "@shared/games/spion/places";
import { Button } from "@/components/ui/button";
import { nameOf, Panel, Picker } from "@/games/werwolf/parts";
import { cn } from "@/lib/utils";
import { type P, SecretCard, Clock, Asker, Chips, PlaceList, verdictHint, Reveal, TopRow } from "./parts";

/** Online: jeder auf seinem eigenen Handy */
export function Phone({ room, game: s, me, isHost, act }: P & { me: string }) {
  const players = room.players;
  const order = players.map((p) => p.id).filter((id) => id in s.scores);
  const spy = s.spies.includes(me);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [s.phase, s.round]);
  const playing = me in s.scores;

  if (s.phase === "reveal") return <Reveal s={s} players={players} act={act} />;

  if (s.phase === "look") {
    const ready = s.seen.includes(me);
    return (
      <>
        <TopRow s={s} room={room} />
        <Panel title="Deine Karte" sub="Tippe drauf, merk sie dir – niemand darf mitlesen.">
          <div className="flex flex-1 flex-col justify-center">{playing ? <SecretCard key={s.round} s={s} id={me} /> : <p className="text-center text-muted-foreground">Du schaust zu.</p>}</div>
        </Panel>
        {ready || !playing
          ? <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Warte auf die anderen ({s.seen.length}/{order.length}) …</p>
          : <Button size="lg" className="shrink-0" onClick={() => act({ type: "seen" })}>Gesehen – bereit</Button>}
      </>
    );
  }

  if (s.phase === "vote" && s.vote) {
    const mine = s.vote.votes[me];
    const count = Object.keys(s.vote.votes).length;
    return (
      <>
        <Clock s={s} leader={isHost} act={act} talk={isHost && room.options.narrate !== false} />
        <Panel title={s.vote.final ? "Zeit ist um – wer ist der Spion?" : "Abstimmung"}
          sub={<>{s.vote.by ? `${nameOf(players, s.vote.by)} hat abstimmen lassen. ` : ""}{verdictHint(room.options)}</>}>
          {playing && <Picker ids={order.filter((id) => id !== me)} players={players} selected={mine && mine !== "?" ? [mine] : []} onPick={(id) => act({ type: "vote", target: id })} />}
        </Panel>
        <div className={cn("grid shrink-0 gap-2", !s.vote.final && (s.vote.by === me || isHost) && "grid-cols-[1fr_auto]")}>
          <p className="glass rounded-xl py-3 text-center text-muted-foreground" data-testid="vote-status">
            {count}/{order.length} abgestimmt
          </p>
          {!s.vote.final && (s.vote.by === me || isHost) && <Button size="lg" variant="secondary" onClick={() => act({ type: "cancelVote" })}>Abbrechen</Button>}
        </div>
      </>
    );
  }

  if (s.phase === "guess" && s.guess) {
    const mineGuess = s.guess.spy === me;
    return (
      <>
        <TopRow s={s} room={room}><b className="text-foreground">{nameOf(players, s.guess.spy)}</b> {s.guess.caught ? "ist enttarnt – letzte Chance" : "enttarnt sich und rät"}</TopRow>
        {mineGuess ? (
          <>
            <PlaceList s={s} mode="pick" picked={pick} onPick={setPick} />
            <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "guess", place: pick })}>{pick ? `Tipp: ${placeName(pick)}` : "Welcher Ort ist es?"}</Button>
          </>
        ) : (
          <>
            <Panel title={<span className="flex items-center gap-2"><VenetianMask className="size-6 text-destructive" />{nameOf(players, s.guess.spy)} ist Spion</span>}
              sub="Der Spion sucht sich jetzt den Ort aus der Liste aus …" />
            {playing && <SecretCard s={s} id={me} compact />}
          </>
        )}
      </>
    );
  }

  // Fragerunde
  const myAsk = s.asker === me;
  return (
    <>
      <Clock s={s} leader={isHost} act={act} talk={isHost && room.options.narrate !== false} />
      {playing && <SecretCard key={s.round} s={s} id={me} compact />}
      <Asker s={s} players={players}>
        {myAsk ? (
          <Chips list={order.filter((id) => id !== me)} players={players} label="Wen fragst du?" disabled={(id) => id === s.prevAsker && order.length > 2}
            onPick={(id) => act({ type: "ask", to: id })} />
        ) : playing && (s.prevAsker !== me || order.length <= 2) ? (
          <button type="button" className="mt-1.5 text-sm font-semibold text-ice" onClick={() => act({ type: "ask", to: me })}>Ich wurde gefragt – jetzt frage ich</button>
        ) : null}
      </Asker>
      <PlaceList s={s} mode={playing ? "cross" : "read"} />
      {playing && (
        <div className={cn("grid shrink-0 gap-2", spy && "grid-cols-2")}>
          <Button size="lg" variant={spy ? "secondary" : "default"} disabled={s.accusers.includes(me)} onClick={() => act({ type: "accuse" })}>
            <Vote />{s.accusers.includes(me) ? "Schon abgestimmt" : "Abstimmen"}
          </Button>
          {spy && <Button size="lg" onClick={() => act({ type: "reveal" })}><VenetianMask />Ort raten</Button>}
        </div>
      )}
    </>
  );
}

/* ───────────── Ende ───────────── */
