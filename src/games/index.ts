/**
 * Verzeichnis aller Spiel-Oberflächen. Jeder Eintrag in `shared/games` braucht hier sein Gegenstück.
 * Symbole sind sofort da (Spielauswahl), die eigentlichen Spiele laden erst, wenn man sie öffnet –
 * so startet die App schneller. Offline sind trotzdem alle da (der Service Worker speichert sie vorab).
 */
import { use, type ComponentType } from "react";
import { GAME_IDS, getGame, isGameId, type GameId } from "@shared/games";
import type { GameUI } from "./types";
import { legacyLoader } from "@/legacy";
import { Icon as DecknamenIcon } from "./decknamen/Icon";
import { Icon as DameIcon } from "./dame/Icon";
import { Icon as EinenachtIcon } from "./einenacht/Icon";
import { Icon as FischenIcon } from "./fischen/Icon";
import { Icon as GlueckssiebenIcon } from "./glueckssieben/Icon";
import { Icon as HellseherIcon } from "./hellseher/Icon";
import { Icon as FuenfWuerfelIcon } from "./fuenfwuerfel/Icon";
import { Icon as LudoIcon } from "./ludo/Icon";
import { Icon as MaexchenIcon } from "./maexchen/Icon";
import { Icon as MaumauIcon } from "./maumau/Icon";
import { Icon as MuehleIcon } from "./muehle/Icon";
import { Icon as ZehnPhasenIcon } from "./zehnphasen/Icon";
import { Icon as SchamlosIcon } from "./schamlos/Icon";
import { Icon as StapelbauIcon } from "./stapelbau/Icon";
import { Icon as HimmelskartenIcon } from "./himmelskarten/Icon";
import { Icon as SpionIcon } from "./spion/Icon";
import { Icon as StirnratenIcon } from "./stirnraten/Icon";
import { Icon as ZeichnenIcon } from "./zeichnen/Icon";
import { Icon as KritzelpostIcon } from "./kritzelpost/Icon";
import { Icon as StadtlandflussIcon } from "./stadtlandfluss/Icon";
import { Icon as HerzenIcon } from "./herzen/Icon";
import { Icon as QuizIcon } from "./quiz/Icon";
import { Icon as AllesIcon } from "./alles/Icon";
import { Icon as EinsIcon } from "./eins/Icon";
import { Icon as VierIcon } from "./vier/Icon";
import { Icon as WerwolfIcon } from "./werwolf/Icon";

type Icon = ComponentType<{ className?: string }>;

const ICONS: Record<GameId, Icon> = {
  decknamen: DecknamenIcon,
  dame: DameIcon,
  einenacht: EinenachtIcon,
  fischen: FischenIcon,
  glueckssieben: GlueckssiebenIcon,
  hellseher: HellseherIcon,
  fuenfwuerfel: FuenfWuerfelIcon,
  ludo: LudoIcon,
  maexchen: MaexchenIcon,
  maumau: MaumauIcon,
  muehle: MuehleIcon,
  zehnphasen: ZehnPhasenIcon,
  schamlos: SchamlosIcon,
  stapelbau: StapelbauIcon,
  himmelskarten: HimmelskartenIcon,
  spion: SpionIcon,
  stirnraten: StirnratenIcon,
  zeichnen: ZeichnenIcon,
  kritzelpost: KritzelpostIcon,
  stadtlandfluss: StadtlandflussIcon,
  herzen: HerzenIcon,
  quiz: QuizIcon,
  alles: AllesIcon,
  eins: EinsIcon,
  vier: VierIcon,
  werwolf: WerwolfIcon,
};

const LOADERS: Record<GameId, () => Promise<GameUI>> = {
  decknamen: () => import("./decknamen").then((m) => m.decknamenUI as unknown as GameUI),
  dame: () => import("./dame").then((m) => m.dameUI as unknown as GameUI),
  einenacht: () => import("./einenacht").then((m) => m.einenachtUI as unknown as GameUI),
  fischen: () => import("./fischen").then((m) => m.fischenUI as unknown as GameUI),
  glueckssieben: () => import("./glueckssieben").then((m) => m.glueckssiebenUI as unknown as GameUI),
  hellseher: () => import("./hellseher").then((m) => m.hellseherUI as unknown as GameUI),
  fuenfwuerfel: () => import("./fuenfwuerfel").then((m) => m.fuenfwuerfelUI as unknown as GameUI),
  ludo: () => import("./ludo").then((m) => m.ludoUI as unknown as GameUI),
  maexchen: () => import("./maexchen").then((m) => m.maexchenUI as unknown as GameUI),
  maumau: () => import("./maumau").then((m) => m.maumauUI as unknown as GameUI),
  muehle: () => import("./muehle").then((m) => m.muehleUI as unknown as GameUI),
  zehnphasen: () => import("./zehnphasen").then((m) => m.zehnphasenUI as unknown as GameUI),
  schamlos: () => import("./schamlos").then((m) => m.schamlosUI as unknown as GameUI),
  stapelbau: () => import("./stapelbau").then((m) => m.stapelbauUI as unknown as GameUI),
  himmelskarten: () => import("./himmelskarten").then((m) => m.himmelskartenUI as unknown as GameUI),
  spion: () => import("./spion").then((m) => m.spionUI as unknown as GameUI),
  stirnraten: () => import("./stirnraten").then((m) => m.stirnratenUI as unknown as GameUI),
  zeichnen: () => import("./zeichnen").then((m) => m.zeichnenUI as unknown as GameUI),
  kritzelpost: () => import("./kritzelpost").then((m) => m.kritzelpostUI as unknown as GameUI),
  stadtlandfluss: () => import("./stadtlandfluss").then((m) => m.stadtlandflussUI as unknown as GameUI),
  herzen: () => import("./herzen").then((m) => m.herzenUI as unknown as GameUI),
  quiz: () => import("./quiz").then((m) => m.quizUI as unknown as GameUI),
  alles: () => import("./alles").then((m) => m.allesUI as unknown as GameUI),
  eins: () => import("./eins").then((m) => m.einsUI as unknown as GameUI),
  vier: () => import("./vier").then((m) => m.vierUI as unknown as GameUI),
  werwolf: () => import("./werwolf").then((m) => m.werwolfUI as unknown as GameUI),
};

const loaded = new Map<string, GameUI>();
const loading = new Map<string, Promise<GameUI>>();
const idOf = (id: string): GameId => (isGameId(id) ? id : "alles");

/**
 * Spiel laden (einmal) – für Vorladen, z. B. wenn es in der Lobby gewählt wird.
 * `version`: läuft eine Partie nach einem Update noch mit einer älteren Version, deren Oberfläche.
 */
export function loadGameUI(id: string, version?: number): Promise<GameUI> {
  const key = idOf(id);
  const old = version !== undefined && version !== getGame(key).version ? legacyLoader(key, version) : null;
  const cacheKey = old ? `${key}@${version}` : key;
  let p = loading.get(cacheKey);
  if (!p) {
    p = (old ?? LOADERS[key])().then((ui) => {
      loaded.set(cacheKey, ui);
      // React liest ein fertiges Versprechen so direkt aus, ohne erneut zu warten
      Object.assign(p!, { status: "fulfilled", value: ui });
      return ui;
    });
    // Fehlgeschlagen (z. B. kein Netz beim ersten Mal oder Datei nach einem Update weg): beim nächsten Versuch neu laden
    p.catch(() => loading.delete(cacheKey));
    loading.set(cacheKey, p);
  }
  return p;
}

/**
 * Oberfläche eines Spiels. Nur während des Renderns aufrufen: Ist das Spiel noch nicht geladen,
 * wartet die nächste <Suspense>-Grenze (Ladeanzeige), bis es da ist.
 */
export function getGameUI(id: string, version?: number): GameUI {
  // Immer use() – React verlangt, dass es bei jedem Rendern gleich aufgerufen wird
  return use(loadGameUI(id, version));
}

/** Symbol eines Spiels – sofort verfügbar */
export function gameIcon(id: string): Icon {
  return ICONS[idOf(id)];
}

/** Alle Spiele für Startseite und Auswahl */
export const GAME_LIST = GAME_IDS.map((id) => ({ id, info: getGame(id).info, Icon: ICONS[id] }));
