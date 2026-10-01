import { useEffect, useState } from "react";
import { DEFAULT_CONFIG, type SiteConfig } from "@shared/platform/access";
import { readJSON, remove, writeJSON } from "@/lib/storage";

/**
 * Admin-Freigaben vom Server – einmal pro Seitenaufruf geladen und für alle Komponenten geteilt.
 * Ohne Verbindung (z. B. offline als App) gilt alles als offen; online prüft der Server ohnehin selbst.
 */
let cache: SiteConfig | null = null;
let loading: Promise<SiteConfig> | null = null;
const listeners = new Set<(c: SiteConfig) => void>();

function load(): Promise<SiteConfig> {
  loading ??= fetch("/api/config", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<SiteConfig>) : DEFAULT_CONFIG))
    .catch(() => DEFAULT_CONFIG)
    .then((c) => { cache = { ...DEFAULT_CONFIG, ...c }; listeners.forEach((l) => l(cache!)); return cache; });
  return loading;
}

/** Was gerade bekannt ist (null, solange noch nicht geladen) – lädt bei Bedarf nach */
export function siteConfigNow(): SiteConfig | null {
  if (!cache) void load();
  return cache;
}

/** Nach dem Speichern im Admin-Bereich: neue Werte sofort übernehmen */
export function setSiteConfig(c: SiteConfig) {
  cache = c;
  listeners.forEach((l) => l(c));
}

export function useSiteConfig(): SiteConfig | null {
  const [config, setConfig] = useState(cache);
  useEffect(() => {
    listeners.add(setConfig);
    if (!cache) load();
    return () => { listeners.delete(setConfig); };
  }, []);
  return config;
}

/** Zugangscode: einmal richtig eingegeben, merkt sich das Gerät ihn */
const ACCESS_KEY = "spieltisch:access";
export const savedAccess = () => readJSON<string>(ACCESS_KEY);
export const forgetAccess = () => remove(ACCESS_KEY);

export async function unlock(code: string): Promise<boolean> {
  try {
    const res = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return false;
    writeJSON(ACCESS_KEY, code);
    return true;
  } catch {
    return false;
  }
}
