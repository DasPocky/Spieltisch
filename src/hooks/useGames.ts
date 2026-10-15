import { accessFor } from "@shared/platform/access";
import { GAME_LIST } from "@/games";
import { useOnline } from "./useOnline";
import { savedAccess, useSiteConfig } from "./useSiteConfig";

/**
 * Was Start- und Spiele-Tab gemeinsam brauchen: freigegebene Spiele, Schlösser und welche Wege gerade gehen.
 * Abgeschaltete Spiele fehlen, Spiele hinter Zugangscode sind „locked“, bis der Code auf dem Gerät liegt.
 */
export function useGames() {
  const config = useSiteConfig();
  const games = GAME_LIST.filter(({ id }) => !config || accessFor(config, id) !== "off");
  const ids: string[] = games.map((g) => g.id);
  const locked = (id: string) => !!config && accessFor(config, id) === "code" && !savedAccess();
  const features = config?.features;
  const netOnline = useOnline();
  // Admin kann Online-Räume abschalten – dann geht nur „Ein Handy für alle“
  const onlineOff = features?.online === false;
  const online = netOnline && !onlineOff;
  // „Ein Handy für alle“ ist standardmäßig aus (Admin kann es einschalten)
  const localOn = features?.local === true || onlineOff;
  return { config, games, ids, locked, features, onlineOff, online, localOn };
}
