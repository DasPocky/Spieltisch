import { expect, test, type Page } from "@playwright/test";
import { createRoom, shot } from "./util";

/** Tutto mit Ziel 1.000 schnell gewinnen: bis eine Karte mit Würfelpunkten kommt, dann 1.000 eintragen */
async function winTutto(page: Page) {
  const target = page.getByRole("button", { name: "Spielziel verringern" });
  for (let i = 0; i < 5; i++) await target.click();
  await expect(page.getByTestId("setting-target")).toHaveText("1.000");
  await page.getByRole("button", { name: "Spiel starten" }).click();
  const k = page.getByRole("button", { name: "+1.000", exact: true });
  // Karten im Stapel (Kopfzeile) – ändert sich erst, wenn der Server die nächste Karte gezogen hat
  const pile = () => page.getByRole("banner").getByText(/Karten/).textContent();
  for (let i = 0; i < 40 && !(await k.isVisible()); i++) {
    const before = await pile();
    await page.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
    await expect.poll(pile).not.toBe(before);
    await page.waitForTimeout(100);
  }
  await k.click();
  // online erst weiter, wenn der Server die Punkte bestätigt hat
  await expect(page.getByTestId("turn-pts")).toHaveText("1.000");
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

test("Profil: Einstellungen „Im Spiel“ bleiben nach Neuladen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE", colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("/profil");
  const prefs = page.getByTestId("play-prefs");
  const box = (name: RegExp) => prefs.getByRole("checkbox", { name });
  // dezent an: Töne, Vibration, Spielhilfen an – Ansage aus
  await expect(box(/Töne/)).toBeChecked();
  await expect(box(/Vibration/)).toBeChecked();
  await expect(box(/ansagen/)).not.toBeChecked();
  await expect(box(/Spielhilfen/)).toBeChecked();
  await prefs.getByRole("button", { name: "Töne probehören" }).click();
  await box(/Töne/).click();
  await box(/ansagen/).click();
  await page.reload();
  await expect(box(/Töne/)).not.toBeChecked();
  await expect(box(/ansagen/)).toBeChecked();
  await expect(box(/Vibration/)).toBeChecked();
  await prefs.scrollIntoViewIfNeeded();
  await shot(page, "81-profile-prefs");
  await ctx.close();
});
