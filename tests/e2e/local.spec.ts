import { expect, test } from "@playwright/test";
import { closeSettings, expectInView, expectNoScroll, openSettings, shot, startLocalTutto } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("Startseite: erst Spielweise, dann Lobby, dann Spiel – lokal wie online, ohne Scrollen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Spieltisch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wie spielt ihr?" })).toBeVisible();
  // Ein Profil-Knopf oben, kein Hell/Dunkel-Knopf auf der Startseite
  await expect(page.getByRole("button", { name: "Mein Profil" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Darstellung/ })).toHaveCount(0);
  await expectNoScroll(page);
  await shot(page, "01-home");
  // Ein Handy: direkt in die lokale Lobby, das Spiel wird dort gewählt
  await page.getByRole("button", { name: /Ein Handy für alle/ }).click();
  await expect(page).toHaveURL(/\/lokal$/);
  await expect(page.getByRole("banner")).toContainText("Ein Handy für alle");
  await expectNoScroll(page);
  await page.getByTestId("game-card").click();
  await expect(page.getByRole("heading", { name: "Was spielt ihr?" })).toBeVisible();
  await shot(page, "01b-local-pick");
  await page.getByRole("button", { name: /^Kniffel/ }).click();
  await expect(page.getByTestId("game-card")).toContainText("Kniffel");
  // Spieler bleiben beim Wechsel, Einstellungen als eine Zeile
  for (const n of ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByTestId("game-card").click();
  await page.getByRole("button", { name: /^Tutto/ }).click();
  await expect(page.getByText("Finn")).toBeVisible();
  await expect(page.getByTestId("settings-summary")).toContainText("Spielziel 6.000");
  // Sechs Spieler: die Lobby passt ohne Scrollen, „Spiel starten“ bleibt unten
  await expectNoScroll(page);
  await expectInView(page, page.getByRole("button", { name: "Spiel starten" }));
  await shot(page, "01c-local-lobby");
  // Zurück führt zur Startseite, die Lobby bleibt gespeichert
  await page.getByRole("button", { name: "Zur Startseite" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: /Ein Handy für alle/ }).click();
  await expect(page.getByText("Finn")).toBeVisible();

  // Online: erst den Raum erstellen, dann in der Lobby das Spiel wählen
  await page.goto("/");
  await page.getByRole("button", { name: /Online-Raum erstellen/ }).click();
  await expect(page.getByTestId("create-room")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "01d-home-online");
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill("4711");
  await page.getByRole("button", { name: "Raum erstellen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await expect(page.getByRole("heading", { name: "Was spielt ihr?" })).toBeVisible();
  await page.getByRole("button", { name: /^Uno/ }).click();
  await expect(page.getByRole("heading", { name: "Was spielt ihr?" })).toBeHidden();
  await expect(page.getByTestId("game-card")).toContainText("Uno");
  await expectNoScroll(page);
  await shot(page, "01e-lobby");
  // Alte Spielseite: führt in die lokale Lobby mit diesem Spiel
  await page.goto("/spiel/skyjo");
  await expect(page).toHaveURL(/\/lokal$/);
  await expect(page.getByTestId("game-card")).toContainText("Skyjo");
  // Regeln im Menü
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Regeln: Skyjo" }).click();
  await expect(page.getByRole("heading", { name: "Regeln: Skyjo" })).toBeVisible();
  await shot(page, "03-rules");
});

test("Alter lokaler Spielstand lädt weiter über den alten Link", async ({ page }) => {
  await startLocalTutto(page, ["Anna", "Ben"]);
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  await page.goto("/");
  await page.goto("/spiel/tutto/lokal");
  await expect(page).toHaveURL(/\/lokal$/);
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  // Verlassen führt zur Startseite, „Ein Handy für alle“ setzt die Partie fort
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Zur Startseite" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: /Ein Handy für alle/ }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
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
  await openSettings(page);
  await page.getByRole("radio", { name: /App-Würfel/ }).click();
  await shot(page, "06-local-settings");
  await closeSettings(page);
  await expect(page.getByTestId("settings-summary")).toContainText("App-Würfel");
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
  // Feste Abschnitte: Partie zuerst, keine Einstellungsliste mehr im Menü
  await expect(page.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Anderes Spiel" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Würfel" })).toHaveCount(0);
  await page.getByRole("radio", { name: /Voll/ }).click();
  await shot(page, "09-menu");
  // Spieler & Verlauf: auch bei Tutto (ohne Leiste) – mit Stapel
  await page.getByRole("button", { name: /Spieler & Verlauf/ }).click();
  await expect(page.getByRole("heading", { name: "Spieler & Verlauf" })).toBeVisible();
  await expect(page.getByTestId("overview")).toContainText("Emil");
  await expect(page.getByText("Im Stapel: 55 Karten")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("turn-pts")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "10-full-view");
});
