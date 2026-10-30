import { expect, test } from "@playwright/test";
import { expectNoScroll, shot } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Einstellungen geladen (die App hat dabei ihre Neustart-Kennung geprüft)
  await page.waitForFunction(() => localStorage.getItem("spieltisch:config") !== null);
  // Alles leeren, nur die Neustart-Kennung behalten (sonst gilt das Gerät als alt und startet einmal frisch)
  await page.evaluate(() => { const e = localStorage.getItem("spieltisch:epoch"); localStorage.clear(); if (e) localStorage.setItem("spieltisch:epoch", e); localStorage.setItem("spieltisch:name", "Anna"); });
  await page.reload();
});

/** Kein Scrollen – weder die Seite noch der Inhalt eines Tabs */
async function expectTabFits(page: import("@playwright/test").Page) {
  await expectNoScroll(page);
  const over = await page.evaluate(() => { const t = document.querySelector('[data-testid^="tab-"]')!; return t.scrollHeight - t.clientHeight; });
  expect(over, "Tab-Inhalt scrollt").toBeLessThanOrEqual(1);
}

test("App-Hülle: Tabs wechseln, Zurück führt zum Start, alles ohne Scrollen", async ({ page }) => {
  await expect(page.getByTestId("greeting")).toHaveText("Hallo, Anna!");
  await expectTabFits(page);
  await shot(page, "05-start");
  await page.getByTestId("tabbar-spiele").click();
  await expect(page).toHaveURL(/\/spiele$/);
  await expect(page.getByTestId("tabbar-spiele")).toHaveAttribute("aria-current", "page");
  await expectTabFits(page);
  await page.getByTestId("tabbar-gruppe").click();
  await expect(page).toHaveURL(/\/gruppe$/);
  await page.getByTestId("tabbar-profil").click();
  await expect(page.getByRole("heading", { name: "Mein Profil" })).toBeVisible();
  // Zwischen Tabs wird der Verlauf nur ersetzt: einmal Zurück, und man ist am Start
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("greeting")).toBeVisible();
  // Start-Tab geht ebenfalls zurück statt einen neuen Eintrag anzulegen
  await page.getByTestId("tabbar-spiele").click();
  await page.getByTestId("tabbar-start").click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => history.state)).toBeNull();
});

test("Kleines Handy: Start und Spiele passen ohne Scrollen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(page.getByTestId("greeting")).toBeVisible();
  await expectTabFits(page);
  await page.getByTestId("tabbar-spiele").click();
  await expect(page.getByTestId("game-grid")).toBeVisible();
  // alle 33 Spiele (zuletzt dazu: Klingel und Palast) – das Raster passt trotzdem ohne Scrollen
  await expect(page.getByTestId("game-grid").locator("li")).toHaveCount(33);
  await expect(page.getByTestId("game-palast")).toBeVisible();
  await expectTabFits(page);
  // auch das kleinste Handy (320×568)
  await page.setViewportSize({ width: 320, height: 568 });
  await expectTabFits(page);
});

test("Blätter schließen mit der Zurück-Geste, Beitreten nimmt auch einen Link", async ({ page }) => {
  await page.getByTestId("host-open").click();
  await page.getByTestId("host-meet").click();
  await expect(page.getByTestId("create-room")).toBeVisible();
  await expect(page.getByLabel("Dein Name")).toHaveValue("Anna");
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("join-open").click();
  await page.getByLabel("Raumcode").fill("https://example.org/r/ab3cd");
  await expect(page.getByLabel("Raumcode")).toHaveValue("AB3CD");
  await shot(page, "05b-beitreten");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(/\/r\/AB3CD$/);
  // Das Blatt ersetzt seinen Verlaufseintrag: Zurück führt direkt zum Start
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Spiele-Tab: Infoblatt mit Regeln, Raum mit diesem Spiel öffnen", async ({ page }) => {
  await page.getByTestId("tabbar-spiele").click();
  await page.getByRole("tab", { name: "Brett" }).click();
  await expect(page.getByTestId("game-fuenfwuerfel")).toHaveCount(0);
  await expect(page.getByTestId("game-muehle")).toBeVisible();
  await page.getByRole("tab", { name: "Alle" }).click();
  await page.getByTestId("game-fuenfwuerfel").click();
  const sheet = page.getByTestId("game-sheet");
  await expect(sheet.getByRole("heading", { name: "Fünf Würfel" })).toBeVisible();
  await expect(sheet).toContainText("Spieler");
  await shot(page, "05c-spiel-info");
  await sheet.getByRole("button", { name: "Regeln lesen" }).click();
  await expect(sheet.getByText(/Fünf Würfel|Würf/).first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByTestId("game-eins").click();
  await page.getByRole("button", { name: "Raum mit diesem Spiel öffnen" }).click();
  await expect(page.getByTestId("create-room")).toContainText("Eins! steht im Raum gleich bereit");
  await page.getByLabel(/PIN/).fill("4711");
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  // Spiel ist gesetzt – keine Spielauswahl in der Lobby
  await expect(page.getByTestId("game-card")).toContainText("Eins!");
  await expect(page.getByRole("heading", { name: "Was spielt ihr?" })).toHaveCount(0);
});

test("Installieren: Blatt mit Anleitung fürs iPhone, ab dem zweiten Besuch einmal von selbst", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByTestId("install-hint").getByRole("button").first().click();
  await expect(page.getByTestId("install-steps")).toContainText("Zum Home-Bildschirm");
  await page.getByRole("button", { name: "Schließen", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Zweiter Besuch (neue Sitzung): die Einladung kommt einmal
  const second = await ctx.newPage();
  await second.goto("/");
  await expect(second.getByTestId("install-sheet")).toContainText("Schön, dass du wieder da bist");
  await second.getByRole("button", { name: "Später" }).click();
  const third = await ctx.newPage();
  await third.goto("/");
  await expect(third.getByTestId("greeting")).toBeVisible();
  await third.waitForTimeout(1600);
  await expect(third.getByTestId("install-sheet")).toHaveCount(0);
  await ctx.close();
});
