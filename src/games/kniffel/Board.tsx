import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  CATS, diceModeOf, extraRuleOf, isKniffel, LOWER, scoreFor, totals, UPPER, UPPER_BONUS, UPPER_BONUS_AT, winners,
  type Cat, type KniffelAction, type KniffelState,
} from "@shared/games/kniffel/logic";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { BoardProps } from "@/games/types";
import { Die } from "@/platform/Die";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, fmt, vibrate } from "@/lib/utils";

/** Die laufende Kniffel-Partie: Punkteleiste, Block, Würfel bzw. Eingabe – alles auf einem Bildschirm. */
export function Board({ room, game: s, me, online, isHost, canAct, mode, act, dispatch }: BoardProps<KniffelState, KniffelAction>) {
  const app = diceModeOf(room) === "app";
  const [picked, setPicked] = useState<string | null>(null);
  const [sel, setSel] = useState<Cat | null>(null);
  // Neuer Zug oder neuer Wurf: Auswahl zurücksetzen, wieder den Block des Spielers am Zug zeigen
  useEffect(() => { setPicked(null); setSel(null); }, [s.curId, s.log.length]);
  useEffect(() => { if (app) setSel(null); }, [s.n, app]);

  const ids = room.players.map((p) => p.id);
  const entries = room.players.map((p) => ({ id: p.id, name: p.name, score: totals(s, p.id).total }));

  if (s.finished) {
    const win = winners(s, ids).map((id) => room.players.find((p) => p.id === id)?.name ?? "?");
    const best = Math.max(...entries.map((e) => e.score));
    return (
      <ResultScreen winner={win.join(" & ")} subtitle={`mit ${fmt(best)} Punkten`} ranking={[...entries].sort((a, b) => b.score - a.score)} isHost={isHost} dispatch={dispatch}>
        <Button variant="secondary" onClick={() => act({ type: "undo" })}>Letzten Eintrag zurücknehmen</Button>
      </ResultScreen>
    );
  }

  const cur = room.players.find((p) => p.id === s.curId);
  const viewId = picked ?? s.curId ?? ids[0];
  const viewing = room.players.find((p) => p.id === viewId);
  const own = viewId === s.curId;
  const rolled = s.dice.length === 5;
  const sheet = s.sheets[viewId] ?? {};
  const joker = extraRuleOf(room) && (s.sheets[s.curId ?? ""]?.kniffel === 50) && rolled && isKniffel(s.dice);
  const potential = (c: Cat) => (app && own && rolled ? scoreFor(c, s.dice, joker) : null);
  const canPick = canAct && own && (!app || rolled);
  const t = totals(s, viewId);
  const full = mode === "full";

  const cell = (c: Cat) => {
    const filled = sheet[c];
    const pot = filled === undefined ? potential(c) : null;
    const active = sel === c;
    return (
      <button key={c} type="button" disabled={filled !== undefined || !canPick}
        onClick={() => { vibrate(6); setSel(active ? null : c); }}
        aria-pressed={active}
        className={cn(
          "flex min-h-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
          active ? "bg-gold text-navy-950" : filled !== undefined ? "bg-navy-950/40" : "bg-navy-700/60 ring-1 ring-inset ring-border",
        )}>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">{CATS[c].name}</span>
          {full && <span className={cn("block truncate text-[0.7rem]", active ? "text-navy-950/70" : "text-muted-foreground")}>{CATS[c].hint}</span>}
        </span>
        <span className={cn("shrink-0 text-base font-extrabold tabular-nums",
          filled === 0 && "text-muted-foreground",
          pot !== null && !active && (pot > 0 ? "text-navy-300" : "text-muted-foreground/60"))}>
          {filled !== undefined ? (filled === 0 ? "–" : filled) : pot ?? ""}
        </span>
      </button>
    );
  };

  return (
    <>
      <Scoreboard entries={entries} currentId={s.curId} me={me} online={online} selectedId={picked} onSelect={(id) => setPicked(id === s.curId ? null : id)} />

      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 px-1">
          <span className="truncate text-sm">
            <span className="text-muted-foreground">{own ? "Am Zug" : "Block von"} </span>
            <b className="text-base" data-testid="current-player">{viewId === me ? "Du" : viewing?.name}</b>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              Oben {t.upper}/{UPPER_BONUS_AT}{t.extra > 0 && ` · Extra +${t.extra}`}
            </span>
            <RulesSheet gameId={room.gameId} focus={sel ?? undefined} />
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5" data-testid="sheet">
          <div className="flex min-h-0 flex-col gap-1">
            {UPPER.map(cell)}
            <div className={cn("flex min-h-0 flex-1 items-center justify-between rounded-lg px-2.5 text-sm", t.bonus ? "bg-gold/15 text-gold" : "text-muted-foreground border border-dashed border-border")}>
              <span className="font-semibold">Bonus</span>
              <b className="tabular-nums">{t.bonus ? `+${UPPER_BONUS}` : `noch ${Math.max(0, UPPER_BONUS_AT - t.upper)}`}</b>
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-1">{LOWER.map(cell)}</div>
        </div>
      </div>

      <div className="shrink-0 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {!canAct ? (
          <div className="glass rounded-xl py-4 text-center text-muted-foreground">
            {room.entry === "host" ? <>Der Host spielt für <b className="text-foreground">{cur?.name}</b></> : <>Warte auf <b className="text-foreground">{cur?.name}</b></>}
            {app && rolled && <DiceRow s={s} disabled onHold={() => {}} />}
          </div>
        ) : app ? (
          <AppControls s={s} sel={sel} joker={joker} act={act} onPickSelf={() => setPicked(null)} own={own} />
        ) : (
          <RealControls key={sel ?? "none"} cat={sel} own={own} extraPossible={extraRuleOf(room) && s.sheets[s.curId ?? ""]?.kniffel === 50}
            onScore={(value, extra) => act({ type: "score", cat: sel!, value, extra })} onPickSelf={() => setPicked(null)} />
        )}
      </div>
    </>
  );
}

function DiceRow({ s, disabled, onHold }: { s: KniffelState; disabled: boolean; onHold: (i: number) => void }) {
  const rolled = s.dice.length === 5;
  return (
    <div className={cn("flex items-center justify-center gap-2", disabled && "mt-2.5")} key={s.n}>
      {rolled
        ? s.dice.map((v, i) => (
          <button key={i} type="button" disabled={disabled || s.rollsLeft === 0} aria-pressed={s.held[i]} aria-label={`Würfel ${v}${s.held[i] ? ", gehalten" : ""}`}
            onClick={() => { vibrate(6); onHold(i); }}
            className={cn("rounded-[22%] outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
              disabled ? "size-9" : "size-[min(15vw,3.4rem)]",
              s.held[i] ? "-translate-y-1 ring-[3px] ring-gold" : !disabled && "dice-in")}
            style={{ animationDelay: `${i * 40}ms` }}>
            <Die value={v} className="size-full drop-shadow-[0_4px_6px_rgba(0,0,0,.35)]" />
          </button>
        ))
        : Array.from({ length: 5 }, (_, i) => <span key={i} className="size-[min(15vw,3.4rem)] rounded-[22%] border-2 border-dashed border-border" />)}
    </div>
  );
}

function AppControls({ s, sel, joker, own, act, onPickSelf }: { s: KniffelState; sel: Cat | null; joker: boolean; own: boolean; act: (a: KniffelAction) => void; onPickSelf: () => void }) {
  const rolled = s.dice.length === 5;
  const pts = sel ? scoreFor(sel, s.dice, joker) : 0;
  const status = !rolled ? "Tippe auf „Würfeln“."
    : sel ? (pts ? `${CATS[sel].name}: ${pts} Punkte` : `${CATS[sel].name} streichen (0 Punkte)`)
    : s.rollsLeft === 0 ? "Keine Würfe mehr – wähle ein Feld."
    : "Würfel antippen zum Halten, oder ein Feld wählen.";

  if (!own) return <Button size="lg" className="w-full" onClick={onPickSelf}>Zurück zum eigenen Zug</Button>;
  return (
    <section className="glass rounded-2xl p-2.5">
      <DiceRow s={s} disabled={false} onHold={(i) => act({ type: "hold", i })} />
      <p className={cn("mt-2 min-h-5 text-center text-sm", joker ? "font-semibold text-gold" : "text-muted-foreground")}>
        {joker && !sel ? "Extra-Kniffel! +50 und Joker" : status}
      </p>
      <div className={cn("mt-2 grid gap-2.5", rolled && s.rollsLeft > 0 ? "grid-cols-2" : "grid-cols-1")}>
        {s.rollsLeft > 0 && (
          <Button size="lg" variant={sel ? "secondary" : "default"} onClick={() => { vibrate(15); act({ type: "roll" }); }} disabled={rolled && s.held.every(Boolean)}>
            🎲 Würfeln <span className="text-sm font-semibold opacity-75">({s.rollsLeft})</span>
          </Button>
        )}
        {rolled && (
          <Button size="lg" variant={sel ? "default" : "secondary"} disabled={!sel} onClick={() => sel && act({ type: "score", cat: sel })}>
            {sel ? (pts ? `+${pts} eintragen` : "Streichen") : "Feld wählen"}
          </Button>
        )}
      </div>
    </section>
  );
}

function RealControls({ cat, own, extraPossible, onScore, onPickSelf }: { cat: Cat | null; own: boolean; extraPossible: boolean; onScore: (value: number, extra: boolean) => void; onPickSelf: () => void }) {
  const info = cat ? CATS[cat] : null;
  const [value, setValue] = useState<number | null>(info?.fixed ? info.fixed : info?.face ? null : cat ? 20 : null);
  const [extra, setExtra] = useState(false);

  if (!own) return <Button size="lg" className="w-full" onClick={onPickSelf}>Zurück zum eigenen Zug</Button>;
  if (!cat || !info) {
    return (
      <div className="glass rounded-2xl px-4 py-5 text-center text-sm text-muted-foreground">
        Würfle am Tisch (bis zu dreimal) und tippe dann das Feld an, in das du einträgst.
      </div>
    );
  }

  const choice = (v: number, label: string, sub?: string) => (
    <button key={v} type="button" aria-pressed={value === v} onClick={() => setValue(v)}
      className={cn("h-12 rounded-xl font-bold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
        value === v ? "bg-gold text-navy-950" : "bg-navy-700/80 ring-1 ring-inset ring-border")}>
      <span className="block leading-tight">{label}</span>
      {sub && <span className={cn("block text-[0.7rem] font-semibold leading-tight", value === v ? "text-navy-950/70" : "text-muted-foreground")}>{sub}</span>}
    </button>
  );

  return (
    <section className="glass rounded-2xl p-2.5">
      <div className="mb-2 px-1 text-sm"><b>{info.name}</b> <span className="text-muted-foreground">– {info.face ? `Wie viele ${info.name}?` : info.fixed ? "Geschafft?" : "Summe aller Augen"}</span></div>
      {info.face ? (
        <div className="grid grid-cols-6 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((k) => choice(k * info.face!, k === 0 ? "–" : `${k}×`, k === 0 ? "0" : String(k * info.face!)))}
        </div>
      ) : info.fixed ? (
        <div className="grid grid-cols-2 gap-2">{choice(0, "Streichen")}{choice(info.fixed, `Geschafft +${info.fixed}`)}</div>
      ) : (
        <div className="flex items-center gap-2">
          {cat !== "chance" && <div className="w-24 shrink-0">{choice(0, "Streichen")}</div>}
          <Button variant="secondary" size="icon" aria-label="Weniger" onClick={() => setValue((v) => Math.max(5, (v || 20) - 1))}><Minus /></Button>
          <input type="range" min={5} max={30} value={value || 5} onChange={(e) => setValue(Number(e.target.value))} aria-label="Summe" className="min-w-0 flex-1 accent-[var(--gold)]" />
          <Button variant="secondary" size="icon" aria-label="Mehr" onClick={() => setValue((v) => Math.min(30, (v || 20) + 1))}><Plus /></Button>
          <b className="w-8 text-right text-xl tabular-nums">{value || "–"}</b>
        </div>
      )}
      {extraPossible && (
        <label className="mt-2 flex items-center gap-2.5 px-1 text-sm">
          <Checkbox checked={extra} onCheckedChange={(c) => setExtra(c === true)} />Das war ein weiterer Kniffel (+50)
        </label>
      )}
      <Button size="lg" className="mt-2.5 w-full" disabled={value === null} onClick={() => value !== null && onScore(value, extra)}>
        {value ? `${value} eintragen` : "Streichen"}
      </Button>
    </section>
  );
}
