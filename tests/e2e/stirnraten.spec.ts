import { expect, test, type Page } from "@playwright/test";
import { captureSpeech, createRoom, expectNoScroll, joinRoom, newPhone, shot, spoken, startLocal } from "./util";

/** Neigung des Handys vortäuschen: aufrecht, dann zum Boden (erraten) bzw. zur Decke (weiter) */
async function tilt(page: Page, dir: "hit" | "pass") {
  await page.evaluate((d) => {
    const fire = (beta: number, gamma: number) => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta, gamma }));
    fire(0, 90);
    // cos β · cos γ: −0,87 = Bildschirm zum Boden, +0,87 = zur Decke
    fire(d === "hit" ? 180 : 0, 30);
    fire(0, 90);
  }, dir);
}

/** Einstellungen per Minus/Plus und Auswahl */
const fewer = async (p: Page, label: string, times: number) => { for (let i = 0; i < times; i++) await p.getByRole("button", { name: `${label} verringern` }).click(); };

test("Stirnraten lokal: Kategorie wählen, Handy an die Stirn, kippen und tippen, korrigieren, Ergebnis", async ({ page }) => {
  await captureSpeech(page);
  await startLocal(page, "stirnraten", ["Anna", "Ben"], {
    settings: async (p) => { await fewer(p, "Runden", 1); await fewer(p, "Zeit pro Zug (s)", 2); },
  });
  await expect(page.getByTestId("guesser")).toContainText("Anna rät");
  await expectNoScroll(page);
  await shot(page, "stirn-01-kategorie");
  await page.getByTestId("categories").getByRole("button", { name: "Tiere", exact: true }).click();
  // Sichtschutz: Anna bekommt das Handy
  await page.getByRole("button", { name: "Ich bin Anna" }).click();
  await shot(page, "stirn-02-bereit");
  await page.getByTestId("go").click();
  await expect(page.getByTestId("forehead")).toBeVisible({ timeout: 8000 });
  const first = await page.getByTestId("forehead-word").textContent();
  expect(first?.length).toBeGreaterThan(1);
  await shot(page, "stirn-03-stirn");
  // Nicken: erraten
  await tilt(page, "hit");
  await expect(page.getByLabel("1 erraten")).toBeVisible();
  await page.waitForTimeout(700);
  // Tippen als Ersatz: rechts richtig, links weiter
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Richtig", exact: true }).click();
  await expect(page.getByLabel("2 erraten")).toBeVisible();
  await page.waitForTimeout(700);
  await shot(page, "ux-stirnraten-zug-beenden");
  await page.getByRole("button", { name: "Zug beenden" }).click();
  await expect(page.getByTestId("review-title")).toHaveText("2 erraten");
  await expect(page.getByTestId("review").getByRole("button")).toHaveCount(3);
  await expect(page.getByTestId("review")).toContainText(first!);
  await shot(page, "stirn-04-auswertung");
  // Korrigieren: die übersprungene doch erraten
  await page.getByTestId("review").getByRole("button").nth(1).click();
  await expect(page.getByTestId("review-title")).toHaveText("3 erraten");
  await page.getByTestId("confirm").click();
  // Ben ist dran – Zufall, Zeit läuft ab
  await expect(page.getByTestId("guesser")).toContainText("Ben rät");
  await page.getByRole("button", { name: "Zufall" }).click();
  await page.getByRole("button", { name: "Ich bin Ben" }).click();
  await page.getByTestId("go").click();
  await expect(page.getByTestId("forehead")).toBeVisible({ timeout: 8000 });
  await tilt(page, "pass");
  await expect(page.getByTestId("review-title")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("confirm").click();
  await expect(page.getByText(/Anna/).first()).toBeVisible();
  await shot(page, "stirn-05-ende");
  const said = await spoken(page);
  expect(said).toContain("Anna ist dran");
  expect(said).toContain("Zeit ist um");
});

test("Stirnraten online: das Stirn-Handy zeigt den Begriff groß, die anderen sehen ihn zum Erklären", async ({ browser }) => {
  test.setTimeout(90_000);
  const host = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(host, "stirnraten", "Anna", "1234");
  await joinRoom(ben, code, "Ben", "1234");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByTestId("categories")).toBeVisible();
  await expect(ben.getByTestId("guesser")).toContainText("wählt gerade");
  await host.getByTestId("categories").getByRole("button", { name: /Bunt gemischt/ }).click();
  await host.getByTestId("go").click();
  await expect(host.getByTestId("forehead")).toBeVisible({ timeout: 8000 });
  const word = (await host.getByTestId("forehead-word").textContent())!;
  await expect(ben.getByTestId("explain-word")).toHaveText(word);
  await shot(ben, "stirn-06-erklaeren");
  await tilt(host, "hit");
  await expect(ben.getByTestId("clock")).toContainText("✓ 1");
  await host.waitForTimeout(700);
  await host.getByRole("button", { name: "Zug beenden" }).click();
  await expect(ben.getByTestId("review")).toContainText(word);
});

test("Stirnraten Bombe und Hochstapler an einem Handy", async ({ page }) => {
  await startLocal(page, "stirnraten", ["Anna", "Ben", "Cem"], {
    settings: async (p) => { await p.getByRole("radio", { name: /Bombe/ }).click(); },
  });
  await page.getByTestId("ignite").click();
  const w1 = await page.getByTestId("bomb-word").textContent();
  await expect(page.getByTestId("holder")).toContainText("Anna erklärt Ben");
  await shot(page, "stirn-07-bombe");
  await page.getByTestId("bomb-pass").click();
  await expect(page.getByTestId("holder")).toContainText("Ben erklärt Cem");
  expect(await page.getByTestId("bomb-word").textContent()).not.toBe(w1);

  await startLocal(page, "stirnraten", ["Anna", "Ben", "Cem"], {
    settings: async (p) => { await p.getByRole("radio", { name: /Hochstapler/ }).click(); await fewer(p, "Runden", 1); },
  });
  let impostor = "";
  for (const n of ["Anna", "Ben", "Cem"]) {
    await page.getByRole("button", { name: `Ich bin ${n}` }).click();
    await page.getByRole("button", { name: "Begriff ansehen" }).click();
    if ((await page.getByTestId("word-text").textContent())!.includes("Hochstapler")) impostor = n;
    if (n === "Anna") await shot(page, "stirn-08-hochstapler");
    await page.getByRole("button", { name: /^Gesehen/ }).click();
  }
  expect(impostor).not.toBe("");
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: /hat's gesagt – weiter/ }).click();
  await page.getByRole("button", { name: impostor, exact: true }).click();
  await page.getByRole("button", { name: `${impostor} verurteilen` }).click();
  await page.getByRole("group", { name: "Begriffe" }).getByRole("button").first().click();
  await page.getByRole("button", { name: /^Tipp:/ }).click();
  // Eine Runde: gleich das Ergebnis, im Verlauf steht, wer es war
  await expect(page.getByText(/Gewonnen hat/)).toBeVisible();
  await expect(page.getByText(new RegExp(`${impostor} war Hochstapler`))).toBeVisible();
  await expectNoScroll(page);
});
