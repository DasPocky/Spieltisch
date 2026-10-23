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
}

export const STANDARD_PRESET: RulePreset = { id: "standard", label: "Standard", hint: "wie im Original", options: {} };

type Logic = Pick<GameLogic, "settings" | "presets">;

/** Welche Einstellungen gehören zu den Regeln? */
export function presetKeys(logic: Logic): string[] {
  const own = new Set((logic.presets ?? []).flatMap((p) => Object.keys(p.options)));
  return logic.settings.filter((d) => own.has(d.key) || (!!d.group && /Hausregel/.test(d.group))).map((d) => d.key);
}

/** Standard und die Pakete des Spiels – leer, wenn es keine Regeln zum Umschalten gibt */
export function presetsOf(logic: Logic): RulePreset[] {
  return presetKeys(logic).length ? [STANDARD_PRESET, ...(logic.presets ?? [])] : [];
}

const value = (logic: Logic, key: string, o: Options): OptionValue => o[key] ?? logic.settings.find((d) => d.key === key)!.default;

/** Werte, die das Paket setzt (alle Regel-Einstellungen, nicht nur die Abweichungen) */
export function presetValues(logic: Logic, p: RulePreset): Options {
  return Object.fromEntries(presetKeys(logic).map((k) => [k, value(logic, k, p.options)]));
}

/** Welches Paket gilt gerade? null = eigene Regeln */
export function currentPreset(logic: Logic, options: Options): string | null {
  const keys = presetKeys(logic);
  return presetsOf(logic).find((p) => keys.every((k) => String(value(logic, k, options)) === String(value(logic, k, p.options))))?.id ?? null;
}

/** Wie viele Regeln weichen vom Standard ab? */
export function changedRules(logic: Logic, options: Options): number {
  return presetKeys(logic).filter((k) => String(value(logic, k, options)) !== String(value(logic, k, {}))).length;
}
