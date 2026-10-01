import { useSyncExternalStore } from "react";

/** Darstellung: hell (Standard), dunkel oder wie das Handy eingestellt ist */
export type ThemeChoice = "light" | "dark" | "system";
const KEY = "spieltisch:theme";
const listeners = new Set<() => void>();

export function themeChoice(): ThemeChoice {
  try { const v = localStorage.getItem(KEY); return v === "dark" || v === "system" ? v : "light"; } catch { return "light"; }
}

/** Setzt `data-theme` auf <html> und die Statusleisten-Farbe */
export function applyTheme(choice = themeChoice()) {
  const dark = choice === "dark" || (choice === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a1730" : "#f5f7fa");
}

export function setTheme(choice: ThemeChoice) {
  try { localStorage.setItem(KEY, choice); } catch { /* egal */ }
  applyTheme(choice);
  listeners.forEach((l) => l());
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, themeChoice);
}

if (typeof window !== "undefined") {
  applyTheme();
  matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (themeChoice() === "system") applyTheme(); });
}
