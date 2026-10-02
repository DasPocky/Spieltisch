import { Dices } from "lucide-react";
import { MUST_PLAY, pmDone, stopAfterTutto, NO_DICE_POINTS, scoringDice, selectionValue, type TuttoAction, type TuttoState } from "@shared/games/tutto/logic";
import { Die } from "@/platform/Die";
import { useHints } from "@/lib/prefs";
import { cn, fmt, vibrate } from "@/lib/utils";

/** App-Würfel: aktueller Wurf zum Antippen, beiseitegelegte Würfel und Status. */
export function DicePanel({ state, onAction, disabled }: { state: TuttoState; onAction: (a: TuttoAction) => void; disabled: boolean }) {
  const d = state.dice;
  const card = state.turnCards[state.turnCards.length - 1];
  const sel = d && d.roll.length && !d.bust ? selectionValue(d, card) : null;
  const scoresHere = !!card && !NO_DICE_POINTS.has(card);
  // Spielhilfe: wertbare Würfel bekommen einen leisen Ring, dazu die beste mögliche Auswahl
  const hints = useHints();
  const help = hints && !disabled && d && d.roll.length && !d.bust && !d.tutto ? scoringDice(d.roll, card, d.aside) : null;

  let status: string;
  if (!card) status = "Zieh zuerst eine Karte.";
  else if (card === "stop") status = stopAfterTutto(state) && state.turnPts > 0 ? "Stopp nach dem Tutto – alle Punkte sind weg." : "Stopp – dieser Zug ist vorbei.";
  else if (!d || (!d.roll.length && !d.tutto)) status = "Tippe auf „Würfeln“.";
  else if (d.bust) status = card === "fire" ? "Niete – deine Punkte zählen trotzdem." : "Niete! Keine wertbaren Würfel.";
  else if (d.tutto) status = card === "clover" ? "Erstes Tutto! Noch eins zum Sieg." : card === "fire" ? "Tutto! Weiter mit allen Würfeln." : pmDone(state) ? "Tutto! +1.000 – Zug vorbei." : "Tutto! Aufhören oder weiterzocken?";
  else if (card === "fire") status = `Feuerwerk: alle wertbaren Würfel raus${sel ? ` – +${fmt(sel)}` : ""}.`;
  else if (!d.sel.some(Boolean)) status = help?.best && scoresHere ? `Bis zu +${fmt(help.best)} – tippe die Würfel an.` : "Tippe die Würfel an, die du behalten willst.";
  else if (sel === null) status = card === "street" ? "Nur Zahlen, die dir noch fehlen." : card === "torte" ? "Nur Würfel, die in die Torte passen." : "Nur 1, 5 oder drei Gleiche zählen.";
  else status = scoresHere ? `Auswahl: +${fmt(sel)}` : "Gute Auswahl.";

  return (
    <section className="glass rounded-2xl p-2.5">
      <div className="flex items-center justify-between px-1.5">
        <span className="text-sm text-muted-foreground">Punkte dieser Runde</span>
        <b className="text-3xl font-bold tracking-tight tabular-nums">
          <span className={cn(d?.bust && card !== "fire" && "text-muted-foreground line-through decoration-destructive decoration-[3px]")}>{fmt(state.turnPts)}</span>
          {sel !== null && sel > 0 && scoresHere && <span className="ml-1.5 text-lg text-navy-300">+{fmt(sel)}</span>}
        </b>
      </div>

      <div className="mt-2 flex min-h-[3.25rem] items-center justify-center gap-2" key={d?.n}>
        {d?.roll.map((v, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled || d.bust}
            aria-pressed={d.sel[i]}
            onClick={() => { vibrate(6); onAction({ type: "toggleDie", i }); }}
            className={cn(
              // Auswahl zeichnet der Würfel selbst (blaue Kante) – keine Verschiebung: Animation und Verschieben am selben Element zeigt Safari falsch an
              "relative size-[min(13vw,3.25rem)] rounded-[22%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              d.bust && "opacity-50 grayscale",
            )}
          >
            <span className="dice-in block size-full" style={{ animationDelay: `${i * 40}ms` }}><Die value={v} className="size-full" mark={d.sel[i] ? "selected" : help?.dice[i] ? "hint" : undefined} /></span>
          </button>
        ))}
        {(!d || !d.roll.length) && <span className="text-sm text-muted-foreground">{d?.tutto ? "Tutto!" : "–"}</span>}
      </div>

      <div className="mt-2 flex min-h-6 items-center justify-between gap-3 px-1.5">
        <span className={cn("text-sm", d?.bust ? "font-semibold text-destructive" : d?.tutto ? "font-semibold text-ice" : "text-muted-foreground")}>{status}</span>
        {d && d.aside.length > 0 && (
          <span className="flex shrink-0 items-center gap-1" aria-label="Beiseitegelegt">
            {d.aside.map((v, i) => <Die key={i} value={v} className="size-5 opacity-70" />)}
          </span>
        )}
      </div>
    </section>
  );
}

/** Aktionsknöpfe für den App-Würfel, je nach Stand des Zugs. */
export function DiceActions({ state, onAction }: { state: TuttoState; onAction: (a: TuttoAction) => void }) {
  const d = state.dice;
  const card = state.turnCards[state.turnCards.length - 1];
  const pts = fmt(state.turnPts);
  const roll = () => { vibrate(15); onAction({ type: "roll" }); };
  const book = (zero = false) => onAction({ type: "book", zero });
  const Btn = ({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "h-14 whitespace-nowrap rounded-xl px-3 text-base font-bold outline-none transition active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-40",
        primary ? "bg-primary text-white shadow-[0_2px_8px_rgb(42_92_191/0.22)]" : "bg-secondary ring-1 ring-inset ring-border",
      )}>
      {children}
    </button>
  );

  if (!card) return <div className="grid"><Btn primary onClick={() => onAction({ type: "draw" })}>Karte ziehen</Btn></div>;
  if (card === "chance") return <div className="grid"><Btn primary onClick={() => onAction({ type: "draw" })}>Chance! Nächste Karte ziehen</Btn></div>;
  if (card === "stop") return <div className="grid"><Btn primary onClick={() => book(true)}>Stopp – nächster Spieler</Btn></div>;
  if (!d || (!d.roll.length && !d.tutto)) return <div className="grid"><Btn primary onClick={roll}><Dices className="mr-1.5 inline size-5 align-[-4px]" />Würfeln</Btn></div>;
  const chances = state.chances ?? 0;
  if (d.bust && chances > 0) {
    // Chance: dieselben Würfel nochmal – oder freiwillig aufgeben
    return (
      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
        <Btn primary onClick={() => { vibrate(15); onAction({ type: "useChance" }); }}>Chance nutzen{chances > 1 ? ` (${chances})` : ""}</Btn>
        {card === "fire" ? <Btn onClick={() => book()}>{pts} eintragen</Btn> : <Btn onClick={() => book(true)}>Aufgeben</Btn>}
      </div>
    );
  }
  if (d.bust) {
    return <div className="grid">{card === "fire"
      ? <Btn primary onClick={() => book()}>{pts} eintragen</Btn>
      : <Btn primary onClick={() => book(true)}>Niete – nächster Spieler</Btn>}</div>;
  }
  if (d.tutto) {
    if (card === "fire" || card === "clover") return <div className="grid"><Btn primary onClick={roll}><Dices className="mr-1.5 inline size-5 align-[-4px]" />Weiter würfeln</Btn></div>;
    // Plus/Minus: nur eintragen, weiterzocken geht nicht
    if (pmDone(state)) return <div className="grid"><Btn primary onClick={() => book()}>+{pts} eintragen – Zug vorbei</Btn></div>;
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <Btn primary onClick={() => book()}>Aufhören: {pts}</Btn>
        <Btn onClick={() => onAction({ type: "draw" })}>Weiterzocken</Btn>
      </div>
    );
  }
  const v = selectionValue(d, card);
  const completes = v !== null && d.sel.every(Boolean);
  const canStop = !MUST_PLAY.has(card) && v !== null;
  return (
    <div className={cn("grid gap-2.5", canStop && !completes ? "grid-cols-[1.2fr_1fr]" : "grid-cols-1")}>
      <Btn primary disabled={v === null} onClick={roll}>{completes ? "Tutto!" : "Weiter würfeln"}</Btn>
      {canStop && !completes && <Btn onClick={() => book()}>{fmt(state.turnPts + (v ?? 0))} eintragen</Btn>}
    </div>
  );
}

