import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot, startLocal } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

async function startLudo(page: Page, names: string[], settings?: (p: Page) => Promise<void>) {
  await startLocal(page, "ludo", names, { fresh: false, settings });
  await expect(page.getByTestId("board")).toBeVisible();
}

/** Positionen der Figuren des Spielers am Zug */
async function positions(page: Page): Promise<number[]> {
  return Promise.all([0, 1, 2, 3].map(async (i) => Number(await page.getByTestId(`piece-${i}`).getAttribute("data-pos"))));
}

/** Einen Zug mit App-Würfel: würfeln, ggf. die erste leuchtende Figur antippen */
async function appTurn(page: Page) {
  const roll = page.getByRole("button", { name: "Würfeln" });
  await expect(roll).toBeEnabled();
  await roll.click();
  await page.waitForTimeout(150);
  const glow = page.locator("[data-glow]");
  if (await glow.count()) {
    await glow.first().click();
    await page.waitForTimeout(900);
  }
}

test("Ludo lokal mit App-Würfel: Brett, Würfeln, Figur ziehen", async ({ page }) => {
  await startLudo(page, ["Anna", "Ben", "Cem", "Dora"]);
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  await expectNoScroll(page);
  await shot(page, "ludo-01-start");
  // Original: eine Figur steht schon draußen und muss das Startfeld räumen
  expect(await positions(page)).toEqual([0, -1, -1, -1]);
  await page.getByRole("button", { name: "Würfeln" }).click();
  await expect(page.locator("[data-glow]")).toHaveCount(1);
  await expect(page.getByTestId("target")).toHaveCount(1);
  await shot(page, "ludo-02-rolled");
  const die = Number(((await page.getByTestId("die").getByRole("img").getAttribute("aria-label")) ?? "").replace(/\D/g, ""));
  await page.locator("[data-glow]").first().click();
  await page.waitForTimeout(1200);
  if (die !== 6) await expect(page.getByTestId("current-player")).toHaveText("Ben");
  for (let i = 0; i < 6; i++) await appTurn(page);
  await expectNoScroll(page);
  await shot(page, "ludo-03-later");
  // Regeln im Menü
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Regeln: Ludo" }).click();
  await expect(page.getByText("Startfeld räumen")).toBeVisible();
  await shot(page, "ludo-04-rules");
});

test("Ludo Einstellungen in der Lobby", async ({ page }) => {
  await page.goto("/spiel/ludo/lokal");
  await openSettings(page);
  await shot(page, "ludo-05-settings");
  await page.getByRole("button", { name: "Hausregeln" }).click();
  await expect(page.getByText("Schlagzwang")).toBeVisible();
  await shot(page, "ludo-05-settings");
});

test("Ludo mit echtem Würfel auf kleinem Handy bis zum Sieg", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startLudo(page, ["Anna", "Ben"], async (p) => { await p.getByRole("radio", { name: /Echter Würfel/ }).click(); });
  await expectNoScroll(page);
  await shot(page, "ludo-06-small-real");
  // Anna zieht gezielt, Ben würfelt immer eine 1
  for (let step = 0; step < 200; step++) {
    if (await page.getByTestId("winner").count()) break;
    const who = await page.getByTestId("current-player").textContent();
    let value = 1;
    if (who === "Anna") {
      const ps = await positions(page);
      const own = (q: number) => ps.includes(q);
      const ok = (d: number) => (d === 6 && ps.includes(-1) && !own(0)) || ps.some((p) => {
        if (p < 0 || p + d > 43 || own(p + d)) return false;
        return !ps.some((q) => q >= 40 && q > p && q < p + d);
      });
      value = [6, 5, 4, 3, 2, 1].find(ok) ?? 6;
    }
    const btn = page.getByRole("button", { name: `${value} gewürfelt` });
    await expect(btn).toBeEnabled();
    await btn.click();
    const glow = page.locator("[data-glow]");
    await page.waitForTimeout(80);
    if (await glow.count()) {
      await glow.first().click();
      await page.waitForTimeout(150 * value + 300);
    }
    if (step === 3) await expectNoScroll(page);
  }
  await expect(page.getByTestId("winner")).toHaveText("Anna");
  await expectNoScroll(page);
  await shot(page, "ludo-07-result");
});

test("Ludo mit sechs Farben auf kleinem Handy", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startLudo(page, ["Anna", "Ben", "Cem", "Dora", "Emil", "Fiona"], async (p) => { await p.getByRole("radio", { name: /6 Farben/ }).click(); });
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  for (let i = 0; i < 4; i++) await appTurn(page);
  await expectNoScroll(page);
  await shot(page, "ludo-11-six");
});

test("Ludo online mit zwei Handys: jeder bewegt seine Farbe", async ({ browser }) => {
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "ludo", "Anna", "7777");
  await joinRoom(ben, code, "Ben", "7777");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("board")).toBeVisible();
  await expect(ben.getByTestId("board")).toBeVisible();
  await expect(anna.getByTestId("current-player")).toHaveText("Du");
  await expect(ben.getByTestId("current-player")).toHaveText("Anna");
  await expect(ben.getByRole("button", { name: "Würfeln" })).toHaveCount(0);
  await expect(ben.getByTestId("status")).toContainText("Warte auf Anna");
  await expectNoScroll(anna);
  await expectNoScroll(ben);
  await anna.getByRole("button", { name: "Würfeln" }).click();
  await expect(anna.locator("[data-glow]")).toHaveCount(1);
  // Ben sieht keine leuchtenden Figuren und kann nicht ziehen
  await expect(ben.locator("[data-glow]")).toHaveCount(0);
  await shot(anna, "ludo-08-online-anna");
  await shot(ben, "ludo-09-online-ben");
  await anna.locator("[data-glow]").first().click();
  // Bis Ben dran ist (eine 6 heißt nochmal)
  for (let i = 0; i < 8 && (await anna.getByTestId("current-player").textContent()) === "Du"; i++) await appTurn(anna);
  await expect(ben.getByTestId("current-player")).toHaveText("Du");
  await appTurn(ben);
  await shot(ben, "ludo-10-online-ben-turn");
});
