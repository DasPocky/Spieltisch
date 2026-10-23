import type { GameInfo } from "@shared/platform/types";

/** Für die Suche vereinheitlichen: klein, ohne Akzente, ä→a, ß→ss */
export function fold(s: string): string {
  return s.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/** Passt das Spiel zur Suche? Jedes Wort muss in Name, Kurzbeschreibung oder Art vorkommen. */
export function gameMatches(info: GameInfo, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = fold(`${info.name} ${info.tagline} ${info.category}`);
  return words.every((w) => hay.includes(w));
}

export function fitsPlayers(info: GameInfo, n: number): boolean {
  return n >= info.minPlayers && n <= info.maxPlayers;
}

/** Grobe Gesamtdauer eines Plans aus den Angaben „10–20 Min.“ – „ca. 1–2 Std.“ ab einer Stunde */
export function planDuration(infos: GameInfo[]): string {
  let lo = 0, hi = 0;
  for (const g of infos) {
    const [a, b] = (g.duration.match(/\d+/g) ?? []).map(Number);
    if (a === undefined) continue;
    lo += a; hi += b ?? a;
  }
  if (!hi) return "";
  if (hi < 60) return lo === hi ? `ca. ${lo} Min.` : `ca. ${lo}–${hi} Min.`;
  const h = (m: number) => String(Math.round(m / 30) / 2).replace(".", ",");
  return h(lo) === h(hi) ? `ca. ${h(lo)} Std.` : `ca. ${h(lo)}–${h(hi)} Std.`;
}
