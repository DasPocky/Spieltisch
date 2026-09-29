import { DECKS, RANK_PLURAL } from "@shared/cards/deck";
import { fischen, type FischenAction, type FischenState } from "@shared/games/fischen/logic";
import type { GameUI } from "@/games/types";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { Board } from "./Board";

/** Symbol: Fisch mit Karte */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="20" y="5" width="14" height="20" rx="2.5" fill="#fdfdfb" transform="rotate(12 27 15)" />
      <path d="M26 11 C 23.5 9, 22.5 11.5, 26 14.5 C 29.5 11.5, 28.5 9, 26 11 Z" fill="#b8323f" transform="rotate(12 27 15)" />
      <path d="M5 25 C 10 17, 20 17, 25 25 C 20 33, 10 33, 5 25 Z" fill="#86aee8" />
      <path d="M25 25 L 33 19 L 33 31 Z" fill="#86aee8" />
      <circle cx="11" cy="23.5" r="1.6" fill="#0a1730" />
    </svg>
  );
}

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Sammle Quartette – alle vier Karten eines Werts. Wer am Ende die meisten hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold">So geht's</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Gespielt wird mit 52 Karten (13 Quartette) oder – einstellbar – mit 32 Karten, französisch oder deutsch. Jeder bekommt 7 Karten (ab 4 Spielern 5), der Rest ist der Teich.</li>
          <li>Wer dran ist, tippt oben einen Mitspieler an und unten einen Stapel aus der eigenen Hand: „Ben, hast du Könige?“ – <b className="text-foreground">man kann nur nach Werten fragen, die man selbst auf der Hand hat.</b></li>
          <li>Hat Ben Könige, muss er <b className="text-foreground">alle</b> abgeben, und du darfst weiterfragen.</li>
          <li>Hat er keine, heißt es <b className="text-foreground">„Geh fischen!“</b>: Du ziehst eine Karte aus dem Teich. Ist es genau der gefragte Wert, bist du nochmal dran (Einstellung), sonst der Nächste.</li>
          <li>Vier Gleiche werden sofort als Quartett abgelegt. Wer keine Karten mehr hat, zieht zu Beginn seines Zugs eine aus dem Teich.</li>
        </ol>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Alle Fragen sind öffentlich – merk dir, wer wonach gefragt hat!</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Die Quartette (52 Karten)</h3>
      <div className="grid grid-cols-5 gap-2">
        {DECKS.fr52.ranks.map((r) => (
          <div key={r} className="text-center text-xs text-muted-foreground">
            <PlayingCard card={`herz-${r}`} className="mx-auto w-11" />
            <div className="mt-1">{RANK_PLURAL[r]}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export const fischenUI: GameUI<FischenState, FischenAction> = { logic: fischen, Icon, Board, Rules };
