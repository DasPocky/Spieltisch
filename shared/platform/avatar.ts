/** Avatare: Farbe und Tier je Spieler – gebraucht von Raum, Gruppe, Profil und Verzeichnis, deshalb ohne eigene Abhängigkeiten */

/** Gedämpfte Farben, die auf hellem und dunklem Grund funktionieren */
export const AVATAR_COLORS = [
  "#c96a72", "#cf8a5c", "#c4a457", "#97a55a", "#68a57b", "#5c9e95",
  "#5aa0bd", "#5b80c6", "#7a74c6", "#a173bd", "#c674a0", "#7f8ba1",
] as const;
export const AVATAR_EMOJIS = [
  "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
  "🐔", "🐧", "🦉", "🐙", "🦄", "🐝", "🐢", "🐳", "😎", "🤓", "🥳", "🤠",
] as const;

export interface Avatar {
  /** Index in AVATAR_COLORS */
  color: number;
  /** Index in AVATAR_EMOJIS */
  emoji: number;
  /** Eigenes Foto (Speichername in R2) – nur im Raum, nie gespeichert oder übernommen */
  photo?: string;
}

/** Avatar aus Eingaben prüfen – null, wenn es keiner ist */
export function sanitizeAvatar(x: unknown): Avatar | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const { color, emoji } = o;
  if (!Number.isInteger(color) || !Number.isInteger(emoji)) return null;
  if ((color as number) < 0 || (color as number) >= AVATAR_COLORS.length) return null;
  if ((emoji as number) < 0 || (emoji as number) >= AVATAR_EMOJIS.length) return null;
  return { color: color as number, emoji: emoji as number };
}

/** Fester Start-Avatar aus einer ID (jedes Gerät hat so gleich einen eigenen) */
export function defaultAvatar(seed: string): Avatar {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return { color: h % AVATAR_COLORS.length, emoji: (h >>> 8) % AVATAR_EMOJIS.length };
}
