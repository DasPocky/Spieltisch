/**
 * Verzeichnis aller Spiele (Logik-Teil). Neues Spiel: Modul unter `shared/games/<id>/`
 * anlegen und hier eintragen – die Oberfläche kommt nach `src/games/<id>/`.
 */
import type { GameLogic } from "../platform/types";
import { decknamen } from "./decknamen/logic";
import { einenacht } from "./einenacht/logic";
import { fischen } from "./fischen/logic";
import { hellseher } from "./hellseher/logic";
import { glueckssieben } from "./glueckssieben/logic";
import { fuenfwuerfel } from "./fuenfwuerfel/logic";
import { maumau } from "./maumau/logic";
import { zehnphasen } from "./zehnphasen/logic";
import { stapelbau } from "./stapelbau/logic";
import { himmelskarten } from "./himmelskarten/logic";
import { spion } from "./spion/logic";
import { maexchen } from "./maexchen/logic";
import { ludo } from "./ludo/logic";
import { vier } from "./vier/logic";
import { muehle } from "./muehle/logic";
import { dame } from "./dame/logic";
import { alles } from "./alles/logic";
import { eins } from "./eins/logic";
import { werwolf } from "./werwolf/logic";
import { schamlos } from "./schamlos/logic";
import { stirnraten } from "./stirnraten/logic";
import { zeichnen } from "./zeichnen/logic";
import { quiz } from "./quiz/logic";
import { kritzelpost } from "./kritzelpost/logic";
import { herzen } from "./herzen/logic";
import { klingel } from "./klingel/logic";
import { stadtlandfluss } from "./stadtlandfluss/logic";
import { schocken } from "./schocken/logic";
import { erklaerspiel } from "./erklaerspiel/logic";
import { ankreuzspiel } from "./ankreuzspiel/logic";
import { bluff } from "./bluff/logic";
import { werbinich } from "./werbinich/logic";
import { palast } from "./palast/logic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES = { alles, fuenfwuerfel, glueckssieben, himmelskarten, werwolf, einenacht, decknamen, maumau, eins, stapelbau, zehnphasen, fischen, hellseher, herzen, klingel, palast, spion, schamlos, stirnraten, werbinich, zeichnen, kritzelpost, stadtlandfluss, erklaerspiel, quiz, maexchen, schocken, bluff, ankreuzspiel, ludo, vier, muehle, dame } satisfies Record<string, GameLogic<any, any>>;

export type GameId = keyof typeof GAMES;
export const GAME_IDS = Object.keys(GAMES) as GameId[];
export const DEFAULT_GAME: GameId = "alles";

export function isGameId(id: unknown): id is GameId {
  return typeof id === "string" && Object.hasOwn(GAMES, id);
}

export function getGame(id: string): GameLogic<unknown, { type: string }> {
  return (isGameId(id) ? GAMES[id] : GAMES[DEFAULT_GAME]) as unknown as GameLogic<unknown, { type: string }>;
}
