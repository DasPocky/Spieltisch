import { expect, test } from "@playwright/test";
import { encodeMove } from "../../shared/platform/move";

/** Ein echtes altes Gerät kennt die Neustart-Kennung des Servers schon – sonst räumt die App beim Start auf */
async function epoch(request: import("@playwright/test").APIRequestContext): Promise<Record<string, string>> {
  const c = (await (await request.get("/api/config")).json()) as { epoch?: string };
  return c.epoch ? { "spieltisch:epoch": c.epoch } : {};
}

test("Umzug: Daten aus dem Anker landen im Speicher, der Anker verschwindet sofort", async ({ page, request }) => {
  const packed = encodeMove({ ...(await epoch(request)), "spieltisch:name": "Jörg", "spieltisch:theme": "papier" });
  await page.goto(`/r/ABCDE#umzug=${packed}`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  expect(await page.evaluate(() => localStorage.getItem("spieltisch:name"))).toBe("Jörg");
  expect(await page.evaluate(() => localStorage.getItem("spieltisch:theme"))).toBe("papier");
});

test("Umzug: liegt schon ein Profil auf dem Gerät, bleibt es unberührt", async ({ page, request }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.setItem("spieltisch:profile", "hier"); localStorage.setItem("spieltisch:name", "Hier"); });
  await page.goto("about:blank");
  await page.goto(`/#umzug=${encodeMove({ ...(await epoch(request)), "spieltisch:profile": "alt", "spieltisch:name": "Alt", "spieltisch:theme": "x" })}`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  // Das Profil schreibt die App selbst neu; entscheidend ist, dass nichts vom alten Gerät hineingemischt wurde
  expect(await page.evaluate(() => localStorage.getItem("spieltisch:profile"))).not.toBe("alt");
  expect(await page.evaluate(() => [localStorage.getItem("spieltisch:name"), localStorage.getItem("spieltisch:theme")])).toEqual(["Hier", null]);
});
