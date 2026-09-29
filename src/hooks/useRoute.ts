import { useEffect, useState } from "react";
import { isGameId } from "@shared/games";

export type Route =
  | { name: "home" }
  | { name: "game"; gameId: string }
  | { name: "local"; gameId: string }
  | { name: "room"; code: string }
  | { name: "admin" };

function parse(path: string): Route {
  if (/^\/admin\/?$/.test(path)) return { name: "admin" };
  const room = path.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
  if (room) return { name: "room", code: room[1].toUpperCase() };
  const game = path.match(/^\/spiel\/([a-z0-9-]+)(\/lokal)?\/?$/);
  if (game && isGameId(game[1])) return { name: game[2] ? "local" : "game", gameId: game[1] };
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
