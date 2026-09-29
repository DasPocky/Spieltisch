/**
 * Verzeichnis aller Spiel-Oberflächen. Jeder Eintrag in `shared/games` braucht hier sein Gegenstück.
 */
import { GAME_IDS, getGame, isGameId, type GameId } from "@shared/games";
import type { GameUI } from "./types";
import { einenachtUI } from "./einenacht";
import { fischenUI } from "./fischen";
import { flip7UI } from "./flip7";
import { kniffelUI } from "./kniffel";
import { maumauUI } from "./maumau";
import { tuttoUI } from "./tutto";
import { werwolfUI } from "./werwolf";

const UIS: Record<GameId, GameUI<never, never>> = {
  tutto: tuttoUI as unknown as GameUI<never, never>,
  kniffel: kniffelUI as unknown as GameUI<never, never>,
  flip7: flip7UI as unknown as GameUI<never, never>,
  werwolf: werwolfUI as unknown as GameUI<never, never>,
  einenacht: einenachtUI as unknown as GameUI<never, never>,
  maumau: maumauUI as unknown as GameUI<never, never>,
  fischen: fischenUI as unknown as GameUI<never, never>,
};

export function getGameUI(id: string): GameUI {
  return UIS[isGameId(id) ? id : "tutto"] as unknown as GameUI;
}

/** Alle Spiele für die Startseite */
export const GAME_LIST = GAME_IDS.map((id) => ({ id, info: getGame(id).info, ui: getGameUI(id) }));
