import { CARD_BY_ID, diceModeOf, score, targetOf, type TuttoAction, type TuttoState } from "@shared/games/tutto/logic";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, fmt } from "@/lib/utils";
import { DiceActions, DicePanel } from "./Dice";
import { GameCard } from "./GameCard";
import { PointsPad } from "./PointsPad";

/** Die laufende Tutto-Partie: Punkteleiste, Karte, Punkte-Eingabe oder App-Würfel – alles auf einem Bildschirm. */
export function Board({ room, game: state, me, online, isHost, canAct, mode, act, dispatch }: BoardProps<TuttoState, TuttoAction>) {
  const target = targetOf(room);
  const appDice = diceModeOf(room) === "app";
  const cur = room.players.find((p) => p.id === state.curId);
  const winner = state.winnerId ? room.players.find((p) => p.id === state.winnerId) : null;
  const entries = room.players.map((p) => ({ id: p.id, name: p.name, score: score(state, p.id), progress: score(state, p.id) / target }));

  if (winner) {
    return (
      <ResultScreen
        winner={winner.name}
        subtitle={state.cloverWin ? "mit dem Kleeblatt ☘" : `mit ${fmt(score(state, winner.id))} Punkten`}
        ranking={[...entries].sort((a, b) => b.score - a.score)}
        isHost={isHost}
        dispatch={dispatch}
      >
        <Button variant="secondary" onClick={() => act({ type: "undo" })}>Letzten Eintrag zurücknehmen</Button>
      </ResultScreen>
    );
  }

  const latest = state.turnCards[state.turnCards.length - 1];
  const d = state.dice;
  // Mit App-Würfel nur ziehen, wenn es gerade erlaubt ist – sonst würde ein versehentliches Antippen stören
  const canDraw = !appDice || !latest || (!!d && d.tutto && !d.bust && latest !== "fire" && latest !== "clover" && latest !== "stop");

  return (
    <>
      <Scoreboard entries={entries} currentId={state.curId} me={me} online={online} />

      {/* Mitte: Karte füllt den freien Platz, damit alles auf einen Bildschirm passt */}
      <div className="flex min-h-0 flex-1 flex-col items-center pt-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-sm text-muted-foreground">Am Zug</span>
          <span className="text-2xl font-extrabold tracking-tight" data-testid="current-player">{cur?.id === me ? "Du" : cur?.name}</span>
        </div>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center py-3">
          <GameCard cards={state.turnCards} onDraw={() => act({ type: "draw" })} disabled={!canAct || !canDraw} />
        </div>
        <TurnHint state={state} canAct={canAct} full={mode === "full"} appDice={appDice} gameId={room.gameId} />
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {appDice
          ? <DicePanel state={state} onAction={act} disabled={!canAct} />
          : <PointsPad state={state} onAction={act} disabled={!canAct} mode={mode} />}
        <div className="mt-2.5">
          {canAct && appDice ? (
            <DiceActions state={state} onAction={act} />
          ) : canAct ? (
            <div className="grid grid-cols-[1fr_1.7fr] gap-2.5">
              {state.turnPts > 0 ? (
                <Confirm title="Wirklich Niete?" description={`Die ${fmt(state.turnPts)} Punkte dieser Runde verfallen.`} confirmLabel="Niete" onConfirm={() => act({ type: "book", zero: true })}>
                  <Button variant="secondary" size="lg">Niete</Button>
                </Confirm>
              ) : (
                <Button variant="secondary" size="lg" onClick={() => act({ type: "book", zero: true })}>Niete</Button>
              )}
              <Button size="lg" onClick={() => act({ type: "book" })}>
                {state.turnPts > 0 ? `${fmt(state.turnPts)} eintragen` : "Weiter"}
              </Button>
            </div>
          ) : (
            <div className="glass rounded-xl py-4 text-center text-muted-foreground">
              {room.entry === "host" ? <>Der Host spielt für <b className="text-foreground">{cur?.name}</b></> : <>Warte auf <b className="text-foreground">{cur?.name}</b></>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TurnHint({ state, canAct, full, appDice, gameId }: { state: TuttoState; canAct: boolean; full: boolean; appDice: boolean; gameId: string }) {
  const latest = state.turnCards[state.turnCards.length - 1];
  const card = latest ? CARD_BY_ID[latest] : null;
  const idle = canAct ? "Karte antippen, dann würfeln." : "Gleich wird eine Karte gezogen.";
  return (
    <div className="mx-auto mb-3 flex w-full max-w-[40ch] shrink-0 items-start gap-2 px-2 text-sm leading-snug text-muted-foreground">
      <div className="min-w-0 flex-1 text-center">
        <p className={cn("min-h-[2lh]", full ? "line-clamp-3" : "line-clamp-2")}>
          {card ? card.rule : idle}
          {card && canAct && card.id !== "stop" && full && !appDice && " Tutto geschafft? Karte nochmal antippen."}
        </p>
        {full && state.turnCards.length > 1 && (
          <div className="no-scrollbar mt-1.5 flex justify-center gap-1.5 overflow-x-auto">
            {state.turnCards.map((id, i) => (
              <span key={i} className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: CARD_BY_ID[id].color, background: "rgb(253 253 251 / 0.92)" }}>
                {CARD_BY_ID[id].name}
              </span>
            ))}
          </div>
        )}
      </div>
      <RulesSheet gameId={gameId} focus={latest} />
    </div>
  );
}
