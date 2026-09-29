import { expect, test, type Locator, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

/** Kurzer Klick: Online kann sich der Tisch zwischen Abfrage und Klick ändern – dann einfach neu schauen */
async function tap(loc: Locator) {
  await loc.click({ timeout: 1500 }).catch(() => {});
}

/** Einen Entscheidungsschritt machen – egal ob Ziel wählen, Karte antippen oder ziehen/aufhören */
async function step(page: Page, stayChance = 0.35) {
  const target = page.locator(".glass").filter({ hasText: "wen trifft's?" });
  if (await target.isVisible()) {
    await tap(target.getByRole("button").first());
    return;
  }
  const pickable = page.getByTestId("table").locator("button:not([disabled])");
  if (await pickable.count()) {
    await tap(pickable.first());
    if (await pickable.count()) await tap(pickable.last());
    return;
  }
  const hit = page.getByRole("button", { name: "Noch eine!" });
  if (await hit.isVisible()) {
    if (Math.random() < stayChance) await tap(page.getByRole("button", { name: /Aufhören/ }));
    else await tap(hit);
  }
}

test("Flip 7 lokal klassisch: Runden spielen", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/flip7/lokal");
  for (const n of ["Anna", "Ben", "Cem"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("table")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "90-flip7-start");
  for (let i = 0; i < 60 && !(await page.getByTestId("last-round").isVisible()); i++) {
    await step(page);
    await page.waitForTimeout(80);
    if (i === 6) await shot(page, "91-flip7-midround");
  }
  await expect(page.getByTestId("last-round")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "92-flip7-round2");
});

test("Flip 7 online „Voll fies“ mit drei Handys", async ({ browser }) => {
  const phones = await Promise.all(["Anna", "Ben", "Cem"].map(() => newPhone(browser)));
  const [host] = phones;
  const code = await createRoom(host, "flip7", "Anna", "7070");
  await host.getByRole("radio", { name: /Voll fies/ }).click();
  await joinRoom(phones[1], code, "Ben", "7070");
  await joinRoom(phones[2], code, "Cem", "7070");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByText("😈")).toBeVisible();
  for (let i = 0; i < 90 && !(await host.getByTestId("last-round").isVisible()); i++) {
    for (const p of phones) await step(p, 0.3);
    await host.waitForTimeout(60);
  }
  await expect(phones[1].getByTestId("last-round")).toBeVisible();
  await expectNoScroll(phones[2]);
  await shot(phones[2], "93-flip7-online-fies");
});
