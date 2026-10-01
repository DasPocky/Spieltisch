import { expect, test, type Page } from "@playwright/test";
import { expectNoScroll, shot } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

async function startLocal(page: Page, names: string[], real = false) {
  await page.goto("/spiel/kniffel/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (real) await page.getByRole("radio", { name: /Echte Würfel/ }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

test("Kniffel auf der Startseite und Regeln", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Online-Raum erstellen/ }).click();
  await page.getByRole("button", { name: /^Kniffel/ }).click();
  await expect(page.getByRole("heading", { name: "Kniffel" })).toBeVisible();
  await expectNoScroll(page);
  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByText("Bonus +35")).toBeVisible();
  await shot(page, "30-kniffel-rules");
});

test("Kniffel lokal mit App-Würfel", async ({ page }) => {
  await startLocal(page, ["Anna", "Ben"]);
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  await expectNoScroll(page);
  await shot(page, "31-kniffel-start");

  await page.getByRole("button", { name: /Würfeln/ }).click();
  const dice = page.getByRole("button", { name: /^Würfel \d/ });
  await expect(dice).toHaveCount(5);
  await dice.nth(0).click();
  await expect(dice.nth(0)).toHaveAttribute("aria-pressed", "true");
  const kept = await dice.nth(0).getAttribute("aria-label");
  await page.getByRole("button", { name: /Würfeln/ }).click();
  await expect(dice.nth(0)).toHaveAttribute("aria-label", kept!);
  await page.getByRole("button", { name: /Chance/ }).click();
  await expectNoScroll(page);
  await shot(page, "32-kniffel-roll");
  await page.getByRole("button", { name: /eintragen/ }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Ben");

  // Annas Block ansehen
  await page.getByRole("button", { name: /Anna/ }).first().click();
  await expect(page.getByText("Block von")).toBeVisible();
  await expect(page.getByRole("button", { name: /Chance/ })).toBeDisabled();
  await shot(page, "33-kniffel-other-sheet");
});

test("Kniffel lokal mit echten Würfeln (Block) auf kleinem Handy", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startLocal(page, ["Anna", "Ben", "Cem"], true);
  await expectNoScroll(page);
  await page.getByRole("button", { name: "Vierer", exact: true }).click();
  await page.getByRole("button", { name: "3×" }).click();
  await expectNoScroll(page);
  await shot(page, "34-kniffel-real-entry");
  await page.getByRole("button", { name: "12 eintragen" }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Ben");
  await page.getByRole("button", { name: /Full House/ }).click();
  await page.getByRole("button", { name: "Geschafft +25" }).click();
  await page.getByRole("button", { name: "25 eintragen" }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Cem");
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("radio", { name: /Voll/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoScroll(page);
  await shot(page, "35-kniffel-full-view");
});
