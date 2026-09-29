import { expect, type Page } from "@playwright/test";

export const SHOTS = "test-results/screens";

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Die Seite darf auf dem Handy nicht scrollen. */
export async function expectNoScroll(page: Page) {
  const { scroll, height } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, height: window.innerHeight }));
  expect(scroll, "Seite ist höher als der Bildschirm").toBeLessThanOrEqual(height + 1);
}

/** Lokales Tutto mit Spielern starten */
export async function startLocalTutto(page: Page, names: string[]) {
  await page.goto("/spiel/tutto/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
}
