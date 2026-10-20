/**
 * Spielweisen über das Handy hinaus: Großer Tisch (Fernseher/Laptop zeigt den Tisch), am Rechner am Tisch mitspielen,
 * Bühne mit Moderator. Jedes Spiel meldet hier, was es kann; die Verwaltung schaltet je Spiel und Spielweise
 * „an“, „Beta“ (nur Geräte der Verwaltung) oder „aus“. Handy und „Ein Handy für alle“ regeln weiter die Freigaben.
 */
export type PlayMode = "table" | "desk" | "stage";
export type ModeState = "on" | "beta" | "off";

export const PLAY_MODES: { value: PlayMode; label: string; hint: string }[] = [
  { value: "table", label: "Tisch", hint: "Fernseher oder Laptop zeigt den Tisch, gespielt wird am Handy" },
  { value: "desk", label: "Am Rechner", hint: "am Rechner am Tisch mitspielen – eigene Hand, Maus und Tastatur" },
  { value: "stage", label: "Bühne", hint: "Fernseher als Showbühne mit Moderator" },
];

export const MODE_STATES: { value: ModeState; label: string }[] = [
  { value: "on", label: "An" }, { value: "beta", label: "Beta" }, { value: "off", label: "Aus" },
];

/**
 * Was ein Spiel kann – und wie es ausgeliefert wird, solange die Verwaltung nichts anderes sagt.
 * Neue Spielweisen starten als „beta“ und werden nach der Abnahme auf „on“ gesetzt.
 */
export const GAME_MODES: Record<string, Partial<Record<PlayMode, ModeState>>> = {
  // Abgenommen: docs/abnahme/maumau.md, docs/abnahme/eins.md
  maumau: { table: "on", desk: "on", stage: "beta" },
  eins: { table: "on", desk: "on", stage: "beta" },
  schamlos: { table: "on", stage: "beta" },
  // Bausteine Würfel und Spielfeld: abgenommen (docs/abnahme/fuenfwuerfel.md, vier.md)
  fuenfwuerfel: { table: "on", stage: "beta" },
  vier: { table: "on", stage: "beta" },
  // Tisch abgenommen: docs/abnahme/tisch.md (Stapel und Auslage, Würfel mit Karten/Becher, Brett, Aufsteller)
  stapelbau: { table: "on", desk: "beta" },
  himmelskarten: { table: "on" },
  zehnphasen: { table: "on", desk: "beta" },
  glueckssieben: { table: "on" },
  decknamen: { table: "on" },
  alles: { table: "on" },
  maexchen: { table: "on" },
  dame: { table: "on" },
  muehle: { table: "on" },
  ludo: { table: "on" },
  fischen: { table: "on" },
  hellseher: { table: "on" },
  werwolf: { table: "on" },
  einenacht: { table: "on" },
  spion: { table: "on" },
  stirnraten: { table: "on" },
};

/** Spiele mit eigener Tisch-Ansicht (andere zeigt der Tisch wie ein Handy in der Mitte) */
export const TABLE_GAMES = Object.keys(GAME_MODES).filter((id) => GAME_MODES[id].table);

/** Einstellungen der Verwaltung: Spiel → Spielweise → Zustand (nur Abweichungen) */
export type GameModes = Record<string, Partial<Record<PlayMode, ModeState>>>;

const isMode = (x: unknown): x is PlayMode => PLAY_MODES.some((m) => m.value === x);
const isState = (x: unknown): x is ModeState => x === "on" || x === "beta" || x === "off";

export function sanitizeModes(x: unknown): GameModes {
  const out: GameModes = {};
  if (!x || typeof x !== "object") return out;
  for (const [id, raw] of Object.entries(x as Record<string, unknown>)) {
    if (!GAME_MODES[id] || !raw || typeof raw !== "object") continue;
    for (const [m, st] of Object.entries(raw as Record<string, unknown>)) {
      if (isMode(m) && isState(st) && GAME_MODES[id][m] && GAME_MODES[id][m] !== st) (out[id] ??= {})[m] = st;
    }
  }
  return out;
}

/** Zustand einer Spielweise für ein Spiel – „none“: kann das Spiel (noch) nicht */
export function modeState(modes: GameModes | undefined, gameId: string, mode: PlayMode): ModeState | "none" {
  const built = GAME_MODES[gameId]?.[mode];
  if (!built) return "none";
  return modes?.[gameId]?.[mode] ?? built;
}

/** Darf dieses Gerät die Spielweise nutzen? Beta nur für Geräte der Verwaltung. */
export function modeAllowed(modes: GameModes | undefined, gameId: string, mode: PlayMode, admin: boolean): boolean {
  const s = modeState(modes, gameId, mode);
  return s === "on" || (s === "beta" && admin);
}
