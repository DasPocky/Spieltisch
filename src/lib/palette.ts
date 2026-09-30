/**
 * Gedämpfte Spielfarben – nur wo ein Spiel Farben als Regelinhalt braucht (Kartenfarben, Teams, Kartenwerte).
 * Alles andere bleibt Marineblau mit Abstufungen (siehe index.css).
 */
export const MUTED = {
  /** Herz/Karo, Team Rot, hohe (schlechte) Werte */
  red: "#a8454f",
  /** Team Blau */
  blue: "#4b72b0",
  /** Passanten, neutral */
  sand: "#cdc4ae",
  /** Attentäter, Kreuz/Pik */
  ink: "#1b1e25",
  /** niedrige (gute) Werte */
  teal: "#5f8f86",
  /** mittlere Werte, Schellen */
  ochre: "#b39a5c",
  paper: "#fdfdfb",
  navy: "#1f437f",
  ice: "#cfe0fa",
} as const;
