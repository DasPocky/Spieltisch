/**
 * Regel-Voreinstellungen je Spiel: „Standard“ (wie im Original) und wenige benannte Pakete wie „Kurz“.
 * Ein Paket setzt alle Regel-Einstellungen auf einmal – Hausregeln und was die Pakete eines Spiels berühren.
 * Material (App- oder echte Karten/Würfel), Brett und Ablauf bleiben, wie sie sind.
 */
import type { GameLogic, Options, OptionValue } from "./types";

export interface RulePreset {
  id: string;
  label: string;
  /** kurz, passt unter den Namen */
  hint: string;
  /** nur Abweichungen vom Standard */
  options: Options;
  /** Werte je Spielerzahl (z. B. Rollen erst ab 6 Spielern) – ergänzen `options`; das Paket bleibt gewählt, wenn sich die Zahl ändert */
  byPlayers?: (players: number) => Options;
}

export const STANDARD_PRESET: RulePreset = { id: "standard", label: "Standard", hint: "wie im Original", options: {} };

type Logic = Pick<GameLogic, "settings" | "presets">;

/** Spielerzahlen, für die gestaffelte Pakete ihre Schlüssel verraten */
const COUNTS = Array.from({ length: 25 }, (_, i) => i);

/** Was das Paket bei dieser Spielerzahl abweichend setzt (ohne Zahl: nur die festen Werte) */
const optionsOf = (p: RulePreset, players?: number): Options => (p.byPlayers && players !== undefined ? { ...p.options, ...p.byPlayers(players) } : p.options);

/** Welche Einstellungen gehören zu den Regeln? */
export function presetKeys(logic: Logic): string[] {
  const own = new Set((logic.presets ?? []).flatMap((p) => [...Object.keys(p.options), ...(p.byPlayers ? COUNTS.flatMap((n) => Object.keys(p.byPlayers!(n))) : [])]));
  return logic.settings.filter((d) => own.has(d.key) || (!!d.group && /Hausregel/.test(d.group))).map((d) => d.key);
}

/** Standard und die Pakete des Spiels – leer, wenn es keine Regeln zum Umschalten gibt */
export function presetsOf(logic: Logic): RulePreset[] {
  return presetKeys(logic).length ? [STANDARD_PRESET, ...(logic.presets ?? [])] : [];
}

const value = (logic: Logic, key: string, o: Options): OptionValue => o[key] ?? logic.settings.find((d) => d.key === key)!.default;

/** Werte, die das Paket setzt (alle Regel-Einstellungen, nicht nur die Abweichungen) – `players`: für gestaffelte Pakete */
export function presetValues(logic: Logic, p: RulePreset, players?: number): Options {
  const o = optionsOf(p, players);
  return Object.fromEntries(presetKeys(logic).map((k) => [k, value(logic, k, o)]));
}

/** Welches Paket gilt gerade (bei dieser Spielerzahl)? null = eigene Regeln */
export function currentPreset(logic: Logic, options: Options, players?: number): string | null {
  const keys = presetKeys(logic);
  return presetsOf(logic).find((p) => { const o = optionsOf(p, players); return keys.every((k) => String(value(logic, k, options)) === String(value(logic, k, o))); })?.id ?? null;
}

/** Spielerzahl geändert: ein gewähltes gestaffeltes Paket passt seine Werte an (sonst bleibt alles) */
export function rescalePreset(logic: Logic, options: Options, from: number, to: number): Options | null {
  if (from === to) return null;
  const id = currentPreset(logic, options, from);
  const p = logic.presets?.find((x) => x.id === id);
  if (!p?.byPlayers) return null;
  const next = presetValues(logic, p, to);
  return Object.keys(next).some((k) => String(value(logic, k, options)) !== String(next[k])) ? { ...options, ...next } : null;
}

/** Wie viele Regeln weichen vom Standard ab? */
export function changedRules(logic: Logic, options: Options): number {
  return presetKeys(logic).filter((k) => String(value(logic, k, options)) !== String(value(logic, k, {}))).length;
}
