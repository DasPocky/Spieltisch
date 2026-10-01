import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import type { Options } from "@shared/platform/types";
import type { Step } from "@shared/games/werwolf/logic";
import { Button } from "@/components/ui/button";
import { cn, vibrate } from "@/lib/utils";
import { Timer, useCountdown } from "@/platform/Countdown";

export { Timer, useCountdown };
import { speak } from "./useSpeech";
import { tempoOf } from "@shared/games/werwolf/tempo";

/** Zeiten je Tempo (Vorgabe oder eigene) – liegt in shared, damit es testbar bleibt */
export { tempoOf } from "@shared/games/werwolf/tempo";

/** Schritte, bei denen nur jemand die Augen öffnet und schaut (keine Eingabe) */
export const INFO_STEPS: Step[] = ["lovers", "schwestern", "verzaubert"];
/** Schritte, nach denen die Rolle ein Ergebnis lesen muss */
export const RESULT_STEPS: Step[] = ["seherin", "fuchs"];

export function stepSeconds(step: Step, o: Options) {
  const t = tempoOf(o);
  if (step === "sleep") return 2;
  if (INFO_STEPS.includes(step)) return t.info;
  return step === "werwolf" ? t.wolves : t.role;
}

/**
 * Bestätigen durch kurzes Gedrückthalten – leise und sicher gegen Fehltipper, wenn das Handy in der Mitte liegt.
 * Tastatur (Enter/Leertaste) bestätigt sofort.
 */
export function HoldButton({ label, onDone, disabled, ms = 700 }: { label: string; onDone: () => void; disabled?: boolean; ms?: number }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { setHolding(false); if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const start = () => {
    if (disabled) return;
    setHolding(true);
    timer.current = setTimeout(() => { stop(); vibrate(15); onDone(); }, ms);
  };
  useEffect(() => stop, []);
  return (
    <button type="button" disabled={disabled} aria-label={label} data-testid="hold"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDone(); } }}
      className={cn("relative h-12 shrink-0 touch-none overflow-hidden rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50")}>
      <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${ms}ms linear` : "none" }} aria-hidden="true" />
      <span className="relative">{disabled ? label : `Gedrückt halten: ${label}`}</span>
    </button>
  );
}

/** Große Restzeit mit Hinweis kurz vor Schluss – nur Text, damit niemand hört, wo das Handy ist */
export function Clock({ left, total, note, paused, onPause, onSkip }: { left: number | null; total: number; note?: string; paused: boolean; onPause: () => void; onSkip?: () => void }) {
  const warn = left !== null && left <= 5 && !paused;
  return (
    <div className="flex shrink-0 items-center gap-3" data-testid="ww-clock">
      <div className="relative grid size-14 shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-navy-900" />
          {left !== null && <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={100}
            strokeDasharray={`${Math.min(100, (left / Math.max(1, total)) * 100)} 100`} className={cn("transition-[stroke-dasharray] duration-300", warn ? "text-destructive" : "text-ice")} />}
        </svg>
        <span className={cn("text-lg font-bold tabular-nums", warn && "text-destructive")} data-testid="ww-left">{left ?? "…"}</span>
      </div>
      <p className={cn("min-w-0 flex-1 text-sm leading-snug", warn ? "font-semibold text-destructive" : "text-muted-foreground")}>
        <span key={note} className="text-in inline-block">{paused ? "Angehalten." : note}</span>
      </p>
      <Button variant="secondary" size="icon" aria-label={paused ? "Weiterlaufen lassen" : "Anhalten"} onClick={onPause}>{paused ? <Play /> : <Pause />}</Button>
      {onSkip && <Button variant="ghost" size="icon" aria-label="Schritt überspringen" onClick={onSkip}><SkipForward /></Button>}
    </div>
  );
}

type Stage = "call" | "act" | "result" | "putdown" | "end";

/**
 * Ein Nachtschritt mit einem Handy in der Mitte – ohne dass jemand „Weiter“ tippen muss:
 * Aufruf vorlesen → Countdown (nur Text, damit niemand hört, wo das Handy ist) → Auswahl gedrückt halten
 * → ggf. Ergebnis lesen → Handy zurücklegen → `after` vorlesen → `onNext`.
 * `required`: Läuft die Zeit ohne Wahl ab, wird mit Meldung verlängert; sonst geht es einfach weiter.
 */
export function AutoRunner({ say, after, total, required, acted, result, onNext, confirm, children }: {
  say: string; after?: string; total: number; required: boolean; acted: boolean; result?: boolean; onNext: () => void;
  confirm?: { label: string; ok: boolean; run: () => void } | null; children: ReactNode;
}) {
  const [stage, setStage] = useState<Stage>("call");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [extended, setExtended] = useState(false);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const left = useCountdown(deadline, pausedLeft !== null);
  const ended = useRef(false);
  const go = (next: Stage, secs: number | null) => { setStage(next); setDeadline(secs === null ? null : Date.now() + secs * 1000); };

  useEffect(() => {
    let alive = true;
    void speak(say).then(() => { if (alive) go("act", total); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (acted && (stage === "act" || stage === "call")) go(result ? "result" : "putdown", result ? 6 : 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acted]);
  useEffect(() => {
    if (left !== 0 || pausedLeft !== null) return;
    if (stage === "act") {
      if (!required || acted) go("end", null);
      else { setExtended(true); setDeadline(Date.now() + 15_000); }
    } else if (stage === "result") go("putdown", 3);
    else if (stage === "putdown") go("end", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  useEffect(() => {
    if (stage !== "end" || ended.current) return;
    ended.current = true;
    void speak(after ?? "").then(onNext);
  }, [stage, after, onNext]);

  const pause = () => {
    if (pausedLeft !== null) { setDeadline(Date.now() + pausedLeft * 1000); setPausedLeft(null); }
    else setPausedLeft(left ?? 0);
  };
  const shown = pausedLeft ?? left;
  const note = stage === "call" ? "Hört zu …"
    : stage === "result" ? "Merk dir das Ergebnis."
    : stage === "putdown" ? "Handy zurück in die Mitte legen – gleich geht es weiter."
    : stage === "end" ? "…"
    : extended ? "Zeit verlängert – bitte jetzt wählen."
    : shown !== null && shown <= 5 && required ? `Achtung – noch ${shown} Sekunden.`
    : !required ? "Augen auf und aufs Handy schauen." : "Wählen und zum Bestätigen gedrückt halten.";
  const clockTotal = stage === "result" ? 6 : stage === "putdown" ? 3 : extended ? 15 : total;

  return (
    <>
      <Clock left={shown} total={clockTotal} note={note} paused={pausedLeft !== null} onPause={pause}
        onSkip={!required || acted ? () => { if (!ended.current) go("end", null); } : undefined} />
      {children}
      {confirm && !acted && <HoldButton label={confirm.label} disabled={!confirm.ok} onDone={confirm.run} />}
      {acted && result && stage === "result" && <Button size="lg" className="shrink-0" variant="secondary" onClick={() => go("putdown", 3)}>Gesehen</Button>}
    </>
  );
}

