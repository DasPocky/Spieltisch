import { expect, type Browser, type Page } from "@playwright/test";

/** Eigener Ordner – Playwright leert test-results bei jedem Lauf */
export const SHOTS = "screenshots";

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Die Seite darf auf dem Handy nicht scrollen. */
export async function expectNoScroll(page: Page) {
  const { scroll, height, scrollW, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight, height: window.innerHeight,
    scrollW: document.documentElement.scrollWidth, width: window.innerWidth,
  }));
  expect(scroll, "Seite ist höher als der Bildschirm").toBeLessThanOrEqual(height + 1);
  expect(scrollW, "Seite ist breiter als der Bildschirm").toBeLessThanOrEqual(width + 1);
}

/** Element liegt vollständig im sichtbaren Bereich (nichts abgeschnitten) */
export async function expectInView(page: Page, locator: import("@playwright/test").Locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, "Element nicht sichtbar").not.toBeNull();
  expect(box!.y + box!.height, "Element unten abgeschnitten").toBeLessThanOrEqual(vp.height + 1);
  expect(box!.x + box!.width, "Element rechts abgeschnitten").toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y, "Element oben abgeschnitten").toBeGreaterThanOrEqual(-1);
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

export async function newPhone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
  return ctx.newPage();
}

/** Raum für ein Spiel erstellen, gibt den Code zurück */
export async function createRoom(host: Page, gameId: string, name: string, pin: string): Promise<string> {
  await host.goto(`/spiel/${gameId}`);
  await host.getByLabel("Dein Name").fill(name);
  await host.getByLabel("PIN (4–8 Ziffern)").fill(pin);
  await host.getByRole("button", { name: "Raum erstellen" }).click();
  await expect(host).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  return (await host.getByTestId("room-code").textContent())!.trim();
}

export async function joinRoom(page: Page, code: string, name: string, pin: string) {
  await page.goto(`/r/${code}`);
  await page.getByLabel("Dein Name").fill(name);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Beitreten" }).click();
  await expect(page.getByText(/Warte, bis der Host/)).toBeVisible();
}
