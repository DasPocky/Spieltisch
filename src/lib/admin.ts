import { useEffect, useState } from "react";
import { readStr, writeStr } from "./storage";

/**
 * Admin-Gerät und Sitzung: wird von der Tab-Leiste, dem Profil und dem Entwickler-Modus gebraucht,
 * deshalb hier unten in lib – die Seiten der Verwaltung bauen darauf auf.
 */

/** Sitzungs-Token des Admins – so bleibt man auch nach dem Neuladen angemeldet */
export const TOKEN_KEY = "spieltisch:admin";
/** Dieses Gerät gehört einem Admin: Der Tab „Verwaltung“ bleibt, auch wenn die Sitzung abläuft */
export const DEVICE_KEY = "spieltisch:admin-device";

export const adminToken = () => readStr(TOKEN_KEY);
export const isAdminDevice = () => readStr(DEVICE_KEY) === "1";

const deviceListeners = new Set<() => void>();
export function setAdminDevice(on: boolean) {
  writeStr(DEVICE_KEY, on ? "1" : null);
  deviceListeners.forEach((l) => l());
}
/** Für die Tab-Leiste: ist dieses Gerät ein Admin-Gerät? (ändert sich beim An- und Abmelden) */
export function useAdminDevice(): boolean {
  const [on, setOn] = useState(isAdminDevice);
  useEffect(() => {
    const l = () => setOn(isAdminDevice());
    deviceListeners.add(l);
    return () => { deviceListeners.delete(l); };
  }, []);
  return on;
}

/**
 * Hinweis-Punkt am Tab „Verwaltung“: zählt, was Aufmerksamkeit braucht (z. B. Räume mit PIN-Sperre).
 * Nur auf Admin-Geräten mit gültiger Sitzung, gelegentlich neu geladen.
 */
export function useAdminAttention(on: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const token = adminToken();
    if (!on || !token) { setN(0); return; }
    let alive = true;
    const load = () => fetch("/api/admin/rooms", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rooms?: { locked?: boolean }[] } | null) => { if (alive && d?.rooms) setN(d.rooms.filter((r) => r.locked).length); })
      .catch(() => { /* still – beim nächsten Mal */ });
    void load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [on]);
  return n;
}
