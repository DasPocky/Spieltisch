import { expect, test } from "@playwright/test";
import { expectNoScroll, shot, startLocalTutto } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("Startseite: erst Spielweise, dann Spiel – ohne Scrollen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Spieltisch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wie spielt ihr?" })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "01-home");
  // Ein Handy: direkt zur lokalen Partie
  await page.getByRole("button", { name: /Ein Handy für alle/ }).click();
  await expect(page.getByRole("button", { name: /^Kniffel/ })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "01b-home-games");
  await page.getByRole("button", { name: /^Kniffel/ }).click();
  await expect(page).toHaveURL(/\/spiel\/kniffel\/lokal$/);
  // Online: zur Spielseite mit „Raum erstellen“; die letzte Spielweise ist markiert
  await page.goto("/");
  await page.getByRole("button", { name: /Online-Raum erstellen/ }).click();
  await page.getByRole("button", { name: /^Tutto/ }).click();
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

  // Die Karte ist schon aufgedeckt – bis eine Karte kommt, bei der Würfelpunkte zählen
  const plus500 = page.getByRole("button", { name: "+500", exact: true });
  for (let i = 0; i < 30 && !(await plus500.isVisible()); i++) {
    await page.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
    await page.waitForTimeout(250);
  }
  const who = await page.getByTestId("current-player").textContent();
  await plus500.click();
  await page.getByRole("button", { name: "+100", exact: true }).click();
  await expect(page.getByTestId("turn-pts")).toHaveText("600");
  await expectNoScroll(page);
  await shot(page, "05-local-points");
  // Tutto (falls die Karte eins kennt): Bonus kommt dazu, nächste Karte liegt schon offen
  const tutto = page.getByRole("button", { name: /Tutto geschafft/ });
  if (await tutto.isVisible()) {
    await tutto.click();
    await expect(page.getByTestId("turn-pts")).not.toHaveText("600");
    await expect(page.getByTestId("tutto-banner")).toBeVisible();
    await shot(page, "05b-local-after-tutto");
  }
  await page.getByRole("button", { name: /eintragen/ }).click();
  await expect(page.getByTestId("current-player")).not.toHaveText(who!);
  const next = await page.getByTestId("current-player").textContent();

  // Spielstand übersteht Neuladen
  await page.reload();
  await expect(page.getByTestId("current-player")).toHaveText(next!);
});

test("Lokales Tutto mit App-Würfel", async ({ page }) => {
  await page.goto("/spiel/tutto/lokal");
  await page.getByLabel("Name des Spielers").fill("Anna");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await page.getByRole("radio", { name: /App-Würfel/ }).click();
  await shot(page, "06-local-lobby");
  await page.getByRole("button", { name: "Spiel starten" }).click();

  // Karte liegt schon offen – bei Stopp weiter, bis gewürfelt werden kann
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if (await page.getByRole("button", { name: /Würfeln/ }).isVisible()) break;
    await page.getByRole("button", { name: /Weiter|eintragen|ächster Spieler/ }).click();
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
  await expect(page.getByText("Im Stapel: 55 Karten")).toBeVisible();
  await shot(page, "09-menu");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("turn-pts")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "10-full-view");
});
