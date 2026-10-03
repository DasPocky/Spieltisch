import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

async function local(page: Page, names: string[], table = false) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/skipbo/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (table) {
    await openSettings(page);
    await page.getByRole("radio", { name: /Echte Karten/ }).click();
    await closeSettings(page);
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

/** Zug beenden: erste Handkarte auf Ablage 1 */
async function endTurn(p: Page) {
  await p.getByTestId("hand").getByRole("button").first().click();
  await p.getByTestId("discard-0").click();
}

test("Skip-Bo lokal: auswählen, ablegen, weitergeben – passt auf 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await local(page, ["Anna", "Ben", "Cem"]);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(page.getByTestId("hand").getByRole("button")).toHaveCount(5);
  await expect(page.getByTestId("stock")).toHaveText("30");
  await page.getByTestId("hand").getByRole("button").first().click();
  await expect(page.getByTestId("status")).toContainText("Ablage");
  await expectNoScroll(page);
  await shot(page, "69-skipbo-320");
  await page.getByTestId("discard-0").click();
  await expect(page.getByRole("button", { name: /Ich bin Ben/ })).toBeVisible();
  await expectNoScroll(page);
});

test("Skip-Bo online: jeder seine Hand, Vorrat oben für alle sichtbar", async ({ browser }) => {
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "skipbo", "Anna", "7777");
  await joinRoom(ben, code, "Ben", "7777");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("hand").getByRole("button")).toHaveCount(5);
  await expect(ben.getByLabel("Anna: Vorrat 30")).toBeVisible();
  await expect(ben.getByTestId("hand").getByRole("button")).toHaveCount(0);
  await expectNoScroll(anna);
  await shot(anna, "70-skipbo-online");
  await endTurn(anna);
  await expect(ben.getByTestId("hand").getByRole("button")).toHaveCount(5);
  await expect(ben.getByTestId("status")).not.toContainText("ist am Zug");
  await shot(ben, "71-skipbo-online-ben");
});

test("Skip-Bo mit echten Karten: Punkteblock", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await local(page, ["Anna", "Ben", "Cem"], true);
  await page.getByRole("button", { name: "Ben hat gewonnen" }).click();
  await page.getByLabel("Vorrat Anna").fill("4");
  await page.getByLabel("Vorrat Cem").fill("2");
  await page.getByLabel("Vorrat Cem").blur();
  await expectNoScroll(page);
  await page.getByRole("button", { name: "+55 für Ben" }).click();
  await expect(page.getByText(/Ben/).first()).toBeVisible();
});
