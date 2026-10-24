/**
 * Am Rechner am Tisch mitspielen: auf großen Bildschirmen zeigt die laufende Partie den Tisch (3D oder flach)
 * aus eigener Sicht, die eigene Hand liegt offen darunter. Gilt für Spiele mit Spielweise „Am Rechner“;
 * umschaltbar auf die klassische Ansicht (wie am Handy, nur breiter). Die Wahl gilt je Gerät.
 */
import { useSyncExternalStore } from "react";
import { modeAllowed } from "@shared/platform/modes";
import type { RoomState } from "@shared/platform/room";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useAdminDevice } from "@/lib/admin";
import { readStr, writeStr } from "@/lib/storage";
import { createStore } from "@/lib/store";

const KEY = "spieltisch:deskView";
const choice = createStore<"table" | "classic">(readStr(KEY) === "classic" ? "classic" : "table");
export const setDeskView = (v: "table" | "classic") => { writeStr(KEY, v); choice.set(v); };
export const useDeskView = choice.use;

// Karten nur am Begleit-Handy: der Rechner zeigt den Tisch für alle, die eigene Hand bleibt privat (je Gerät)
const PRIVATE_KEY = "spieltisch:deskPrivate";
const priv = createStore<boolean>(readStr(PRIVATE_KEY) === "1");
export const setDeskPrivate = (v: boolean) => { writeStr(PRIVATE_KEY, v ? "1" : "0"); priv.set(v); };
export const useDeskPrivate = priv.use;

const WIDE = "(min-width: 1024px) and (min-height: 600px)";
const wideNow = () => typeof matchMedia === "function" && matchMedia(WIDE).matches;
function useWide(): boolean {
  return useSyncExternalStore((l) => {
    if (typeof matchMedia !== "function") return () => undefined;
    const m = matchMedia(WIDE); m.addEventListener("change", l); return () => m.removeEventListener("change", l);
  }, wideNow);
}

/** Kann diese Partie hier am Tisch gespielt werden? (`possible`) – und ist das gerade gewählt? (`on`) */
export function useDesk(room: RoomState, me: string | null): { possible: boolean; on: boolean; /** großer Bildschirm */ wide: boolean } {
  const config = useSiteConfig();
  const admin = useAdminDevice();
  const wide = useWide();
  const view = useDeskView();
  const possible = wide && me !== null && room.phase === "playing" && !!room.game && modeAllowed(config?.modes, room.gameId, "desk", admin);
  return { possible, on: possible && view === "table", wide };
}
