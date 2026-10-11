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
  syncStatusBar();
}

/** Look der Seite (vom Admin) setzen */
export function applyLook(look: string) {
  if (document.documentElement.dataset.look === look) return;
  document.documentElement.dataset.look = look;
  syncStatusBar();
}

/** Statusleiste in der Farbe der Seite */
function syncStatusBar() {
  const c = getComputedStyle(document.documentElement).getPropertyValue("--page-top").trim();
  if (c) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c);
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
