import { useEffect, useState } from "react";
import { isGameId } from "@shared/games";
import { LOCAL_GAME_KEY } from "@/lib/storage";

export type Route =
  | { name: "home" }
  | { name: "local" }
  | { name: "room"; code: string }
  | { name: "admin" }
  | { name: "profile" }
  | { name: "transfer"; code: string }
  | { name: "groups" }
  | { name: "group"; code: string }
  | { name: "gallery" };

function parse(path: string): Route {
  if (/^\/admin\/?$/.test(path)) return { name: "admin" };
  if (/^\/profil\/?$/.test(path)) return { name: "profile" };
  const transfer = path.match(/^\/profil\/uebernehmen\/([A-Za-z0-9-]{8,9})\/?$/);
  if (transfer) return { name: "transfer", code: transfer[1].toUpperCase().replace(/-/g, "") };
  if (/^\/gruppe\/?$/.test(path)) return { name: "groups" };
  const group = path.match(/^\/g\/([A-Za-z0-9]{6})\/?$/);
  if (group) return { name: "group", code: group[1].toUpperCase() };
  if (import.meta.env.DEV && path === "/dev/karten") return { name: "gallery" };
  const room = path.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
  if (room) return { name: "room", code: room[1].toUpperCase() };
  if (/^\/lokal\/?$/.test(path)) return { name: "local" };
  const game = path.match(/^\/spiel\/([a-z0-9-]+)(\/lokal)?\/?$/);
  // Alte Spielseite und alter Link zur lokalen Partie: Spiel vormerken, weiter zur lokalen Lobby
  if (game && isGameId(game[1])) {
    try { localStorage.setItem(LOCAL_GAME_KEY, game[1]); } catch { /* egal */ }
    history.replaceState(null, "", "/lokal");
    return { name: "local" };
  }
  return { name: "home" };
}

export function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.pathname));
  useEffect(() => {
    const on = () => setRoute(parse(location.pathname));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return route;
}
