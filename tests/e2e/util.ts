import { expect, type Browser, type Page } from "@playwright/test";

/** Eigener Ordner – Playwright leert test-results bei jedem Lauf */
export const SHOTS = "screenshots";

export async function shot(page: Page, name: string) {
  // Kurze Animationen (Karten gleiten, Texte blenden) erst ausklingen lassen
  await page.waitForTimeout(400);
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

/** Lokale Lobby für ein Spiel öffnen (alter Link /spiel/<id>/lokal leitet dorthin weiter) */
export async function openLocal(page: Page, gameId: string) {
  await page.goto(`/spiel/${gameId}/lokal`);
  await expect(page).toHaveURL(/\/lokal$/);
  await expect(page.getByTestId("game-card")).toContainText("Gespielt wird");
}

/** Lokales Tutto mit Spielern starten */
export async function startLocalTutto(page: Page, names: string[]) {
  await openLocal(page, "tutto");
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

/** Online-Raum wie ein Mensch erstellen: Startseite → Name + PIN → in der Lobby das Spiel wählen. Gibt den Code zurück. */
export async function createRoom(host: Page, gameId: string, name: string, pin: string): Promise<string> {
  await host.goto("/");
  // Als zuletzt gespieltes Spiel vormerken – so entsteht der Raum gleich mit diesem Spiel (wie beim Wiederkommen)
  await host.evaluate((id) => localStorage.setItem("spieltisch:lastGame", id), gameId);
  await host.getByRole("button", { name: /Online-Raum erstellen/ }).click();
  await host.getByLabel("Dein Name").fill(name);
  await host.getByLabel(/PIN/).fill(pin);
  await host.getByRole("button", { name: "Raum erstellen" }).click();
  await expect(host).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await host.getByTestId(`pick-${gameId}`).click();
  await expect(host.getByRole("heading", { name: "Was spielt ihr?" })).toBeHidden();
  return (await host.getByTestId("room-code").textContent())!.trim();
}

/** Lobby: Einstellungen öffnen (stehen als Zusammenfassung auf der Seite) */
export async function openSettings(page: Page) {
  await page.getByTestId("settings-summary").click();
  await expect(page.getByRole("heading", { name: /^Einstellungen/ })).toBeVisible();
}

/** Einstellungen wieder zu – danach ist „Spiel starten“ erreichbar */
export async function closeSettings(page: Page) {
  await page.getByRole("button", { name: "Fertig", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

export async function joinRoom(page: Page, code: string, name: string, pin: string) {
  await page.goto(`/r/${code}`);
  await page.getByLabel("Dein Name").fill(name);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Beitreten" }).click();
  await expect(page.getByText(/Warte, bis der Host/)).toBeVisible();
}
