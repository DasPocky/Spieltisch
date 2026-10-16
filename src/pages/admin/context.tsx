import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AccessConfig, GameDefaults, SiteConfig } from "@shared/platform/access";
import { setSiteConfig } from "@/hooks/useSiteConfig";
import { AuthError, toAccess, type Api } from "./shared";

/** Sitzungs-Token des Admins – so bleibt man auch nach dem Neuladen angemeldet */
const TOKEN_KEY = "spieltisch:admin";
/** Dieses Gerät gehört einem Admin: Der Tab „Verwaltung“ bleibt, auch wenn die Sitzung abläuft */
const DEVICE_KEY = "spieltisch:admin-device";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* egal */ } };

export const adminToken = () => read(TOKEN_KEY);
export const isAdminDevice = () => read(DEVICE_KEY) === "1";

const deviceListeners = new Set<() => void>();
function setAdminDevice(on: boolean) {
  write(DEVICE_KEY, on ? "1" : null);
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

interface AdminState {
  config: SiteConfig;
  api: Api;
  /** Einstellungen sofort speichern; der Hinweis bietet „Rückgängig“ an */
  save: (patch: Partial<AccessConfig>, label?: string) => Promise<void>;
  saveDefaults: (defaults: GameDefaults, label?: string) => Promise<void>;
  setConfig: (c: SiteConfig) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AdminState | null>(null);
export function useAdmin(): AdminState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin außerhalb des Admin-Bereichs");
  return c;
}

/** Anmeldung, Einstellungen und Speichern für alle Admin-Seiten */
export function AdminProvider({ children, login }: { children: ReactNode; login: (props: { onLogin: (pw: string) => Promise<string | null>; checking: boolean; message: string | null }) => ReactNode }) {
  const [token, setToken] = useState(adminToken);
  const [config, setConfigState] = useState<SiteConfig | null>(null);
  const [checking, setChecking] = useState(() => !!adminToken());
  const [message, setMessage] = useState<string | null>(null);
  const configRef = useRef<SiteConfig | null>(null);
  configRef.current = config;

  const setConfig = useCallback((c: SiteConfig) => { setConfigState(c); setSiteConfig(c); }, []);

  const signOut = useCallback((text?: string) => {
    write(TOKEN_KEY, null); setToken(null); setConfigState(null);
    if (text) setMessage(text);
  }, []);

  const api = useCallback<Api>(async (path, body) => {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    if (!res) throw new Error("Keine Verbindung zum Server.");
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { signOut(data.error ?? "Bitte melde dich neu an."); throw new AuthError(data.error); }
    if (!res.ok || data.ok === false) throw new Error(data.error ?? "Das ging gerade nicht.");
    return data;
  }, [token, signOut]);

  // Gemerkte Sitzung prüfen
  useEffect(() => {
    if (!token || config) return;
    api<{ config: SiteConfig }>("/api/admin", {})
      .then((r) => { setConfigState(r.config); if (!isAdminDevice()) setAdminDevice(true); })
      .catch((e) => { if (!(e instanceof AuthError)) setMessage((e as Error).message); })
      .finally(() => setChecking(false));
  }, [token, config, api]);

  const onLogin = async (password: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const r = (await res.json()) as { ok: boolean; error?: string; config?: SiteConfig; token?: string };
      if (!r.ok || !r.config) return r.error ?? "Anmeldung fehlgeschlagen.";
      if (r.token) { write(TOKEN_KEY, r.token); setToken(r.token); }
      setAdminDevice(true);
      setMessage(null);
      setConfigState(r.config);
      return null;
    } catch { return "Keine Verbindung zum Server."; }
  };

  const logout = async () => {
    if (token) await fetch("/api/admin/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    // Abmelden heißt: dieses Gerät ist kein Admin-Gerät mehr – der Tab verschwindet
    setAdminDevice(false);
    signOut();
  };

  const save = async (patch: Partial<AccessConfig>, label = "Gespeichert") => {
    const before = configRef.current;
    if (!before) return;
    // Sofort zeigen, dann speichern; schlägt es fehl, den alten Stand zurückholen
    setConfig({ ...before, ...patch });
    try {
      const r = await api<{ config: SiteConfig }>("/api/admin", { config: { ...toAccess(before), ...patch } });
      setConfig(r.config);
      const undo = Object.fromEntries(Object.keys(patch).map((k) => [k, toAccess(before)[k as keyof AccessConfig]])) as Partial<AccessConfig>;
      toast(label, { action: { label: "Rückgängig", onClick: () => { void save(undo, "Zurückgenommen"); } } });
    } catch (e) {
      setConfig(before);
      if (!(e instanceof AuthError)) toast((e as Error).message);
    }
  };

  const saveDefaults = async (defaults: GameDefaults, label = "Gespeichert") => {
    const before = configRef.current;
    if (!before) return;
    setConfig({ ...before, defaults });
    try {
      const r = await api<{ config: SiteConfig }>("/api/admin", { defaults });
      setConfig(r.config);
      toast(label, { action: { label: "Rückgängig", onClick: () => { void saveDefaults(before.defaults, "Zurückgenommen"); } } });
    } catch (e) {
      setConfig(before);
      if (!(e instanceof AuthError)) toast((e as Error).message);
    }
  };

  if (!config) return <>{login({ onLogin, checking, message })}</>;
  return <Ctx.Provider value={{ config, api, save, saveDefaults, setConfig, logout }}>{children}</Ctx.Provider>;
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
