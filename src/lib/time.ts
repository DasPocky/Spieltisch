/** Zeitangaben auf Deutsch – an einer Stelle, damit alle Seiten gleich formulieren */

/** Tag als „2026-10-16“ (UTC) – so zählt auch der Server */
export const dayKey = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/** „20:15“ */
export const clock = (ms: number) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

/** „Fr., 16.10., 20:15“ */
export const dateTime = (ms: number) => new Date(ms).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** „vor 5 Min.“ usw. */
export function ago(ms: number, now = Date.now()): string {
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "vor 1 Tag" : `vor ${d} Tagen`;
}

/** „1 Std. 20 Min.“ */
export function duration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 48) return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
  return `${Math.round(h / 24)} Tage`;
}
