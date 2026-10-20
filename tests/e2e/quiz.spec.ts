import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot, startLocal } from "./util";

/** Nur diese Arten Fragen (die anderen abhaken) */
async function onlyKinds(p: Page, keep: string) {
  for (const k of ["Auswahl", "Schätzen", "Ordnen"]) {
    if (k === keep) continue;
    const box = p.getByRole("checkbox", { name: new RegExp(`^${k}`) });
    if ((await box.getAttribute("aria-checked")) !== "false") await box.click();
  }
}

test("Quiz online, Auswahl: alle antworten am eigenen Handy, erst danach Lösung und Punkte", async ({ browser }) => {
  test.setTimeout(90_000);
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "quiz", "Anna", "5121");
  await openSettings(anna);
  await onlyKinds(anna, "Auswahl");
  await closeSettings(anna);
  await joinRoom(ben, code, "Ben", "5121");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("question")).toBeVisible();
  await expect(ben.getByTestId("question")).toHaveText((await anna.getByTestId("question").textContent())!);
  await expectNoScroll(anna);
  await shot(anna, "q1-auswahl");
  await anna.getByRole("group", { name: "Antworten" }).getByRole("button").first().click();
  await expect(anna.getByTestId("answered")).toBeVisible();
  await expect(ben.getByTestId("solution")).toHaveCount(0);
  await shot(anna, "q2-wartet");
  await ben.getByRole("group", { name: "Antworten" }).getByRole("button").nth(1).click();
  await expect(anna.getByTestId("solution")).toBeVisible();
  await expect(anna.getByTestId("answers")).toContainText("Ben");
  await expectNoScroll(anna);
  await shot(ben, "q3-aufloesung");
  // Nächste Frage: nur Anna antwortet, Host löst auf
  await anna.getByRole("button", { name: "Nächste Frage" }).click();
  await expect(anna.getByText("Frage 2/10")).toBeVisible();
  await anna.getByRole("group", { name: "Antworten" }).getByRole("button").first().click();
  await anna.getByRole("button", { name: "Jetzt auflösen" }).click();
  await expect(ben.getByTestId("solution")).toBeVisible();
});

test("Quiz online, Schätzen und Ordnen", async ({ browser }) => {
  test.setTimeout(90_000);
  const anna = await newPhone(browser);
  await createRoom(anna, "quiz", "Anna", "5122");
  await openSettings(anna);
  await onlyKinds(anna, "Schätzen");
  await closeSettings(anna);
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await anna.getByLabel("Deine Schätzung").fill("1.000");
  await shot(anna, "q4-schaetzen");
  await anna.getByRole("button", { name: "Schätzen" }).click();
  await expect(anna.getByTestId("solution")).toBeVisible();
  await expect(anna.getByTestId("answers")).toContainText("1.000");
  await anna.getByRole("button", { name: "Zum Ergebnis" }).or(anna.getByRole("button", { name: "Nächste Frage" })).click();

  const ben = await newPhone(browser);
  await createRoom(ben, "quiz", "Ben", "5123");
  await openSettings(ben);
  await onlyKinds(ben, "Ordnen");
  await closeSettings(ben);
  await ben.getByRole("button", { name: "Spiel starten" }).click();
  const items = ben.getByRole("group", { name: "Begriffe" }).getByRole("button");
  await items.nth(2).click();
  await items.nth(0).click();
  await expect(items.nth(2)).toContainText("1");
  await expectNoScroll(ben);
  await shot(ben, "q5-ordnen");
  await items.nth(1).click();
  await items.nth(3).click();
  await expect(ben.getByTestId("solution")).toContainText("→");
});

test("Quiz an einem Handy: Frage zeigen, alle rufen, auflösen und antippen, wer es hatte", async ({ page }) => {
  await startLocal(page, "quiz", ["Anna", "Ben", "Cem"], { settings: (p) => onlyKinds(p, "Auswahl") });
  await expect(page.getByTestId("question")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "q6-lokal");
  await page.getByRole("button", { name: "Auflösen" }).click();
  await expect(page.getByTestId("solution")).toBeVisible();
  await page.getByRole("group", { name: "Richtig lagen" }).getByRole("button", { name: "Ben" }).click();
  await expectNoScroll(page);
  await shot(page, "q7-lokal-punkte");
  await page.getByRole("button", { name: /\+100 für 1/ }).click();
  await expect(page.getByText("Frage 2/10")).toBeVisible();
});
