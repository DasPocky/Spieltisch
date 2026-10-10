/**
 * Verzeichnis aller Spiel-Oberflächen. Jeder Eintrag in `shared/games` braucht hier sein Gegenstück.
 * Symbole sind sofort da (Spielauswahl), die eigentlichen Spiele laden erst, wenn man sie öffnet –
 * so startet die App schneller. Offline sind trotzdem alle da (der Service Worker speichert sie vorab).
 */
import { use, type ComponentType } from "react";
import { GAME_IDS, getGame, isGameId, type GameId } from "@shared/games";
import type { GameUI } from "./types";
import { Icon as CodenamesIcon } from "./codenames/Icon";
import { Icon as DameIcon } from "./dame/Icon";
import { Icon as EinenachtIcon } from "./einenacht/Icon";
import { Icon as FischenIcon } from "./fischen/Icon";
import { Icon as Flip7Icon } from "./flip7/Icon";
import { Icon as HellseherIcon } from "./hellseher/Icon";
import { Icon as KniffelIcon } from "./kniffel/Icon";
import { Icon as LudoIcon } from "./ludo/Icon";
import { Icon as MaexchenIcon } from "./maexchen/Icon";
import { Icon as MaumauIcon } from "./maumau/Icon";
import { Icon as MuehleIcon } from "./muehle/Icon";
import { Icon as Phase10Icon } from "./phase10/Icon";
import { Icon as SkipboIcon } from "./skipbo/Icon";
import { Icon as SkyjoIcon } from "./skyjo/Icon";
import { Icon as SpionIcon } from "./spion/Icon";
import { Icon as TuttoIcon } from "./tutto/Icon";
import { Icon as UnoIcon } from "./uno/Icon";
import { Icon as VierIcon } from "./vier/Icon";
import { Icon as WerwolfIcon } from "./werwolf/Icon";

type Icon = ComponentType<{ className?: string }>;

const ICONS: Record<GameId, Icon> = {
  codenames: CodenamesIcon,
  dame: DameIcon,
  einenacht: EinenachtIcon,
  fischen: FischenIcon,
  flip7: Flip7Icon,
  hellseher: HellseherIcon,
  kniffel: KniffelIcon,
  ludo: LudoIcon,
  maexchen: MaexchenIcon,
  maumau: MaumauIcon,
  muehle: MuehleIcon,
  phase10: Phase10Icon,
  skipbo: SkipboIcon,
  skyjo: SkyjoIcon,
  spion: SpionIcon,
  tutto: TuttoIcon,
  uno: UnoIcon,
  vier: VierIcon,
  werwolf: WerwolfIcon,
};

const LOADERS: Record<GameId, () => Promise<GameUI>> = {
  codenames: () => import("./codenames").then((m) => m.codenamesUI as unknown as GameUI),
  dame: () => import("./dame").then((m) => m.dameUI as unknown as GameUI),
  einenacht: () => import("./einenacht").then((m) => m.einenachtUI as unknown as GameUI),
  fischen: () => import("./fischen").then((m) => m.fischenUI as unknown as GameUI),
  flip7: () => import("./flip7").then((m) => m.flip7UI as unknown as GameUI),
  hellseher: () => import("./hellseher").then((m) => m.hellseherUI as unknown as GameUI),
  kniffel: () => import("./kniffel").then((m) => m.kniffelUI as unknown as GameUI),
  ludo: () => import("./ludo").then((m) => m.ludoUI as unknown as GameUI),
  maexchen: () => import("./maexchen").then((m) => m.maexchenUI as unknown as GameUI),
  maumau: () => import("./maumau").then((m) => m.maumauUI as unknown as GameUI),
  muehle: () => import("./muehle").then((m) => m.muehleUI as unknown as GameUI),
  phase10: () => import("./phase10").then((m) => m.phase10UI as unknown as GameUI),
  skipbo: () => import("./skipbo").then((m) => m.skipboUI as unknown as GameUI),
  skyjo: () => import("./skyjo").then((m) => m.skyjoUI as unknown as GameUI),
  spion: () => import("./spion").then((m) => m.spionUI as unknown as GameUI),
  tutto: () => import("./tutto").then((m) => m.tuttoUI as unknown as GameUI),
  uno: () => import("./uno").then((m) => m.unoUI as unknown as GameUI),
  vier: () => import("./vier").then((m) => m.vierUI as unknown as GameUI),
  werwolf: () => import("./werwolf").then((m) => m.werwolfUI as unknown as GameUI),
};

const loaded = new Map<string, GameUI>();
const loading = new Map<string, Promise<GameUI>>();
const idOf = (id: string): GameId => (isGameId(id) ? id : "tutto");

/** Spiel laden (einmal) – für Vorladen, z. B. wenn es in der Lobby gewählt wird */
export function loadGameUI(id: string): Promise<GameUI> {
  const key = idOf(id);
  let p = loading.get(key);
  if (!p) {
    p = LOADERS[key]().then((ui) => { loaded.set(key, ui); return ui; });
    // Fehlgeschlagen (z. B. kein Netz beim ersten Mal): beim nächsten Versuch neu laden
    p.catch(() => loading.delete(key));
    loading.set(key, p);
  }
  return p;
}

/**
 * Oberfläche eines Spiels. Nur während des Renderns aufrufen: Ist das Spiel noch nicht geladen,
 * wartet die nächste <Suspense>-Grenze (Ladeanzeige), bis es da ist.
 */
export function getGameUI(id: string): GameUI {
  return loaded.get(idOf(id)) ?? use(loadGameUI(id));
}

/** Symbol eines Spiels – sofort verfügbar */
export function gameIcon(id: string): Icon {
  return ICONS[idOf(id)];
}

/** Alle Spiele für Startseite und Auswahl */
export const GAME_LIST = GAME_IDS.map((id) => ({ id, info: getGame(id).info, Icon: ICONS[id] }));
