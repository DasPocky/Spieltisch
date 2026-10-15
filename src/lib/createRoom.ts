import { cleanName } from "@shared/platform/room";
import type { RoomAccess } from "@shared/platform/directory";
import { forgetAccess, savedAccess } from "@/hooks/useSiteConfig";
import { navigate } from "@/hooks/useRoute";
import { NAME_KEY, setPendingJoin } from "./storage";

/** Der Host soll in der neuen Lobby zuerst das Spiel wählen */
export const pickGameKey = (code: string) => `spieltisch:pick:${code}`;

export interface NewRoom {
  name: string;
  pin: string;
  gameId: string;
  /** Lobby öffnet gleich die Spielauswahl */
  pickGame?: boolean;
  /** Erst einmal nur Treffpunkt */
  meet?: boolean;
  /** Raumname, Sichtbarkeit, Einlass, Lebensdauer */
  room?: Partial<RoomAccess>;
  /** Aus einem Blatt heraus: dessen Verlaufseintrag ersetzen (siehe useBackClose) */
  replace?: boolean;
}

/** Legt einen Online-Raum an und geht hinein. Wirft mit einer lesbaren Meldung, wenn es nicht klappt. */
export async function createRoom({ name, pin, gameId, pickGame = false, meet = false, room, replace = false }: NewRoom): Promise<void> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin, game: gameId, access: savedAccess() ?? undefined, room }),
  }).catch(() => null);
  if (!res) throw new Error("Keine Verbindung zum Server.");
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  // Zugangscode inzwischen geändert: vergessen, damit er neu abgefragt wird
  if (res.status === 403 && data.code === "access") forgetAccess();
  if (!res.ok || !data.code) throw new Error(data.error ?? "Raum konnte nicht erstellt werden.");
  try { localStorage.setItem(NAME_KEY, cleanName(name)); } catch { /* egal */ }
  setPendingJoin(data.code, { name: cleanName(name), pin });
  if (pickGame && !meet) try { sessionStorage.setItem(pickGameKey(data.code), "1"); } catch { /* egal */ }
  // Treffpunkt: erst reden und sehen, gespielt wird später (siehe Meet)
  if (meet) try { sessionStorage.setItem(`spieltisch:meet:${data.code}`, "1"); } catch { /* egal */ }
  navigate(`/r/${data.code}`, replace);
}
