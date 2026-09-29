import { canStop, CARD_BY_ID, MIN_TUTTO, NO_DICE_POINTS, stopAfterTutto, type CardId, type TuttoAction, type TuttoState } from "@shared/games/tutto/logic";
import { Confirm } from "@/components/Confirm";
import type { ViewMode } from "@/hooks/useViewMode";
import { cn, fmt, vibrate } from "@/lib/utils";

const KEYS = [50, 100, 200, 300, 400, 500, 600, 1000];

/** Was ein Tutto mit dieser Karte bringt – steht groß auf dem Knopf, darüber die Überschrift */
function tuttoLabel(card: CardId, tuttos: number): [string, string] {
  switch (card) {
    case "x2": return ["🎉 Tutto geschafft", "×2"];
    case "street": return ["Straße geschafft", "+2.000"];
    case "torte": return ["Torte geschafft", "+1.500"];
    case "pm": return ["🎉 Tutto geschafft", "±1.000"];
    case "clover": return ["🎉 Tutto geschafft", `${tuttos + 1} von 2`];
    default: return ["🎉 Tutto geschafft", `+${fmt(CARD_BY_ID[card].quick ?? 0)}`];
  }
}

/** Hinweis statt Tasten, wenn die Würfelpunkte mit dieser Karte nicht zählen */
const NO_PAD: Partial<Record<CardId, string>> = {
  street: "Würfle 1 bis 6 – Würfelpunkte zählen nicht.",
  pm: "Nur das Tutto zählt: +1.000, der Führende −1.000.",
  clover: "Zweimal Tutto ohne Niete – dann Sofort-Sieg.",
  torte: "Drilling + zwei Fünfen + eine Eins = 1.500.",
  stop: "Stopp – dieser Zug ist vorbei.",
};

/**
 * Echte Würfel: Würfelpunkte über kompakte Tasten eintippen. Kartenboni gibt es nur über „Tutto“ –
 * vorher lässt sich nichts gutschreiben.
 */
export function PointsPad({ state, onAction, disabled, mode }: { state: TuttoState; onAction: (a: TuttoAction) => void; disabled: boolean; mode: ViewMode }) {
  const card = state.turnCards[state.turnCards.length - 1];
  const safe = state.cardStart ?? 0;
  const open = !!card && !NO_DICE_POINTS.has(card) && !state.afterTutto;
  const add = (delta: number) => { vibrate(8); onAction({ type: "addPts", delta }); };
  const small = "rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border disabled:opacity-40";

  return (
    <section className="glass rounded-2xl p-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm text-muted-foreground">
          Punkte{safe > 0 && <span className="ml-1.5 text-xs">(sicher {fmt(safe)})</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {open && state.turnPts > safe && (
            <>
              <button type="button" disabled={disabled} onClick={() => add(-50)} className={small}>−50</button>
              <button type="button" disabled={disabled} onClick={() => onAction({ type: "clearPts" })} className={small}>Löschen</button>
            </>
          )}
          <b className="ml-1 text-2xl font-extrabold tracking-tight tabular-nums" data-testid="turn-pts">{fmt(state.turnPts)}</b>
        </div>
      </div>
      {open ? (
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {KEYS.map((v) => (
            <button key={v} type="button" disabled={disabled} onClick={() => add(v)}
              className={cn("rounded-xl bg-navy-700/80 font-bold ring-1 ring-inset ring-border outline-none transition active:scale-95 active:bg-navy-600 focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-40",
                mode === "simple" ? "h-12 text-lg" : "h-10 text-base")}>
              +{fmt(v)}
            </button>
          ))}
        </div>
      ) : (
        <p className="px-1 pt-1 pb-0.5 text-sm text-muted-foreground">
          {state.afterTutto ? "Tutto geschafft! Aufhören oder weiterzocken?" : card ? NO_PAD[card] : "Karte ziehen, dann würfeln."}
        </p>
      )}
    </section>
  );
}

/** Aktionsknöpfe für echte Würfel – je nach Karte nur das, was gerade erlaubt ist. */
export function RealActions({ state, onAction }: { state: TuttoState; onAction: (a: TuttoAction) => void }) {
  const card = state.turnCards[state.turnCards.length - 1];
  const pts = fmt(state.turnPts);
  const book = (zero = false) => onAction({ type: "book", zero });
  /** Knopf mit kleiner Überschrift und großem Wert – passt auch auf schmale Handys */
  const Btn = ({ children, sub, onClick, disabled, kind = "plain" }: { children: React.ReactNode; sub?: string; onClick?: () => void; disabled?: boolean; kind?: "primary" | "gold" | "plain" }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("disabled:opacity-40",
        "flex h-13 min-w-0 flex-col items-center justify-center rounded-xl px-1.5 leading-tight font-bold outline-none transition active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring",
        kind === "primary" ? "bg-gradient-to-b from-navy-400 to-primary text-white shadow-[0_6px_20px_rgb(63_122_224/0.35)]"
          : kind === "gold" ? "bg-gold text-navy-950 shadow-[0_6px_20px_rgb(214_176_92/0.3)]" : "bg-secondary ring-1 ring-inset ring-border",
      )}>
      {sub && <span className="max-w-full truncate text-[0.7rem] font-semibold opacity-80">{sub}</span>}
      <span className="max-w-full truncate text-base">{children}</span>
    </button>
  );
  const niete = state.turnPts > 0 ? (
    <Confirm title="Wirklich Niete?" description={`Die ${pts} Punkte dieses Zugs verfallen.`} confirmLabel="Niete" onConfirm={() => book(true)}>
      <Btn sub="Nichts gewertet">Niete</Btn>
    </Confirm>
  ) : <Btn sub="Nichts gewertet" onClick={() => book(true)}>Niete</Btn>;

  if (!card) return <div className="grid"><Btn kind="primary" onClick={() => onAction({ type: "draw" })}>Karte ziehen</Btn></div>;
  if (state.afterTutto) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Btn sub="Aufhören" kind="primary" onClick={() => book()}>{pts} eintragen</Btn>
        <Btn sub="Neue Karte – Risiko" onClick={() => onAction({ type: "draw" })}>🎲 Weiterzocken</Btn>
      </div>
    );
  }
  if (card === "stop") {
    return (
      <div className="grid">
        <Btn sub={stopAfterTutto(state) && state.turnPts > 0 ? `Stopp – ${pts} Punkte verfallen` : "Stopp – kein Wurf"} kind="primary" onClick={() => book(true)}>Nächster Spieler</Btn>
      </div>
    );
  }
  if (card === "fire") return <div className="grid"><Btn sub="Niete geworfen – Punkte zählen trotzdem" kind="primary" onClick={() => book()}>{pts} eintragen</Btn></div>;

  const tutto = () => { vibrate([20, 40, 20]); onAction({ type: "tutto" }); };
  // Tutto erst, wenn die Würfelpunkte dafür eingetragen sind (bei Straße, Plus/Minus, Kleeblatt, Torte zählen sie nicht)
  const tuttoReady = NO_DICE_POINTS.has(card) || state.turnPts - (state.cardStart ?? 0) >= MIN_TUTTO;
  const tuttoBtn = card === "clover" && (state.cardTuttos ?? 0) >= 1 ? (
    <Confirm title="Zweites Tutto geschafft?" description="Zweimal hintereinander Tutto – damit ist das Spiel sofort gewonnen." confirmLabel="Sieg!" onConfirm={tutto}>
      <Btn sub="☘ Tutto" kind="gold">2 von 2</Btn>
    </Confirm>
  ) : <Btn sub={tuttoLabel(card, state.cardTuttos ?? 0)[0]} kind="gold" disabled={!tuttoReady} onClick={tutto}>{tuttoLabel(card, state.cardTuttos ?? 0)[1]}</Btn>;
  const stop = canStop(state) && state.turnPts > 0;

  return (
    <div className={cn("grid gap-2", stop ? "grid-cols-[0.75fr_1.15fr_1fr]" : "grid-cols-2")}>
      {niete}
      {stop && <Btn sub="Aufhören, eintragen" kind="primary" onClick={() => book()}>{pts}</Btn>}
      {tuttoBtn}
    </div>
  );
}
