/**
 * Verzeichnis aller Spiele (Logik-Teil). Neues Spiel: Modul unter `shared/games/<id>/`
 * anlegen und hier eintragen – die Oberfläche kommt nach `src/games/<id>/`.
 */
import type { GameLogic } from "../platform/types";
import { codenames } from "./codenames/logic";
import { einenacht } from "./einenacht/logic";
import { fischen } from "./fischen/logic";
import { flip7 } from "./flip7/logic";
import { kniffel } from "./kniffel/logic";
import { maumau } from "./maumau/logic";
import { skipbo } from "./skipbo/logic";
import { skyjo } from "./skyjo/logic";
import { tutto } from "./tutto/logic";
import { uno } from "./uno/logic";
import { werwolf } from "./werwolf/logic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES = { tutto, kniffel, flip7, skyjo, werwolf, einenacht, codenames, maumau, uno, skipbo, fischen } satisfies Record<string, GameLogic<any, any>>;

export type GameId = keyof typeof GAMES;
export const GAME_IDS = Object.keys(GAMES) as GameId[];
export const DEFAULT_GAME: GameId = "tutto";

export function isGameId(id: unknown): id is GameId {
  return typeof id === "string" && Object.hasOwn(GAMES, id);
}

export function getGame(id: string): GameLogic<unknown, { type: string }> {
  return (isGameId(id) ? GAMES[id] : GAMES[DEFAULT_GAME]) as unknown as GameLogic<unknown, { type: string }>;
}
