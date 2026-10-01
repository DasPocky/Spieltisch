import { useState } from "react";
import { CARD_BY_ID, diceModeOf, realCardsOf, KEEP_CARD, stopAfterTutto, score, targetOf, type CardId, type CardType, type TuttoAction, type TuttoState } from "@shared/games/tutto/logic";
import type { Options } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, fmt } from "@/lib/utils";
import { DiceActions, DicePanel } from "./Dice";
import { CardPicker } from "./CardPicker";
import { GameCard } from "./GameCard";
import { PointsPad, RealActions } from "./PointsPad";

/** Die laufende Tutto-Partie: Punkteleiste, Karte, Punkte-Eingabe oder App-Würfel – alles auf einem Bildschirm. */
export function Board({ room, game: state, me, online, isHost, hostTools, canAct, mode, act, dispatch }: BoardProps<TuttoState, TuttoAction>) {
  const target = targetOf(room);
  const appDice = diceModeOf(room) === "app";
  const cur = room.players.find((p) => p.id === state.curId);
  const winner = state.winnerId ? room.players.find((p) => p.id === state.winnerId) : null;
  const entries = room.players.map((p) => ({ id: p.id, name: p.name, score: score(state, p.id), progress: score(state, p.id) / target }));
  // Echte Karten: „Karte ziehen“ öffnet die Auswahl, welche Karte am Tisch gezogen wurde
  const [picking, setPicking] = useState(false);
  const realCards = realCardsOf(room);
  // Plus/Minus „Wählen“: vor dem Eintragen fragen, wer die 1.000 verliert
  const [victimFor, setVictimFor] = useState<TuttoAction | null>(null);
  const pmChoose = state.pmOn && room.options.pmMode === "choose" && !state.dice?.bust && !stopAfterTutto(state) && room.players.length > 1;
  const onAction = (a: TuttoAction) => {
    if (a.type === "draw" && realCards && !a.card) return setPicking(true);
    if (a.type === "book" && !a.zero && !a.victim && pmChoose) return setVictimFor(a);
    act(a);
  };
  // Feuerwerk oder Chance – je Karte gleich bleibend
  const typeOf = (id: CardId, _i?: number) => CARD_BY_ID[id];

  if (winner) {
    return (
      <ResultScreen
        winner={winner.name}
        subtitle={state.cloverWin ? "mit dem Kleeblatt" : `mit ${fmt(score(state, winner.id))} Punkten`}
        ranking={[...entries].sort((a, b) => b.score - a.score)}
        isHost={isHost}
        dispatch={dispatch}
      >
        {hostTools && <Button variant="secondary" onClick={() => act({ type: "undo" })}>Letzten Eintrag zurücknehmen</Button>}
      </ResultScreen>
    );
  }

  const latest = state.turnCards[state.turnCards.length - 1];
  const d = state.dice;
  // Mit App-Würfel nur ziehen, wenn es gerade erlaubt ist – sonst würde ein versehentliches Antippen stören
  const canDraw = !latest || latest === "chance" || (appDice ? !!d && d.tutto && !d.bust && latest !== "fire" && latest !== "clover" && latest !== "stop" : !!state.afterTutto);

  return (
    <>
      <Scoreboard entries={entries} currentId={state.curId} me={me} online={online} />

      {/* Mitte: Karte füllt den freien Platz, damit alles auf einen Bildschirm passt */}
      <div className="flex min-h-0 flex-1 flex-col items-center pt-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-sm text-muted-foreground">Am Zug</span>
          <span className="text-xl font-bold tracking-tight" data-testid="current-player">{cur?.id === me ? "Du" : cur?.name}</span>
        </div>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center py-2">
          <GameCard cards={state.turnCards} turn={state.log.length} onDraw={() => onAction({ type: "draw" })} disabled={!canAct || !canDraw} typeOf={(id) => typeOf(id)} />
        </div>
        <TurnHint state={state} canAct={canAct} full={mode === "full"} gameId={room.gameId} typeOf={typeOf} options={room.options} />
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {appDice
          ? <DicePanel state={state} onAction={onAction} disabled={!canAct} />
          : <PointsPad state={state} onAction={onAction} disabled={!canAct} mode={mode} />}
        <div className="mt-2">
          {canAct && appDice ? (
            <DiceActions state={state} onAction={onAction} />
          ) : canAct ? (
            <RealActions state={state} onAction={onAction} />
          ) : (
            <div className="glass rounded-xl py-4 text-center text-muted-foreground">
              {room.entry === "host" ? <>Der Host spielt für <b className="text-foreground">{cur?.name}</b></> : <>Warte auf <b className="text-foreground">{cur?.name}</b></>}
            </div>
          )}
        </div>
      </div>
      {picking && <CardPicker torte={room.options.torte === true} chance={Number(room.options.chance) > 0} onClose={() => setPicking(false)} onPick={(card) => { setPicking(false); act({ type: "draw", card }); }} />}
      {victimFor && (
        <div className="fixed inset-0 z-50 flex items-end bg-navy-950/60 backdrop-blur-sm" role="dialog" aria-label="Wer verliert 1.000 Punkte?" onClick={() => setVictimFor(null)}>
          <div className="glass mx-auto w-full max-w-md rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center font-semibold">Plus/Minus: Wer verliert 1.000 Punkte?</p>
            <div className="grid grid-cols-2 gap-2">
              {room.players.filter((p) => p.id !== state.curId).map((p) => (
                <Button key={p.id} variant="secondary" size="lg" className="flex-col gap-0" onClick={() => { const a = victimFor; setVictimFor(null); act({ ...(a as Extract<TuttoAction, { type: "book" }>), victim: p.id }); }}>
                  {p.name}<span className="text-xs font-normal text-muted-foreground tabular-nums">{fmt(score(state, p.id))}</span>
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => setVictimFor(null)}>Abbrechen</Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Plus/Minus-Regel passend zur Einstellung */
const PM_RULE: Record<string, string> = {
  choose: "Bei einem Tutto: 1.000 Punkte für dich – und du bestimmst, wer 1.000 verliert.",
  all: "Bei einem Tutto: 1.000 Punkte für dich, alle anderen verlieren je 1.000.",
  split: "Bei einem Tutto: 1.000 Punkte für dich, die anderen teilen sich −1.000.",
};
export const ruleOf = (card: CardType, options: Options) => (card.id === "pm" && typeof options.pmMode === "string" && PM_RULE[options.pmMode]) || card.rule;

function TurnHint({ state, canAct, full, gameId, typeOf, options }: { state: TuttoState; canAct: boolean; full: boolean; gameId: string; typeOf: (id: CardId, i?: number) => CardType; options: Options }) {
  const latest = state.turnCards[state.turnCards.length - 1];
  const card = latest ? typeOf(latest) : null;
  const idle = canAct ? "Karte antippen, dann würfeln." : "Gleich wird eine Karte gezogen.";
  // Gerade ein Tutto geschafft und die nächste Karte liegt schon offen
  const d = state.dice;
  const fresh = !!state.afterTutto || (!!d?.tutto && !!latest && !KEEP_CARD.has(latest));
  const lost = stopAfterTutto(state) && state.turnPts > 0;
  return (
    <div className="mx-auto mb-2 flex w-full max-w-[40ch] shrink-0 items-start gap-2 px-2 text-sm leading-snug text-muted-foreground">
      <div className="min-w-0 flex-1 text-center">
        <p key={fresh ? "fresh" : lost ? "lost" : `${latest ?? "idle"}-${state.turnCards.length}`} className={cn("text-in min-h-[2lh]", full ? "line-clamp-3" : "line-clamp-2")}>
          {fresh ? <b className="text-ice" data-testid="tutto-banner">Tutto! {fmt(state.turnPts)} Punkte – aufhören oder weiterzocken? Bei Stopp oder Niete ist alles weg.</b>
            : lost ? <b className="text-destructive" data-testid="stop-lost">Stopp nach dem Tutto – die {fmt(state.turnPts)} Punkte verfallen.</b>
            : card ? ruleOf(card, options) : idle}
          {(state.chances ?? 0) > 0 && latest !== "chance" && <span className="ml-1 font-semibold text-primary" data-testid="chances">· {state.chances === 1 ? "1 Chance" : `${state.chances} Chancen`} übrig</span>}
        </p>
        {full && state.turnCards.length > 1 && (
          <div className="no-scrollbar mt-1.5 flex justify-center gap-1.5 overflow-x-auto">
            {state.turnCards.map((id, i) => (
              <span key={i} className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: typeOf(id, i).color, background: "rgb(253 253 251 / 0.92)" }}>
                {typeOf(id, i).name}
              </span>
            ))}
          </div>
        )}
      </div>
      <RulesSheet gameId={gameId} focus={latest} />
    </div>
  );
}
