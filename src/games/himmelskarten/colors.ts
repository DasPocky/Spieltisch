/** Kartenfarbe nach Wert wie im Original – eigene Datei, damit das Symbol ohne das Brett geladen werden kann */
export function cardColor(v: number): { bg: string; fg: string } {
  if (v < 0) return { bg: "#2b3a9b", fg: "#fff" };
  if (v === 0) return { bg: "#3fb6e6", fg: "#fff" };
  if (v <= 4) return { bg: "#5cb431", fg: "#fff" };
  if (v <= 8) return { bg: "#f2c919", fg: "#1c1c1c" };
  return { bg: "#e4372a", fg: "#fff" };
}
