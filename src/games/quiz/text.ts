import type { QState } from "@shared/games/quiz/logic";

/** Farben der vier Antworten (immer gleich – am Fernseher und am Handy) */
export const TONES = ["#e11d48", "#2563eb", "#d97706", "#16a34a"] as const;
export const LETTERS = ["A", "B", "C", "D"] as const;
export const fmt = (n: number) => n.toLocaleString("de-DE");

/** Zahl aus Eingabe („1.234,5“ oder „1234.5“) */
export function parseNumber(t: string): number | null {
  const c = t.trim().replace(/\s/g, "");
  if (!c) return null;
  // deutsch: Punkt trennt Tausender („1.000“), Komma die Nachkommastellen
  const norm = /^-?\d{1,3}(\.\d{3})+$/.test(c) ? c.replace(/\./g, "")
    : /,\d{1,2}$/.test(c) || (c.includes(",") && !c.includes(".")) ? c.replace(/\./g, "").replace(",", ".") : c.replace(/,/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Lösung als Text */
export function solution(s: QState): string {
  const sh = s.shown;
  const key = s.last?.key ?? s.key;
  if (!sh || key === null || key === undefined) return "";
  if (sh.kind === "zahl") return `${fmt(key as number)}${sh.unit ? ` ${sh.unit}` : ""}`;
  if (sh.kind === "folge") return (key as number[]).map((i) => sh.options[i]).join(" → ");
  return `${LETTERS[key as number]}: ${sh.options[key as number]}`;
}

