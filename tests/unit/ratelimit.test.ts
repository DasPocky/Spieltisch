import { describe, expect, it, vi } from "vitest";
import { allowed, countFail, GLOBAL_LIMIT_MS, limited, type RateLimit } from "../../worker/http";

// Ratenbremse der Sicherheitswege: was gilt, wenn die globale Bremse fehlt, ausfällt oder hängt?
const fails = (bucket: string, ip: string, n: number) => { for (let i = 0; i < n; i++) countFail(bucket, ip); };

describe("Ratenbremse", () => {
  it("Globale Bremse sagt nein: gesperrt", async () => {
    const no: RateLimit = { limit: async () => ({ success: false }) };
    expect(await limited(no, "t1", "1.1.1.1", 10)).toBe(false);
    expect(await limited({ limit: async () => ({ success: true }) }, "t1", "1.1.1.1", 10)).toBe(true);
  });

  it("Ohne globale Bremse gilt die lokale: nach maxFails Fehlversuchen zu", async () => {
    expect(await limited(undefined, "t2", "2.2.2.2", 3)).toBe(true);
    fails("t2", "2.2.2.2", 3);
    expect(await limited(undefined, "t2", "2.2.2.2", 3)).toBe(false);
    // andere Adresse und anderer Weg sind nicht betroffen
    expect(await limited(undefined, "t2", "2.2.2.3", 3)).toBe(true);
    expect(await limited(undefined, "t2b", "2.2.2.2", 3)).toBe(true);
  });

  it("Globale Bremse wirft: offen, aber die lokale Grenze bleibt", async () => {
    const broken: RateLimit = { limit: async () => { throw new Error("weg"); } };
    expect(await limited(broken, "t3", "3.3.3.3", 2)).toBe(true);
    fails("t3", "3.3.3.3", 2);
    expect(await limited(broken, "t3", "3.3.3.3", 2)).toBe(false);
  });

  it("Globale Bremse hängt: nach kurzer Zeit nur die lokale (die Anfrage bleibt nicht hängen)", async () => {
    vi.useFakeTimers();
    try {
      const stuck: RateLimit = { limit: () => new Promise(() => {}) };
      const p = limited(stuck, "t4", "4.4.4.4", 2);
      await vi.advanceTimersByTimeAsync(GLOBAL_LIMIT_MS + 10);
      expect(await p).toBe(true);
      fails("t4", "4.4.4.4", 2);
      expect(await limited(stuck, "t4", "4.4.4.4", 2)).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it("Fehlversuche verfallen nach 10 Minuten", async () => {
    vi.useFakeTimers();
    try {
      fails("t5", "5.5.5.5", 2);
      expect(await limited(undefined, "t5", "5.5.5.5", 2)).toBe(false);
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      expect(await limited(undefined, "t5", "5.5.5.5", 2)).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it("Lokale Anfragegrenze: höchstens max je Zeitfenster", () => {
    for (let i = 0; i < 5; i++) expect(allowed("t6", "6.6.6.6", 5)).toBe(true);
    expect(allowed("t6", "6.6.6.6", 5)).toBe(false);
  });
});
