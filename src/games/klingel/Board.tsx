import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import {
  active, cardsOf, FRUIT_NAME, standings, topOf,
  type KlAction, type KlState, type RingEvent,
} from "@shared/games/klingel/logic";
import { levelOf, ringPlan } from "@shared/games/klingel/bot";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { playSound } from "@/platform/sound";
import { speak } from "@/platform/speech";
import { cn, vibrate } from "@/lib/utils";
import { BellShape, CardBack, EmptySlot, FruitCard } from "./Fruit";
import { narration } from "./narration";

type Props = BoardProps<KlState, KlAction>;
const nameIn = (players: Player[], s: KlState, id: string | null | undefined) => (id && (s.names[id] ?? players.find((p) => p.id === id)?.name)) || "?";
const karten = (n: number) => (n === 1 ? "1 Karte" : `${n} Karten`);

export function Board(props: Props) {
  useNarration(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return props.me === null ? <Local {...props} /> : <Online {...props} />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<KlState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, s, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const ranking = standings(s).map((r) => ({ id: r.id, name: nameIn(room.players, s, r.id), score: r.cards, place: r.place, ...(r.out ? { text: "raus" } : {}) }));
  const win = s.winners.map((id) => nameIn(room.players, s, id)).join(" & ");
  const subtitle = s.timeUp ? "Zeit um – die meisten Karten gewinnen" : s.winners.length === 1 ? `hat alle ${cardsOf(s, s.winners[0])} Karten` : "Partie beendet";
  return <ResultScreen winner={win || "Niemand"} subtitle={subtitle} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Karten" />;
}

/**
 * Zeitpunkte am Handy: Der Server rechnet in seiner Uhr, das Handy ab dem Empfang des Stands (`at` = Zeitpunkt
 * der Änderung) – so spielt eine falsch gehende Handy-Uhr keine Rolle.
 */
function useLocalClock(s: KlState) {
  const recv = useRef({ at: s.at, wall: Date.now() });
  if (recv.current.at !== s.at) recv.current = { at: s.at, wall: Date.now() };
  return (serverTime: number) => recv.current.wall + (serverTime - recv.current.at);
}

/** Fällige Zeiten auslösen (Sammelfenster, Takt, Wartezeit, Zeitlimit). `lead`: dieses Gerät zuerst, sonst etwas später als Rückfall. */
function useTicks(s: KlState, act: (a: KlAction) => void, toLocal: (t: number) => number, lead: boolean) {
  const due = s.phase !== "play" ? null : s.ring ? s.ring.until : Math.min(s.nextAt ?? Infinity, s.limitAt ?? Infinity);
  useEffect(() => {
    if (due === null || !Number.isFinite(due)) return;
    const wait = Math.max(0, toLocal(due) - Date.now()) + (lead ? 40 : 1200) + (s.ring ? 20 : 0);
    let again: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { act({ type: "tick" }); again = setInterval(() => act({ type: "tick" }), 2000); }, wait);
    return () => { clearTimeout(t); if (again) clearInterval(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due, s.at, lead]);
}

/** Wann wurde diese Lage am Handy sichtbar? Für die eigene Reaktionszeit. */
function useShownSince(seq: number) {
  const since = useRef({ seq, t: performance.now() });
  useLayoutEffect(() => {
    if (since.current.seq !== seq) since.current = { seq, t: performance.now() };
  }, [seq]);
  return since;
}

/** Neue Klingel-Meldung kurz einblenden */
function useFlash(last: RingEvent | null, ms = 2200): RingEvent | null {
  const [shown, setShown] = useState<RingEvent | null>(null);
  const seen = useRef(last?.n ?? 0);
  useEffect(() => {
    if (!last || last.n === seen.current) return;
    seen.current = last.n;
    setShown(last);
    const t = setTimeout(() => setShown(null), ms);
    return () => { clearTimeout(t); };
  }, [last, ms]);
  return shown;
}

function flashText(e: RingEvent, who: (id: string) => string): { title: string; sub: string } {
  if (e.ok) {
    const fruit = e.fruit ? `Fünf ${FRUIT_NAME[e.fruit].many}` : "Richtig";
    return { title: `${who(e.by)} ${who(e.by) === "Du" ? "warst" : "war"} am schnellsten!`, sub: `${fruit} · +${karten(e.cards)}${e.rt ? ` · ${(e.rt / 1000).toFixed(2).replace(".", ",")} s` : ""}` };
  }
  return { title: `${who(e.by)} ${who(e.by) === "Du" ? "hast" : "hat"} falsch geklingelt`, sub: `gibt ${e.cards === 1 ? "eine Karte" : karten(e.cards)} ab` };
}

function Flash({ e, who }: { e: RingEvent; who: (id: string) => string }) {
  const t = flashText(e, who);
  const out = e.out?.length ? ` · ${e.out.map(who).join(", ")} raus` : "";
  return (
    <div className={cn("pop pointer-events-none absolute inset-x-2 top-1/2 z-20 -translate-y-1/2 rounded-2xl px-4 py-3 text-center shadow-xl", e.ok ? "bg-[#3f9a4a] text-white" : "bg-[#c2492e] text-white")}
      role="status" data-testid="ring-flash" data-ok={e.ok}>
      <div className="text-lg leading-tight font-bold">{t.title}</div>
      <div className="text-sm opacity-90">{t.sub}{out}</div>
    </div>
  );
}

/** Online: eigene Karte unten, die offenen Karten aller in der Mitte, große Klingel */
function Online({ room, game: s, me, online, canAct, act, isHost }: Props) {
  const players = room.players;
  const who = (id: string | null | undefined) => (id === me ? "Du" : nameIn(players, s, id));
  const toLocal = useLocalClock(s);
  const mine = !!me && active(s).includes(me);
  const lead = !!me && (me === s.curId || isHost || !!s.ring?.claims.some((c) => c.id === me));
  useTicks(s, act, toLocal, lead);
  const since = useShownSince(s.seq);
  const [rang, setRang] = useState<number | null>(null);
  const flash = useFlash(s.last);
  const late = useLate(s, me, rang);
  const ids = s.order.filter((id) => !s.left.includes(id));
  const cols = ids.length <= 4 ? "grid-cols-2" : "grid-cols-3";
  const myTurn = canAct && s.curId === me && !s.ring;

  const ring = () => {
    if (!mine || rang === s.seq) return;
    const rt = Math.round(performance.now() - since.current.t);
    setRang(s.seq);
    vibrate(25);
    playSound("bell");
    act({ type: "ring", seq: s.seq, rt });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-sm" data-testid="kl-status">
          {s.ring ? <b>Klingel!</b> : s.curId === me ? <b>Du deckst auf</b> : <><b>{who(s.curId)}</b> <span className="text-muted-foreground">deckt auf</span></>}
          {s.auto && <span className="text-muted-foreground"> · im Takt</span>}
        </span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <div className={cn("grid min-h-0 flex-1 gap-1.5", cols)} style={{ gridAutoRows: "minmax(0, 1fr)" }} data-testid="kl-tiles">
        {ids.map((id, i) => (
          <Tile key={id} s={s} id={id} name={who(id)} me={id === me} away={!!online && !online.has(id)} wide={ids.length === 3 && i === 2}
            hit={flash?.by === id ? (flash.ok ? "ok" : "bad") : null} />
        ))}
      </div>
      {flash && <Flash e={flash} who={who} />}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex w-[30%] flex-col items-center gap-1">
          <Button variant={myTurn ? "default" : "secondary"} className="h-auto w-full flex-col gap-0.5 py-2" disabled={!myTurn} onClick={() => { vibrate(8); act({ type: "flip" }); }} data-testid="kl-flip"
            aria-label={myTurn ? "Karte aufdecken" : "Aufdecken – du bist nicht dran"}>
            <Layers className="size-5" /><span className="text-sm leading-tight">Aufdecken</span>
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums" data-testid="kl-mine">{me ? `${s.stock[me]?.length ?? 0} verdeckt` : ""}</span>
        </div>
        <button type="button" onPointerDown={(e) => { e.preventDefault(); ring(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ring(); } }}
          disabled={!mine} aria-label="Klingeln" data-testid="kl-bell"
          className={cn("bell-btn relative grid flex-1 touch-none place-items-center rounded-3xl bg-paper py-1.5 shadow-lg ring-1 ring-black/5 outline-none select-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-40",
            rang === s.seq && "bell-hit")}>
          <BellShape className="h-[min(22vh,8.5rem)] w-auto" down={rang === s.seq} />
          <span className="text-sm font-bold text-paper-ink">{late ? "Zu spät!" : rang === s.seq ? (s.ring ? "Geklingelt …" : "Geklingelt") : "Klingeln"}</span>
        </button>
      </div>
    </div>
  );
}

/** Habe ich geklingelt, aber die Lage war schon weiter (jemand anders war schneller)? */
function useLate(s: KlState, me: string | null, rang: number | null): boolean {
  const [late, setLate] = useState(false);
  const prevSeq = useRef(s.seq);
  useEffect(() => {
    if (prevSeq.current === s.seq) return;
    const was = prevSeq.current;
    prevSeq.current = s.seq;
    if (rang !== was || !me) { setLate(false); return; }
    const e = s.last;
    const mineEvent = !!e && (e.by === me || e.also?.includes(me));
    if (mineEvent) { setLate(false); return; }
    setLate(true);
    const t = setTimeout(() => setLate(false), 1500);
    return () => { clearTimeout(t); };
  }, [s.seq, s.last, me, rang]);
  return late;
}

function Tile({ s, id, name, me, away, hit, wide }: { s: KlState; id: string; name: string; me: boolean; away: boolean; hit: "ok" | "bad" | null; wide?: boolean }) {
  const top = topOf(s, id);
  const out = s.out.includes(id);
  const cur = s.curId === id && s.phase === "play";
  return (
    <div className={cn("glass flex min-h-0 flex-col items-center gap-1 rounded-2xl p-1.5 transition", wide && "col-span-2", cur && "ring-2 ring-primary", out && "opacity-45", away && "opacity-60",
      hit === "ok" && "bg-[#3f9a4a]/25", hit === "bad" && "bg-[#c2492e]/25")} data-testid={`kl-tile-${name}`} data-cur={cur}>
      <div className="flex w-full min-w-0 shrink-0 items-baseline justify-between gap-1 px-0.5 text-xs">
        <b className={cn("min-w-0 truncate text-sm", me && "text-primary")}>{name}</b>
        <span className="shrink-0 tabular-nums text-muted-foreground" aria-label={karten(cardsOf(s, id))}>{out ? "raus" : cardsOf(s, id)}</span>
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        {top ? <FruitCard key={`${top}-${s.open[id]?.length}`} card={top} className="card-flip h-full max-h-full w-auto max-w-full" />
          : <EmptySlot className="h-full max-h-full w-auto max-w-full text-muted-foreground" />}
      </div>
    </div>
  );
}

/**
 * Ein Handy für alle: jeder hat eine Zone am Rand (oben stehen sie auf dem Kopf, für die gegenüber), dort liegt seine
 * offene Karte und – wenn er dran ist – sein Stapel zum Aufdecken. Klingeln: in die eigene Zone tippen oder auf die große
 * Klingel in der Mitte (zählt für die nächste Zone). Mehrere Finger gleichzeitig gehen.
 */
function Local({ room, game: s, act }: Props) {
  const players = room.players;
  const who = (id: string | null | undefined) => nameIn(players, s, id);
  const ids = s.order.filter((id) => !s.left.includes(id));
  const nTop = Math.floor(ids.length / 2);
  const bottom = ids.slice(0, ids.length - nTop);
  // gegenüber: im Uhrzeigersinn weiter, von rechts nach links (auf dem Kopf stehend also wieder von links)
  const top = ids.slice(ids.length - nTop).reverse();
  const flash = useFlash(s.last);
  const zones = useRef<Map<string, HTMLDivElement>>(new Map());
  const [rang, setRang] = useState<Record<string, number>>({});
  const since = useShownSince(s.seq);
  useTicks(s, act, (t) => t, true);
  useLocalBots(room.bots ?? [], room.botLevels, s, act);

  const ring = (id: string) => {
    if (!active(s).includes(id) || rang[id] === s.seq) return;
    setRang((r) => ({ ...r, [id]: s.seq }));
    vibrate(25);
    playSound("bell");
    act({ type: "ring", seq: s.seq, rt: Math.round(performance.now() - since.current.t), player: id });
  };
  /** Klingel in der Mitte: wer am nächsten sitzt */
  const ringAt = (x: number, y: number) => {
    let best: string | null = null, d = Infinity;
    for (const [id, el] of zones.current) {
      const r = el.getBoundingClientRect();
      const dd = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (dd < d) { d = dd; best = id; }
    }
    if (best) ring(best);
  };
  const zone = (id: string, flipped: boolean) => (
    <Zone key={id} s={s} id={id} name={who(id)} flipped={flipped} rang={rang[id] === s.seq} hit={flash?.by === id ? (flash.ok ? "ok" : "bad") : null}
      onRing={() => ring(id)} onFlip={() => { vibrate(8); act({ type: "flip" }); }}
      refFn={(el) => { if (el) zones.current.set(id, el); else zones.current.delete(id); }} />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-1.5 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" data-testid="kl-local">
      {top.length > 0 && <div className="flex min-h-0 flex-1 gap-1.5">{top.map((id) => zone(id, true))}</div>}
      <div className="flex shrink-0 items-center gap-2">
        <div className="min-w-0 flex-1 text-xs leading-tight text-muted-foreground" data-testid="kl-status">
          {s.ring ? <b className="text-foreground">Klingel!</b> : <><b className="text-foreground">{who(s.curId)}</b> deckt auf{s.auto ? " · im Takt" : ""}</>}
        </div>
        <button type="button" aria-label="Klingeln (zählt für den, der am nächsten sitzt)" data-testid="kl-bell"
          onPointerDown={(e) => { e.preventDefault(); ringAt(e.clientX, e.clientY); }}
          className="grid size-[min(24vh,7.5rem)] shrink-0 touch-none place-items-center rounded-full bg-paper shadow-lg ring-1 ring-black/5 outline-none select-none">
          <BellShape className="w-[80%]" />
        </button>
        <div className="flex min-w-0 flex-1 justify-end"><RulesSheet gameId={room.gameId} /></div>
      </div>
      <div className="flex min-h-0 flex-1 gap-1.5">{bottom.map((id) => zone(id, false))}</div>
      {flash && <Flash e={flash} who={who} />}
    </div>
  );
}

function Zone({ s, id, name, flipped, rang, hit, onRing, onFlip, refFn }: {
  s: KlState; id: string; name: string; flipped: boolean; rang: boolean; hit: "ok" | "bad" | null;
  onRing: () => void; onFlip: () => void; refFn: (el: HTMLDivElement | null) => void;
}) {
  const top = topOf(s, id);
  const out = s.out.includes(id);
  const cur = s.curId === id && !s.ring;
  const stock = s.stock[id]?.length ?? 0;
  return (
    <div ref={refFn} role="button" tabIndex={-1} aria-label={`Klingeln für ${name}`} data-testid={`kl-zone-${name}`} data-cur={cur}
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest("[data-flip]")) return; e.preventDefault(); onRing(); }}
      className={cn("glass relative flex min-h-0 min-w-0 flex-1 touch-none flex-col items-center gap-1 rounded-2xl p-1.5 select-none", flipped && "rotate-180",
        cur && "ring-2 ring-primary", out && "opacity-40", rang && "bg-primary/15", hit === "ok" && "bg-[#3f9a4a]/30", hit === "bad" && "bg-[#c2492e]/30")}>
      <div className="flex w-full min-w-0 shrink-0 items-baseline justify-between gap-1 px-0.5">
        <b className="min-w-0 truncate text-sm">{name}</b>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{out ? "raus" : karten(cardsOf(s, id))}</span>
      </div>
      {/* offene Karte links, daneben (nie darüber) der verdeckte Stapel – oben gedreht, also gespiegelt */}
      <div className="flex min-h-0 w-full flex-1 items-end gap-1.5">
        <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center" data-testid="kl-zone-card">
          {top ? <FruitCard key={`${top}-${s.open[id]?.length}`} card={top} className="card-flip h-full max-h-full w-auto min-w-0 max-w-full" />
            : <EmptySlot className="h-full max-h-full w-auto max-w-full text-muted-foreground" />}
        </div>
        <div className="flex w-[26%] max-w-16 shrink-0 flex-col items-center">
          {stock > 0 && (
            <button type="button" data-flip onClick={onFlip} disabled={!cur} aria-label={cur ? `${name}: aufdecken` : `${name}: Stapel`} data-testid={`kl-flip-${name}`}
              className={cn("flex w-full flex-col items-center gap-0.5 rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", cur ? "ring-2 ring-primary" : "opacity-75")}>
              <CardBack className="h-auto w-full" />
              <span className={cn("rounded px-1 text-[0.6rem] leading-tight font-bold", cur ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{cur ? "Aufdecken" : stock}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bots an einem Handy für alle: klingeln nach ihrer Reaktionszeit (Aufdecken übernimmt die lokale Partie) */
function useLocalBots(bots: string[], levels: Record<string, string> | undefined, s: KlState, act: (a: KlAction) => void) {
  const key = `${s.seq}|${s.ring ? 1 : 0}|${bots.join()}`;
  useEffect(() => {
    if (!bots.length || s.phase !== "play") return;
    const timers = bots.map((b) => {
      const plan = ringPlan(s, b, levelOf(levels?.[b]));
      if (plan === null) return null;
      return setTimeout(() => act({ type: "ring", seq: s.seq, rt: plan, player: b }), Math.max(0, s.shownAt + plan - Date.now()));
    });
    return () => { for (const t of timers) if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

