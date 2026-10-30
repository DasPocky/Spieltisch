/**
 * Klingel-Bots: wann klingelt ein Bot, wann deckt er auf? Je Stufe eine Reaktionszeit, ab und zu klingelt er falsch,
 * der Leichte verpasst auch mal eine Fünf. Der Plan hängt nur an Bot, Lage und Stufe (fest gestreut) –
 * so verhält er sich gleich, egal wie oft der Server nachschaut.
 */
import { active, readyFruit, type KlAction, type KlState } from "./logic";

export type KlLevel = "leicht" | "mittel" | "schwer";
/** Reaktionszeit beim richtigen Klingeln in ms (von – bis) */
export const REACT: Record<KlLevel, [number, number]> = { leicht: [950, 1700], mittel: [650, 1150], schwer: [420, 720] };
/** so oft klingelt er falsch, wenn keine Fünf liegt (je Lage) */
const FOUL: Record<KlLevel, number> = { leicht: 0.06, mittel: 0.03, schwer: 0.01 };
/** so oft verpasst er eine Fünf */
const MISS: Record<KlLevel, number> = { leicht: 0.15, mittel: 0.05, schwer: 0 };

export const levelOf = (x: unknown): KlLevel => (x === "leicht" || x === "schwer" ? x : "mittel");

/** fester Zufall 0..1 aus einem Text (FNV-1a) */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Wann (ms nach dem Aufdecken) klingelt dieser Bot auf dieser Lage – null: gar nicht */
export function ringPlan(s: KlState, botId: string, level: KlLevel): number | null {
  if (s.phase !== "play" || !active(s).includes(botId) || s.fouls.includes(botId)) return null;
  const key = `${botId}|${s.seq}|${s.flips}`;
  if (readyFruit(s)) {
    if (hash01(`${key}|miss`) < MISS[level]) return null;
    const [lo, hi] = REACT[level];
    return Math.round(lo + hash01(`${key}|rt`) * (hi - lo));
  }
  // falsch: die Lage muss schon etwas liegen, sonst wirkt es wie ein Versehen beim Aufdecken
  if (hash01(`${key}|foul`) < FOUL[level]) return Math.round(500 + hash01(`${key}|ft`) * 900);
  return null;
}

/** Wann deckt der Bot auf, wenn er dran ist (ms nach dem Aufdecken der letzten Karte)? */
export const flipPlan = (s: KlState, botId: string) => 750 + Math.round(hash01(`${botId}|${s.seq}|flip`) * 650);

/** Was ein Bot jetzt tun kann (`now` = Uhrzeit). Leer: noch nichts. */
export function botActions(s: KlState, botId: string, level: KlLevel, now: number): KlAction[] {
  if (s.phase !== "play") return [];
  const out: KlAction[] = [];
  const player = s.local ? { player: botId } : {};
  const plan = ringPlan(s, botId, level);
  const claimed = !!s.ring?.claims.some((c) => c.id === botId);
  if (plan !== null && !claimed && now >= s.shownAt + plan) out.push({ type: "ring", seq: s.seq, rt: plan, ...player });
  if (s.ring) { if (now >= s.ring.until) out.push({ type: "tick" }); return out; }
  if ((s.limitAt !== null && now >= s.limitAt) || (s.nextAt !== null && now >= s.nextAt)) out.push({ type: "tick" });
  if (s.curId === botId && !s.auto && now >= Math.max(s.shownAt + flipPlan(s, botId), s.at + 300)) out.push({ type: "flip" });
  return out;
}

/** Wann sollte der Server wieder nach den Bots schauen? (ms ab jetzt) */
export function botWait(s: KlState, bots: string[], levels: Record<string, string> | undefined, now: number): number {
  if (s.phase !== "play") return 2000;
  const at: number[] = [];
  if (s.ring) at.push(s.ring.until + 10);
  else {
    if (s.nextAt !== null) at.push(s.nextAt + 20);
    if (s.limitAt !== null) at.push(s.limitAt + 20);
  }
  for (const b of bots) {
    if (s.local) continue;
    const plan = ringPlan(s, b, levelOf(levels?.[b]));
    if (plan !== null && !s.ring?.claims.some((c) => c.id === b)) at.push(s.shownAt + plan);
  }
  if (!s.ring && !s.auto && s.curId && bots.includes(s.curId)) at.push(Math.max(s.shownAt + flipPlan(s, s.curId), s.at + 300));
  const next = Math.min(...at.filter((t) => t > now - 2000));
  return Number.isFinite(next) ? Math.max(30, Math.min(5000, next - now)) : 2000;
}
