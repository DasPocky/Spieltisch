import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, MapPin, MessageCircleQuestion, Pause, Timer as TimerIcon, VenetianMask } from "lucide-react";
import { deadlineOf, timeLeft, verdictOf, type SpionAction, type SpionState } from "@shared/games/spion/logic";
import { PLACE_BY_ID, placeName } from "@shared/games/spion/places";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { nameOf, Panel } from "@/games/werwolf/parts";
import { useCountdown } from "@/platform/Countdown";
import { useSpokenCountdown } from "@/platform/speech";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";
import type { BoardProps } from "@/games/types";

/** Bausteine für Gerät (ein Handy für alle) und eigenes Handy */
export type P = BoardProps<SpionState, SpionAction>;

export const ids = (s: SpionState) => Object.keys(s.scores);
export const names = (players: Player[], list: string[]) => list.map((id) => nameOf(players, id)).join(" & ");

/** Eigene Karte: Ort und Rolle – oder „Du bist der Spion“. Verdeckt, bis man sie antippt. */
export function SecretCard({ s, id, compact, startOpen = false }: { s: SpionState; id: string; compact?: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const spy = s.spies.includes(id);
  const role = s.roles[id];
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} data-testid="secret-card"
      aria-label={open ? "Karte verdecken" : "Karte ansehen"}
      className={cn("w-full shrink-0 rounded-2xl text-center outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
        compact ? "px-3 py-2" : "px-4 py-6",
        !open ? "card-back text-paper" : spy ? "bg-gradient-to-b from-deep-700 to-deep-950 text-white ring-1 ring-inset ring-destructive/50" : "bg-paper text-paper-ink")}>
      {!open ? (
        <span className="flex items-center justify-center gap-2 font-bold"><Eye className="size-5" />{compact ? "Karte ansehen" : "Tippen: Karte ansehen"}</span>
      ) : spy ? (
        <span className={cn("flex items-center gap-3", compact ? "justify-center" : "flex-col")}>
          <VenetianMask className={cn(compact ? "size-6" : "size-14", "text-destructive")} aria-hidden="true" />
          <span>
            <span className={cn("block font-bold tracking-tight", compact ? "text-lg" : "text-3xl")} data-testid="card-text">Du bist der Spion</span>
            {!compact && <span className="mt-1 block text-sm text-white/80">Finde den Ort heraus, ohne aufzufliegen.</span>}
          </span>
        </span>
      ) : (
        <span className={cn("flex items-center gap-3", compact ? "justify-center" : "flex-col")}>
          <MapPin className={cn(compact ? "size-6" : "size-14", "text-navy-600")} aria-hidden="true" />
          <span className="min-w-0">
            <span className={cn("block font-bold tracking-tight", compact ? "truncate text-lg" : "text-3xl")} data-testid="card-text">{placeName(s.place)}</span>
            {role && <span className={cn("block text-paper-ink/75", compact ? "truncate text-sm" : "mt-1 text-base")}>Du bist: <b>{role}</b></span>}
          </span>
        </span>
      )}
      {open && !compact && <span className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold opacity-60"><EyeOff className="size-3.5" />Tippen zum Verdecken</span>}
    </button>
  );
}

/** Restzeit der Runde – auf allen Handys gleich (Startzeit kommt vom Server). Ist sie um, meldet das Handy es. */
export function Clock({ s, leader, act, talk = false }: { s: SpionState; leader: boolean; act: P["act"]; talk?: boolean }) {
  const deadline = deadlineOf(s);
  const paused = s.pausedAt !== null;
  const ticking = useCountdown(paused ? null : deadline, false);
  const left = deadline === null ? null : paused ? Math.ceil((timeLeft(s, s.pausedAt!) ?? 0) / 1000) : ticking;
  useEffect(() => {
    if (s.phase !== "talk" || deadline === null || paused) return;
    // Das Leiter-Handy meldet sofort, die anderen etwas später – falls der Host gerade weg ist. Bei Uhr-Abweichung wird wiederholt.
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      act({ type: "timeUp" });
      iv = setInterval(() => act({ type: "timeUp" }), leader ? 2000 : 5000);
    }, Math.max(0, deadline - Date.now()) + (leader ? 300 : 3000));
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [s.phase, deadline, paused, leader, act]);
  useEffect(() => { if (left === 30 || left === 10) vibrate([30, 60, 30]); }, [left]);
  useSpokenCountdown(paused ? null : left, talk, s.minutes * 60);
  if (left === null) {
    return s.timeUp ? <div className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-destructive/15 px-3 py-1.5 text-sm font-semibold text-destructive" data-testid="clock">Zeit ist um</div> : null;
  }
  const warn = !paused && left <= 30;
  return (
    <div className={cn("flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-1.5 ring-1 ring-inset",
      warn ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-navy-950/40 text-muted-foreground ring-border")} data-testid="clock">
      <span className="flex items-center gap-1.5 text-sm">
        {paused ? <Pause className="size-4" aria-hidden="true" /> : <TimerIcon className="size-4" aria-hidden="true" />}
        {paused ? "Uhr angehalten" : `Runde ${s.round} von ${s.rounds}`}
      </span>
      <b className="text-xl tabular-nums text-foreground">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b>
    </div>
  );
}

/** Wer fragt gerade? Groß und farbig – darunter, wen er fragt */
export function Asker({ s, players, children }: { s: SpionState; players: Player[]; children?: ReactNode }) {
  return (
    <div className="shrink-0">
      <div className="turn flex items-center gap-2 rounded-xl px-3 py-2" data-testid="asker">
        <MessageCircleQuestion className="size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate text-lg font-bold"><SmoothText>{`${nameOf(players, s.asker)} fragt`}</SmoothText></span>
      </div>
      {children}
    </div>
  );
}

/** Namen als kleine Chips (wen fragt man?) */
export function Chips({ list, players, onPick, disabled, label }: { list: string[]; players: Player[]; onPick: (id: string) => void; disabled?: (id: string) => boolean; label: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {list.map((id) => (
        <button key={id} type="button" disabled={disabled?.(id)} onClick={() => { vibrate(10); onPick(id); }}
          className="rounded-full bg-navy-700/70 px-3 py-1 text-sm font-semibold ring-1 ring-inset ring-border outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-35">
          {nameOf(players, id)}
        </button>
      ))}
    </div>
  );
}

/** Alle möglichen Orte. Antippen streicht durch (nur auf diesem Handy) – oder wählt beim Raten. */
export function PlaceList({ s, mode, picked, onPick }: { s: SpionState; mode: "cross" | "read" | "pick"; picked?: string | null; onPick?: (id: string) => void }) {
  const [crossed, setCrossed] = useState<string[]>([]);
  // Neue Runde: alles wieder offen
  useEffect(() => setCrossed([]), [s.round]);
  const toggle = (id: string) => setCrossed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <section className="glass flex min-h-0 flex-1 flex-col rounded-2xl px-2.5 pt-2 pb-2.5">
      <h2 className="flex shrink-0 items-baseline justify-between gap-2 px-1 text-sm font-semibold">
        <span>Mögliche Orte <span className="font-normal text-muted-foreground">({s.pool.length})</span></span>
        <span className="truncate text-xs font-normal text-muted-foreground">{mode === "cross" ? "antippen: streichen" : mode === "pick" ? "antippen: wählen" : ""}</span>
      </h2>
      <div className="no-scrollbar mt-1.5 grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-1 overflow-y-auto" role="group" aria-label="Orte">
        {s.pool.map((id) => {
          const out = mode === "cross" && crossed.includes(id);
          const on = mode === "pick" && picked === id;
          return (
            <button key={id} type="button" disabled={mode === "read"} aria-pressed={mode === "read" ? undefined : out || on}
              onClick={() => (mode === "pick" ? onPick?.(id) : toggle(id))}
              className={cn("min-w-0 truncate rounded-lg px-2 py-1.5 text-left text-sm outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                on ? "bg-ice font-semibold text-navy-950" : out ? "text-muted-foreground/50 line-through decoration-2" : "bg-secondary/70")}>
              {PLACE_BY_ID[id]?.name ?? id}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export const verdictHint = (o: P["room"]["options"]) => (verdictOf(o) === "unanimous" ? "Verurteilt: wer alle anderen Stimmen bekommt." : "Verurteilt: wer mehr als die Hälfte der Stimmen bekommt.");

/** Auflösung einer Runde (zwischen den Runden und am Ende) */
export function RoundSummary({ s, players }: { s: SpionState; players: Player[] }) {
  const r = s.last;
  if (!r) return null;
  const spy = names(players, r.spies) || "?";
  const one = r.spies.length < 2;
  const reason: Record<typeof r.reason, string> = {
    guessRight: `${nameOf(players, r.spies[0])} hat den Ort erraten.`,
    guessWrong: `Falsch geraten: ${placeName(r.guessed)}.`,
    caught: `${nameOf(players, r.accused)} wurde verurteilt${r.guessed ? ` und hat falsch geraten (${placeName(r.guessed)})` : ""}.${r.by && !r.guessed ? ` Abstimmung von ${nameOf(players, r.by)}.` : ""}`,
    caughtGuess: `Enttarnt – aber mit der letzten Chance den Ort erraten.`,
    innocent: `${nameOf(players, r.accused)} wurde verurteilt – ist aber unschuldig.`,
    time: "Die Zeit ist um und niemand wurde verurteilt.",
  };
  return (
    <div className="grid gap-1 text-center" data-testid="round-summary">
      <p className={cn("text-2xl font-bold tracking-tight", r.winner === "spy" ? "text-destructive" : "text-ice")} data-testid="round-winner">
        {r.winner === "spy" ? (one ? "Der Spion gewinnt" : "Die Spione gewinnen") : (one ? "Spion enttarnt!" : "Spione enttarnt!")}
      </p>
      <p className="text-sm text-muted-foreground">{reason[r.reason]}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-left">
        <div className="rounded-xl bg-paper px-3 py-2 text-paper-ink ring-1 ring-inset ring-border"><div className="text-xs opacity-70">Ort</div><b data-testid="reveal-place">{placeName(r.place)}</b></div>
        <div className="rounded-xl bg-gradient-to-b from-deep-700 to-deep-950 px-3 py-2 text-white"><div className="text-xs opacity-70">{one ? "Spion" : "Spione"}</div><b className="block truncate" data-testid="reveal-spy">{spy}</b></div>
      </div>
    </div>
  );
}

/** Punkte nach der Runde: Gesamt und was dazukam */
export function Points({ s, players }: { s: SpionState; players: Player[] }) {
  const list = ids(s).slice().sort((a, b) => s.scores[b] - s.scores[a]);
  return (
    <ul className="grid gap-1" data-testid="points">
      {list.map((id) => {
        const plus = s.last?.points[id] ?? 0;
        return (
          <li key={id} className="glass flex items-center gap-2 rounded-xl px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(players, id)}{s.last?.spies.includes(id) && <VenetianMask className="ml-1.5 inline size-4 align-[-2px] text-destructive" aria-label="Spion" />}</span>
            {plus > 0 && <span className="text-sm font-semibold text-ice">+{plus}</span>}
            <b className="w-8 text-right tabular-nums">{s.scores[id]}</b>
          </li>
        );
      })}
    </ul>
  );
}

export function Reveal({ s, players, act }: { s: SpionState; players: Player[]; act: P["act"] }) {
  return (
    <>
      <Panel>
        <RoundSummary s={s} players={players} />
        <div className="mt-3"><Points s={s} players={players} /></div>
      </Panel>
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "nextRound" })}>Runde {s.round + 1} von {s.rounds} starten</Button>
    </>
  );
}

export function TopRow({ s, room, children }: { s: SpionState; room: P["room"]; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-1">
      <span className="text-sm text-muted-foreground">{children ?? `Runde ${s.round} von ${s.rounds}`}</span>
      <RulesSheet gameId={room.gameId} />
    </div>
  );
}

/* ───────────── Lokal: ein Handy für alle ───────────── */
