import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { decodeMove, encodeMove, movePlan, MOVE_ANCHOR } from "../../shared/platform/move";
import { isNavigation, isOldHost, movePage, retireServiceWorker } from "../../worker/move";

/** Führt das Skript der Umzugsseite mit einem erfundenen Speicher aus und liefert das Ziel */
async function follow(store: Record<string, string>, target = "https://spieltisch.endlab.de/r/ABCDE?x=1") {
  const res = movePage(target);
  const html = await res.text();
  const script = /<script nonce="[^"]+">([\s\S]*)<\/script>/.exec(html)![1];
  const keys = Object.keys(store);
  let went = "";
  runInNewContext(script, {
    localStorage: { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => store[k] ?? null },
    location: { replace: (u: string) => { went = u; } },
    TextEncoder, btoa, JSON,
  });
  return { res, went };
}

describe("Umzug nach spieltisch.endlab.de", () => {
  it("Die Umzugsseite packt nur Spieltisch-Einträge ein, und die neue Adresse liest sie unverändert", async () => {
    const { res, went } = await follow({ "spieltisch:profile": "p-1", "spieltisch:name": "Jörg 🎲", "abfahrt:favorites": "[]" });
    expect(res.headers.get("content-security-policy")).toMatch(/script-src 'nonce-/);
    const [base, hash] = went.split("#umzug=");
    expect(base).toBe("https://spieltisch.endlab.de/r/ABCDE?x=1");
    expect(decodeMove(hash)).toEqual({ "spieltisch:profile": "p-1", "spieltisch:name": "Jörg 🎲" });
  });

  it("Ohne Daten leitet die Seite ohne Anker weiter", async () => {
    expect((await follow({})).went).toBe("https://spieltisch.endlab.de/r/ABCDE?x=1");
  });

  it("Ein Ziel mit </script> bricht nicht aus dem Skript aus", async () => {
    const html = await movePage("https://spieltisch.endlab.de/</script><b>").text();
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("Liegt schon ein Profil auf der neuen Adresse, wird nichts übernommen", () => {
    const has = (k: string) => k === MOVE_ANCHOR;
    expect(movePlan({ [MOVE_ANCHOR]: "alt", "spieltisch:name": "A" }, has)).toEqual([]);
  });

  it("Sonst nur, was auf der neuen Adresse fehlt", () => {
    const has = (k: string) => k === "spieltisch:theme";
    expect(movePlan({ [MOVE_ANCHOR]: "p", "spieltisch:theme": "alt" }, has)).toEqual([[MOVE_ANCHOR, "p"]]);
  });

  it("Fremde Schlüssel, falsche Typen und Unsinn werden verworfen", () => {
    expect(decodeMove(encodeMove({ "abfahrt:x": "1", "spieltisch:a": "2" }))).toEqual({ "spieltisch:a": "2" });
    expect(decodeMove("%%%")).toBeNull();
    expect(decodeMove(encodeMove({}).slice(0, 1))).toBeNull();
  });

  it("Nur Seitenaufrufe ziehen um, Dateien und fetch nicht", () => {
    const req = (h: Record<string, string>, method = "GET") => new Request("https://endlab.de/spieltisch/", { method, headers: h });
    expect(isNavigation(req({ "sec-fetch-mode": "navigate" }))).toBe(true);
    expect(isNavigation(req({ "sec-fetch-mode": "cors", accept: "text/html" }))).toBe(false);
    expect(isNavigation(req({ accept: "text/html,*/*" }))).toBe(true);
    expect(isNavigation(req({ accept: "text/html" }, "POST"))).toBe(false);
  });

  it("Umziehen nur von den früheren Adressen – Vorschauen und die neue Adresse bleiben", () => {
    expect(isOldHost("endlab.de")).toBe(true);
    expect(isOldHost("spieltisch.bjoern-ef9.workers.dev")).toBe(true);
    expect(isOldHost("claude-xyz-spieltisch.bjoern-ef9.workers.dev")).toBe(false);
    expect(isOldHost("spieltisch.endlab.de")).toBe(false);
    expect(isOldHost("localhost")).toBe(false);
  });

  it("Der alte Service Worker räumt sich selbst ab", async () => {
    const js = await retireServiceWorker().text();
    expect(js).toContain("unregister()");
    expect(js).toContain("navigate(");
  });
});
