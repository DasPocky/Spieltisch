import { expect, test, type Browser, type Page } from "@playwright/test";
import { expectNoScroll, newPhone, shot } from "./util";

/**
 * Kleine Prüfreihe für Desktop und Fernseher (die vielen Handy-Tests laufen im Projekt „spiele“):
 * Startseite, Tastatur, Barrierefreiheit (Namen für Knöpfe), Raum am Rechner, Großer Tisch in 4K und ohne 3D.
 */
async function desktop(browser: Browser, opts: { width?: number; height?: number; reducedMotion?: "reduce" } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 }, locale: "de-DE", reducedMotion: opts.reducedMotion });
  return ctx.newPage();
}

/** Jeder sichtbare Knopf und Link hat einen Namen (Text, aria-label oder title) */
async function expectNamedControls(page: Page) {
  const unnamed = await page.evaluate(() => [...document.querySelectorAll("button, a[href], [role=button]")]
    .filter((el) => (el as HTMLElement).offsetParent !== null)
    .filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent?.trim() || el.getAttribute("aria-labelledby")))
    .map((el) => el.outerHTML.slice(0, 120)));
  expect(unnamed, unnamed.join("\n")).toEqual([]);
}

test("Desktop: Startseite mit Seitenleiste, Tastatur erreicht die Hauptaktionen, alle Knöpfe haben Namen", async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Bereiche" })).toBeVisible();
  await expectNamedControls(page);
  // Mit Tab zu „Raum öffnen“
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => /Raum öffnen|Hier selbst mitspielen/.test(document.activeElement?.textContent ?? ""));
  }
  expect(reached).toBe(true);
  await shot(page, "g1-desktop-start");
});

test("Desktop: Raum am Rechner, Handy tritt bei, Partie passt ohne Scrollen", async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("spieltisch:lastGame", "maumau"));
  await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill("6060");
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByTestId("meet-play").click();
  await page.getByTestId("pick-maumau").click();
  const code = (await page.getByTestId("room-code").textContent())!.trim();
  const phone = await newPhone(browser);
  await phone.goto(`/r/${code}`);
  await phone.getByLabel("Dein Name").fill("Ben");
  await phone.getByLabel("PIN").fill("6060");
  await phone.getByRole("button", { name: "Beitreten" }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("hand")).toBeVisible();
  await expectNoScroll(page);
  await expectNamedControls(page);
  await shot(page, "g2-desktop-partie");
});

test("Fernseher (4K-Fläche): Tisch-Lobby passt, ohne 3D bleibt alles bedienbar, reduzierte Bewegung", async ({ browser }) => {
  const tv = await desktop(browser, { width: 1920, height: 1080, reducedMotion: "reduce" });
  // Kein WebGL (alter Fernseher, Grafik abgestürzt): der Tisch zeigt trotzdem Lobby und Plätze
  await tv.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof orig;
  });
  await tv.goto("/tisch");
  await tv.getByTestId("table-new").click();
  await expect(tv).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  await expect(tv.getByTestId("table-lobby")).toBeVisible();
  // ohne WebGL: der einfache flache Tisch
  await expect(tv.getByTestId("table-flat")).toBeAttached();
  await expectNoScroll(tv);
  await expectNamedControls(tv);
  await shot(tv, "g3-tv-ohne-3d");
});
