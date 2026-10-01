import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { prefs } from "./prefs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = (n: number) => n.toLocaleString("de-DE");

/** Vibrieren – nur wenn in den Einstellungen erlaubt */
export function vibrate(pattern: number | number[]) {
  if (!prefs().vibration) return;
  try { navigator.vibrate?.(pattern); } catch { /* nicht unterstützt */ }
}
