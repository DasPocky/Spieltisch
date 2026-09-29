import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = (n: number) => n.toLocaleString("de-DE");

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* nicht unterstützt */ }
}
