import { Fish, Undo2 } from "lucide-react";
import { useState } from "react";
import { DECKS, RANK_PLURAL, type Rank } from "@shared/cards/deck";
import { askedGoesNext, leaders, openRanks, type FischenAction, type FischenState } from "@shared/games/fischen/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, vibrate } from "@/lib/utils";

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

/**
 * Fischen mit echten Karten: Gefragt wird am Tisch, die App führt nur mit, wer dran ist,
 * welche Quartette liegen und wer gewinnt.
 */
export function TableBoard({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<FischenState, FischenAction>) {
  const players = room.players;
  const [pick, setPick] = useState<Rank | null>(null);
  const [asking, setAsking] = useState(false);
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.quartets[p.id]?.length ?? 0 }));

  if (s.finished) {
    const win = leaders(s, players).map((id) => nameOf(players, id));
    const ranking = [...entries].sort((a, b) => b.score - a.score);
    return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${ranking[0]?.score ?? 0} Quartetten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Quartette" />;
  }

  const deck = DECKS[s.deck];
  const open = openRanks(s);
  const ownerOf = (r: Rank) => players.find((p) => s.quartets[p.id]?.includes(r))?.id ?? null;
  const cur = s.curId;
  const me2 = (id: string | null) => (id === me ? "Du" : nameOf(players, id));
  const lastLaid = s.laid?.at(-1);
  // Wer das Quartett bekommt: meist der Spieler am Zug, deshalb steht er vorn
  const owners = [...players].sort((a, b) => (a.id === cur ? -1 : b.id === cur ? 1 : 0));

  const lay = (owner: string) => {
    if (!pick) return;
    vibrate([20, 40, 20]);
    act({ type: "quartet", rank: pick, owner });
    setPick(null);
  };
  const fish = (target?: string) => {
    vibrate(10);
    act({ type: "fish", target });
    setAsking(false);
  };

  return (
    <>
      <Scoreboard entries={entries} currentId={cur} me={me} online={online} />

      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Am Zug</span>
          <span className="text-xl font-bold tracking-tight" data-testid="current-player">{me2(cur)}</span>
        </div>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 pb-2 text-sm leading-snug text-muted-foreground">
        {canAct ? "Frag am Tisch nach einem Wert, den du selbst hast. Hat keiner ihn: „Geh fischen“." : "Gefragt wird am Tisch – die App zählt die Quartette."}
      </p>

      {/* Alle Quartette: offene antippbar, gelegte mit Namen */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden">
        {canAct && <p className="mb-2 px-1 text-sm font-bold text-ice">Quartett gelegt? Wert antippen</p>}
        <div className={cn("grid w-full gap-x-1 gap-y-1.5", deck.ranks.length > 8 ? "grid-cols-7" : "grid-cols-4 px-4")} role="group" aria-label="Quartette">
          {deck.ranks.map((r) => {
            const owner = ownerOf(r);
            const chosen = pick === r;
            return (
              <button key={r} type="button" disabled={!canAct || !!owner} onClick={() => setPick(chosen ? null : r)} aria-pressed={chosen}
                aria-label={owner ? `${RANK_PLURAL[r]}: liegt bei ${nameOf(players, owner)}` : `Quartett ${RANK_PLURAL[r]} eintragen`}
                className={cn("flex min-w-0 flex-col items-center rounded-xl p-1 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                  chosen && "-translate-y-1 bg-ice/25 ring-2 ring-ice")}>
                <PlayingCard card={`${deck.suits[2]}-${r}`} dim={!!owner} className={cn("w-full", deck.ranks.length > 8 ? "max-w-[3.4rem]" : "max-w-[4.5rem]", owner && "opacity-40")} />
                <span className={cn("mt-0.5 h-4 max-w-full truncate text-[0.68rem] leading-4 font-semibold", owner ? "text-ice" : "text-transparent")}>
                  {owner ? me2(owner) : "·"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{open.length} von {deck.ranks.length} Quartetten noch im Spiel</p>
      </div>

      <div className="shrink-0 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {!canAct ? (
          <p className="glass rounded-xl py-4 text-center text-muted-foreground">Warte auf <b className="text-foreground">{nameOf(players, cur)}</b></p>
        ) : pick ? (
          <div className="glass rounded-2xl p-2.5">
            <p className="mb-2 text-center text-sm font-semibold">Wer hat das Quartett <b className="text-ice">{RANK_PLURAL[pick]}</b> gelegt?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {owners.map((p) => <Button key={p.id} variant={p.id === cur ? "default" : "secondary"} onClick={() => lay(p.id)}>{me2(p.id)}</Button>)}
            </div>
            <Button variant="ghost" className="mt-1 w-full text-muted-foreground" onClick={() => setPick(null)}>Abbrechen</Button>
          </div>
        ) : asking ? (
          <div className="glass rounded-2xl p-2.5">
            <p className="mb-2 text-center text-sm font-semibold">Wer hat „Geh fischen!“ gesagt? Der ist jetzt dran.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {players.filter((p) => p.id !== cur).map((p) => <Button key={p.id} variant="secondary" onClick={() => fish(p.id)}>{me2(p.id)}</Button>)}
            </div>
            <Button variant="ghost" className="mt-1 w-full text-muted-foreground" onClick={() => setAsking(false)}>Abbrechen</Button>
          </div>
        ) : (
          <div className={cn("grid gap-2", lastLaid ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
            {lastLaid && (
              <Button size="lg" variant="secondary" className="px-4" onClick={() => act({ type: "undo" })} aria-label={`Quartett ${RANK_PLURAL[lastLaid.rank]} zurücknehmen`}>
                <Undo2 />
              </Button>
            )}
            <Button size="lg" className="min-w-0" onClick={() => (askedGoesNext(room.options) && players.length > 2 ? setAsking(true) : fish())}><Fish />Geh fischen</Button>
          </div>
        )}
      </div>
    </>
  );
}
