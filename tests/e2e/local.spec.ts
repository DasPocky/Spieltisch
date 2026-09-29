import { expect, test } from "@playwright/test";
import { expectNoScroll, shot, startLocalTutto } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("Startseite zeigt die Spieleauswahl ohne Scrollen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Spieltisch" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tutto/ })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "01-home");
  await page.getByRole("button", { name: /Tutto/ }).click();
  await expect(page).toHaveURL(/\/spiel\/tutto$/);
  await expect(page.getByRole("heading", { name: "Tutto" })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "02-game-page");
  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByRole("heading", { name: "Regeln: Tutto" })).toBeVisible();
  await expect(page.getByText("Würfelwertung")).toBeVisible();
  await shot(page, "03-rules");
});

test("Lokales Tutto mit echten Würfeln", async ({ page }) => {
  await startLocalTutto(page, ["Anna", "Ben"]);
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  await expectNoScroll(page);
  await shot(page, "04-local-start");

  await page.getByRole("button", { name: "Karte ziehen" }).click();
  await page.waitForTimeout(700);
  const book = page.getByRole("button", { name: /eintragen|Weiter/ });
  // Nur wenn keine Stopp-Karte: Punkte eintippen
  await page.getByRole("button", { name: "+500" }).click();
  await page.getByRole("button", { name: "+100" }).click();
  await expect(book).toHaveText("600 eintragen");
  await expectNoScroll(page);
  await shot(page, "05-local-points");
  await book.click();
  await expect(page.getByTestId("current-player")).toHaveText("Ben");
  await expect(page.getByText("600", { exact: true }).first()).toBeVisible();

  // Spielstand übersteht Neuladen
  await page.reload();
  await expect(page.getByTestId("current-player")).toHaveText("Ben");
});

test("Lokales Tutto mit App-Würfel", async ({ page }) => {
  await page.goto("/spiel/tutto/lokal");
  await page.getByLabel("Name des Spielers").fill("Anna");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await page.getByRole("radio", { name: /App-Würfel/ }).click();
  await shot(page, "06-local-lobby");
  await page.getByRole("button", { name: "Spiel starten" }).click();

  // Karten ziehen, bis eine Karte kommt, mit der gewürfelt wird
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "Karte ziehen" }).last().click();
    await page.waitForTimeout(600);
    if (await page.getByRole("button", { name: /Würfeln/ }).isVisible()) break;
    await page.getByRole("button", { name: /Weiter|eintragen/ }).click();
  }
  await page.getByRole("button", { name: /Würfeln/ }).click();
  await expect(page.getByRole("button", { name: /^Würfel \d$/ }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Würfel \d/ }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await expectNoScroll(page);
  await shot(page, "07-local-app-dice");
});

test("Menü, Ansicht „Voll“ und kleines Handy", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startLocalTutto(page, ["Anna", "Ben", "Cem", "Dora", "Emil"]);
  await expectNoScroll(page);
  await shot(page, "08-small-screen");
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("radio", { name: /Voll/ }).click();
  await expect(page.getByText("Im Stapel: 56 Karten")).toBeVisible();
  await shot(page, "09-menu");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "−50" })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "10-full-view");
});
