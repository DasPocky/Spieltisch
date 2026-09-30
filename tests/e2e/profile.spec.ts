import { expect, test, type Page } from "@playwright/test";
import { createRoom, shot } from "./util";

/** Tutto mit Ziel 1.000 schnell gewinnen: bis eine Karte mit Würfelpunkten kommt, dann 1.000 eintragen */
async function winTutto(page: Page) {
  const target = page.getByRole("button", { name: "Spielziel verringern" });
  for (let i = 0; i < 5; i++) await target.click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  const k = page.getByRole("button", { name: "+1.000", exact: true });
  for (let i = 0; i < 40 && !(await k.isVisible()); i++) {
    await page.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
    await page.waitForTimeout(150);
  }
  await k.click();
  await page.getByRole("button", { name: /eintragen/ }).click();
  await expect(page.getByText(/mit 1\.000 Punkten/)).toBeVisible();
}

test("Profil: Online- und lokale Partien landen in der Statistik", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE" });
  const page = await ctx.newPage();

  // Profil anlegen, Namen setzen
  await page.goto("/profil");
  await expect(page.getByText("Noch keine Partien")).toBeVisible();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByRole("button", { name: "Speichern" }).click();

  // Online-Raum allein gewinnen
  await createRoom(page, "tutto", "Anna", "2468");
  await winTutto(page);

  // Lokal: der Spieler „Anna“ bin ich
  await page.goto("/spiel/tutto/lokal");
  await page.getByLabel("Name des Spielers").fill("Anna");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await winTutto(page);

  await page.goto("/profil");
  await expect(page.getByTestId("stats")).toContainText("2 Partien · 2 gewonnen (100 %)");
  await expect(page.getByTestId("stats")).toContainText("Bestwert 1.000");
  await page.getByText("Letzte Partien").click();
  await expect(page.getByTestId("stats")).toContainText("online");
  await expect(page.getByTestId("stats")).toContainText("lokal");
  await shot(page, "80-profile");

  // Code anzeigen und auf einem zweiten „Handy“ übernehmen
  await page.getByRole("button", { name: "Profil-Code anzeigen" }).click();
  const code = (await page.getByTestId("profile-code").textContent())!;
  const other = await (await browser.newContext({ locale: "de-DE" })).newPage();
  await other.goto("/profil");
  await other.getByLabel("Code von einem anderen Gerät eingeben").fill(code);
  await other.getByRole("button", { name: "Übernehmen" }).click();
  await expect(other.getByTestId("stats")).toContainText("2 Partien");

  // Löschen
  await other.getByRole("button", { name: "Profil und Statistik löschen" }).click();
  await other.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(other.getByText("Noch keine Partien")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Noch keine Partien")).toBeVisible();
  await ctx.close();
});
