/**
 * „Spiel wechseln“ aus Menü oder Ergebnis: Die Partie endet, und die Lobby öffnet gleich die Spielauswahl.
 * Nur im Speicher – nach dem Neuladen landet man einfach in der Lobby.
 */
let wanted = false;

export const wantGamePick = () => { wanted = true; };

export function takeGamePick(): boolean {
  const w = wanted;
  wanted = false;
  return w;
}
