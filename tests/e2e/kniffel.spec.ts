import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot, startLocal, pick } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

const startKniffel = (page: Page, names: string[], real = false) =>
  startLocal(page, "kniffel", names, { fresh: false, settings: real ? pick(/Echte Würfel/) : undefined });

test("Kniffel: alter Link führt in die lokale Lobby, Regeln im Menü", async ({ page }) => {
  await page.goto("/spiel/kniffel");
  await expect(page).toHaveURL(/\/lokal$/);
  await expect(page.getByTestId("game-card")).toContainText("Kniffel");
  await expectNoScroll(page);
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Regeln: Kniffel" }).click();
  await expect(page.getByText("Bonus +35")).toBeVisible();
  await shot(page, "30-kniffel-rules");
});

test("Kniffel lokal mit App-Würfel", async ({ page }) => {
  await startKniffel(page, ["Anna", "Ben"]);
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

test("Kniffel Spielhilfe: Stern am besten freien Feld, nur mit Spielhilfen", async ({ page }) => {
  await startKniffel(page, ["Anna", "Ben"]);
  await expect(page.getByTestId("best")).toHaveCount(0);
  await page.getByRole("button", { name: /Würfeln/ }).click();
  await expect(page.getByTestId("best").first()).toBeVisible();
  await shot(page, "hints-kniffel");
  await page.evaluate(() => localStorage.setItem("spieltisch:prefs", '{"hints":false}'));
  await page.reload();
  await expect(page.getByRole("button", { name: /^Würfel \d/ })).toHaveCount(5);
  await expect(page.getByTestId("best")).toHaveCount(0);
});

test("Kniffel lokal mit echten Würfeln (Block) auf kleinem Handy", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startKniffel(page, ["Anna", "Ben", "Cem"], true);
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
  // Ein Rückgängig-Knopf (kein eigenes „Letzten Eintrag zurücknehmen“ mehr)
  await expect(page.getByRole("button", { name: /zurücknehmen/ })).toHaveCount(1);
  // Spieler & Verlauf gibt es auch bei Kniffel
  await page.getByRole("button", { name: /Spieler & Verlauf/ }).click();
  await expect(page.getByTestId("history")).toContainText("Full House");
  await expect(page.getByTestId("overview")).toContainText("Cem");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Letzten Zug zurücknehmen" }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Ben");
  await page.getByTestId("my-device").getByRole("button").first().click();
  await page.getByRole("radio", { name: /Voll/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoScroll(page);
  await shot(page, "35-kniffel-full-view");
});

test("Kniffel online mit zwei Handys: nur wer dran ist würfelt, beide sehen Würfel und Punkte", async ({ browser }) => {
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "kniffel", "Anna", "5151");
  await joinRoom(ben, code, "Ben", "5151");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  // Wer dran ist, sieht „Du“ – der andere den Namen und keinen Würfel-Knopf
  await expect(anna.getByTestId("current-player")).not.toBeEmpty();
  const [me, other] = (await anna.getByTestId("current-player").textContent()) === "Du" ? [anna, ben] : [ben, anna];
  await expect(other.getByRole("button", { name: /Würfeln/ })).toHaveCount(0);
  await me.getByRole("button", { name: /Würfeln/ }).click();
  const kept = await me.getByRole("button", { name: /^Würfel \d/ }).first().getAttribute("aria-label");
  // der andere sieht dieselben Augen
  await expect(other.getByRole("button", { name: /^Würfel \d/ }).first()).toHaveAttribute("aria-label", kept!);
  await me.getByRole("button", { name: /Chance/ }).click();
  await me.getByRole("button", { name: /eintragen/ }).click();
  await expect(other.getByTestId("current-player")).toHaveText("Du");
  await expect(other.getByRole("button", { name: /Würfeln/ })).toBeVisible();
  await expectNoScroll(other);
  await shot(other, "34-kniffel-online");
});
