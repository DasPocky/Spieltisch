import { cleanName } from "@shared/platform/room";
import { forgetAccess, savedAccess } from "@/hooks/useSiteConfig";
import { navigate } from "@/hooks/useRoute";
import { NAME_KEY, setPendingJoin } from "./storage";

/** Der Host soll in der neuen Lobby zuerst das Spiel wählen */
export const pickGameKey = (code: string) => `spieltisch:pick:${code}`;

/** Legt einen Online-Raum an und geht hinein. Wirft mit einer lesbaren Meldung, wenn es nicht klappt. */
export async function createRoom(name: string, pin: string, gameId: string, pickGame = false): Promise<void> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin, game: gameId, access: savedAccess() ?? undefined }),
  }).catch(() => null);
  if (!res) throw new Error("Keine Verbindung zum Server.");
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  // Zugangscode inzwischen geändert: vergessen, damit er neu abgefragt wird
  if (res.status === 403 && data.code === "access") forgetAccess();
  if (!res.ok || !data.code) throw new Error(data.error ?? "Raum konnte nicht erstellt werden.");
  try { localStorage.setItem(NAME_KEY, cleanName(name)); } catch { /* egal */ }
  setPendingJoin(data.code, { name: cleanName(name), pin });
  if (pickGame) try { sessionStorage.setItem(pickGameKey(data.code), "1"); } catch { /* egal */ }
  navigate(`/r/${data.code}`);
}
