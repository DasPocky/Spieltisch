import { describe, expect, it, vi } from "vitest";

// Geräteschlüssel am Profil, auch für alte Profile von vor den Schlüsseln (nur die gespeicherten Felder zählen)
vi.mock("cloudflare:workers", () => ({ DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));
// Worker-Objekt nur zur Laufzeit laden: das Test-Projekt hat keine Worker-Typen (eigenes tsconfig)
interface Profile { owns(key: string): Promise<boolean>; addKey(): Promise<string> }
const PROFILES = "../../worker/profiles";
const { ProfileStore } = (await import(/* @vite-ignore */ PROFILES)) as { ProfileStore: new (ctx: unknown, env: unknown) => Profile };

function store(data: Record<string, unknown>) {
  const map = new Map(Object.entries(data));
  const ctx = {
    storage: {
      get: async (k: string) => map.get(k),
      put: async (k: string, v: unknown) => { map.set(k, v); },
      setAlarm: async () => {},
      getAlarm: async () => null,
    },
    blockConcurrencyWhile: async (f: () => Promise<unknown>) => f(),
  };
  return { map, profile: new ProfileStore(ctx, {}) };
}
const KEY_A = "a".repeat(48), KEY_B = "b".repeat(48);

describe("Profil-Schlüssel", () => {
  it("Altes Profil ohne Schlüssel übernimmt den ersten gültigen – danach nur noch bekannte", async () => {
    const { profile, map } = store({ stats: { name: "Alt" } });
    expect(await profile.owns("kein-schluessel")).toBe(false);
    expect(map.get("keys")).toBeUndefined();
    expect(await profile.owns(KEY_A)).toBe(true);
    expect((map.get("keys") as string[]).length).toBe(1);
    expect(await profile.owns(KEY_B)).toBe(false);
    expect(await profile.owns(KEY_A)).toBe(true);
  });

  it("Weiteres Gerät per Übertragung: neuer Schlüssel gilt, der alte bleibt", async () => {
    const { profile } = store({});
    expect(await profile.owns(KEY_A)).toBe(true);
    const fresh = await profile.addKey();
    expect(await profile.owns(fresh)).toBe(true);
    expect(await profile.owns(KEY_A)).toBe(true);
    expect(await profile.owns(KEY_B)).toBe(false);
  });
});
