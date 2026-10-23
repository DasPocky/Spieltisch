import { useEffect, useState } from "react";
import { isGameId } from "@shared/games";
import { renamedGameId } from "@shared/games/renamed";
import { SET_KINDS, type SetKind } from "@shared/platform/cardsets";
import { LOCAL_GAME_KEY } from "@/lib/storage";

/** Bereiche der Verwaltung: /admin, /admin/live … */
export type AdminSection = "start" | "live" | "statistik" | "spiele" | "kartensets" | "leute" | "einstellungen" | "entwickler";

export type Route =
  | { name: "home" }
  | { name: "games" }
  | { name: "local" }
  | { name: "room"; code: string }
  | { name: "admin"; section: AdminSection }
  | { name: "profile" }
  /** Eigene Kartensets: Liste, ein Set, ein neues Set einer Art */
  | { name: "sets"; id?: string; kind?: SetKind }
  | { name: "transfer"; code: string }
  | { name: "groups" }
  | { name: "group"; code: string }
  | { name: "gallery" }
  /** Moderator-Vorschau (nur Verwaltung) */
  | { name: "moderator" }
  /** Großer Tisch: aufbauen bzw. ein Raum auf dem großen Bildschirm */
  | { name: "tableSetup" }
  | { name: "table"; code: string };

function parse(path: string): Route {
  const admin = path.match(/^\/admin(?:\/(live|statistik|spiele|kartensets|leute|einstellungen|entwickler))?\/?$/);
  if (admin) return { name: "admin", section: (admin[1] ?? "start") as AdminSection };
  if (/^\/spiele\/?$/.test(path)) return { name: "games" };
  if (/^\/profil\/?$/.test(path)) return { name: "profile" };
  const sets = path.match(/^\/profil\/sets(?:\/(?:neu\/([a-z]+)|([a-z0-9]{12})))?\/?$/);
  if (sets) {
    if (sets[1]) return SET_KINDS.some((k) => k.id === sets[1]) ? { name: "sets", kind: sets[1] as SetKind } : { name: "sets" };
    return sets[2] ? { name: "sets", id: sets[2] } : { name: "sets" };
  }
  const transfer = path.match(/^\/profil\/uebernehmen\/([A-Za-z0-9-]{8,9})\/?$/);
  if (transfer) return { name: "transfer", code: transfer[1].toUpperCase().replace(/-/g, "") };
  if (/^\/gruppe\/?$/.test(path)) return { name: "groups" };
  const group = path.match(/^\/g\/([A-Za-z0-9]{6})\/?$/);
  if (group) return { name: "group", code: group[1].toUpperCase() };
  if (import.meta.env.DEV && path === "/dev/karten") return { name: "gallery" };
  if (/^\/moderator\/?$/.test(path)) return { name: "moderator" };
  const room = path.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
  if (room) return { name: "room", code: room[1].toUpperCase() };
  if (/^\/tisch\/?$/.test(path)) return { name: "tableSetup" };
  const table = path.match(/^\/tisch\/([A-Za-z0-9]{5})\/?$/);
  if (table) return { name: "table", code: table[1].toUpperCase() };
  if (/^\/lokal\/?$/.test(path)) return { name: "local" };
  const game = path.match(/^\/spiel\/([a-z0-9-]+)(\/lokal)?\/?$/);
  // Alte Spielseite und alter Link zur lokalen Partie: Spiel vormerken, weiter zur lokalen Lobby
  // (auch Links mit der früheren Kennung eines umbenannten Spiels)
  const linked = game ? renamedGameId(game[1]) : null;
  if (linked && isGameId(linked)) {
    try { localStorage.setItem(LOCAL_GAME_KEY, linked); } catch { /* egal */ }
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
