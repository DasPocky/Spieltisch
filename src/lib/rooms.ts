/**
 * Raumliste für den Start-Tab: „Deine Räume“ (gespeicherte Zugänge dieses Handys) und „Offene Räume“
 * (für alle bzw. die eigene Gruppe sichtbar). Einmal geladen, für alle Ansichten geteilt.
 */
import { useEffect, useState } from "react";
import { sanitizeCard, type RoomCard } from "@shared/platform/directory";
import { ROOM_CODE_RE } from "@shared/platform/protocol";
import { credsKey, readJSON, remove, type RoomCreds } from "./storage";
import { myGroups } from "./group";

export interface RoomLists { mine: RoomCard[]; open: RoomCard[]; loaded: boolean }

let lists: RoomLists = { mine: [], open: [], loaded: false };
const listeners = new Set<(l: RoomLists) => void>();
const set = (l: RoomLists) => { lists = l; listeners.forEach((f) => f(l)); };

/** Gespeicherte Zugänge: jeder Raum, in dem dieses Handy schon war (bis „Raum verlassen“) */
function savedRooms(): (RoomCreds & { code: string })[] {
  const out: (RoomCreds & { code: string })[] = [];
  try {
    for (const k of Object.keys(localStorage)) {
      const code = k.startsWith("spieltisch:room:") ? k.slice("spieltisch:room:".length) : "";
      const c = ROOM_CODE_RE.test(code) ? readJSON<RoomCreds>(k) : null;
      if (c?.playerId && c.token) out.push({ code, playerId: c.playerId, token: c.token });
    }
  } catch { /* ohne Speicher keine eigenen Räume */ }
  return out.slice(0, 20);
}

let loading: Promise<RoomLists> | null = null;

/** Beide Listen frisch holen. Räume, die es nicht mehr gibt (oder aus denen man entfernt wurde), vergisst das Handy. */
export function loadRooms(): Promise<RoomLists> {
  if (loading) return loading;
  loading = (async () => {
    const saved = savedRooms();
    const groups = myGroups().codes.join(",");
    const [mine, open] = await Promise.all([
      saved.length
        ? fetch("/api/rooms/mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rooms: saved }) })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ rooms?: unknown[]; gone?: string[] } | null>
        : Promise.resolve({ rooms: [], gone: [] }),
      fetch(`/api/rooms/open${groups ? `?groups=${groups}` : ""}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ rooms?: unknown[] } | null>,
    ]);
    for (const code of mine?.gone ?? []) if (ROOM_CODE_RE.test(code)) remove(credsKey(code));
    const mineCards = mine ? (mine.rooms ?? []).map(sanitizeCard).filter((c): c is RoomCard => !!c) : lists.mine;
    const codes = new Set(mineCards.map((c) => c.code));
    const openCards = open ? (open.rooms ?? []).map(sanitizeCard).filter((c): c is RoomCard => !!c && !codes.has(c.code)) : lists.open;
    set({ mine: mineCards, open: openCards, loaded: true });
    return lists;
  })().finally(() => { loading = null; });
  return loading;
}

/** Raumlisten; lädt beim Öffnen, bei Rückkehr in die App und alle 20 Sekunden, solange sichtbar */
export function useRooms(enabled = true): RoomLists {
  const [l, setL] = useState(lists);
  useEffect(() => {
    listeners.add(setL);
    if (!enabled) return () => { listeners.delete(setL); };
    void loadRooms();
    const t = setInterval(() => { if (document.visibilityState === "visible") void loadRooms(); }, 20_000);
    const wake = () => { if (document.visibilityState === "visible") void loadRooms(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => { listeners.delete(setL); clearInterval(t); document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); };
  }, [enabled]);
  return l;
}
