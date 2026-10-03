import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

async function local(page: Page, names: string[], table = false) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/uno/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (table) await page.getByRole("radio", { name: /Echte Karten/ }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

/** Einen Zug: passende Karte legen (bei Schwarz Blau wählen) oder ziehen und ggf. passen */
async function takeTurn(p: Page) {
  // Startkarte Farbwahl: erst die Farbe bestimmen
  const pickBlue = p.getByRole("button", { name: "Blau", exact: true });
  if (await pickBlue.isVisible()) { await pickBlue.click(); await p.waitForTimeout(150); }
  const playable = p.getByTestId("hand").locator("button:not([disabled])");
  if (await playable.count()) {
    await playable.first().click();
    const blue = p.getByRole("button", { name: "Blau", exact: true });
    if (await blue.isVisible()) await blue.click();
  } else {
    await p.getByRole("button", { name: /ziehen/i }).first().click();
    const pass = p.getByRole("button", { name: "Passen" });
    await p.waitForTimeout(200);
    if ((await pass.isVisible()) && (await pass.isEnabled())) await pass.click();
  }
}

test("Uno lokal: weitergeben, legen – passt auf 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await local(page, ["Anna", "Ben", "Cem"]);
  for (let i = 0; i < 4; i++) {
    const cover = page.getByRole("button", { name: /Karten zeigen/ });
    if (await cover.isVisible()) await cover.click();
    await expect(page.getByTestId("hand").getByRole("img").first()).toBeVisible();
    if (i === 0) { await expectNoScroll(page); await shot(page, "66-uno-320"); }
    await takeTurn(page);
    await page.waitForTimeout(250);
  }
  await expectNoScroll(page);
  // Letzter Zug steht oben, „Spieler & Verlauf“ zeigt alle mit Kartenzahl
  await expect(page.getByTestId("infobar")).not.toContainText("Noch kein Zug");
  await page.getByTestId("infobar").click();
  await expect(page.getByTestId("overview")).toContainText("Karten");
  await expect(page.getByTestId("history").locator("li").first()).toBeVisible();
});

test("Uno online: jeder sieht nur seine Hand", async ({ browser }) => {
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "uno", "Anna", "7777");
  await joinRoom(ben, code, "Ben", "7777");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  // Startkarte +2 trifft den Ersten – dann hat er 9
  await expect.poll(async () => anna.getByTestId("hand").getByRole("img").count()).toBeGreaterThanOrEqual(7);
  await expect.poll(async () => ben.getByTestId("hand").getByRole("img").count()).toBeGreaterThanOrEqual(7);
  await expectNoScroll(anna);
  await shot(anna, "67-uno-online");
  // Wer nicht dran ist, kann nichts tun (Startkarte Aussetzen/Richtungswechsel/+2 lässt Ben beginnen)
  await expect(ben.getByTestId("status")).not.toBeEmpty();
  const benWaits = ((await ben.getByTestId("status").textContent()) ?? "").includes("ist am Zug");
  const [waiter, mover] = benWaits ? [ben, anna] : [anna, ben];
  await expect(waiter.getByTestId("hand").locator("button:not([disabled])")).toHaveCount(0);
  await expect(waiter.getByRole("button", { name: /ziehen/i }).first()).toBeDisabled();
  // Zu zweit wirken Aussetzen und Richtungswechsel so, dass derselbe gleich wieder dran ist
  for (let i = 0; i < 8 && ((await waiter.getByTestId("status").textContent()) ?? "").includes("ist am Zug"); i++) {
    await takeTurn(mover);
    await mover.waitForTimeout(300);
  }
  await expect.poll(async () => (await waiter.getByTestId("status").textContent()) ?? "", { timeout: 5000 }).not.toContain("ist am Zug");
});

test("Uno mit echten Karten: Punkteblock", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await local(page, ["Anna", "Ben", "Cem"], true);
  await page.getByRole("button", { name: "Anna ist leer" }).click();
  await page.getByLabel("Punkte Ben").fill("20");
  await page.getByLabel("Punkte Cem").fill("35");
  await page.getByLabel("Punkte Cem").blur();
  await expectNoScroll(page);
  await shot(page, "68-uno-table");
  await page.getByRole("button", { name: "+55 für Anna" }).click();
  await expect(page.getByText("Runde 2")).toBeVisible();
});

test("Uno Spielhilfen: spielbare Karten leuchten leise – aus im Profil, dann nicht", async ({ page }) => {
  for (const hints of [true, false]) {
    await local(page, ["Anna", "Ben"]);
    if (!hints) {
      await page.evaluate(() => localStorage.setItem("spieltisch:prefs", '{"hints":false}'));
      await page.reload();
    }
    await page.getByRole("button", { name: /Karten zeigen/ }).click();
    const playable = page.getByTestId("hand").locator("button:not([disabled])");
    await expect(page.getByTestId("hand").getByRole("img").first()).toBeVisible();
    const n = await playable.count();
    await expect(page.getByTestId("hand").locator("button.hint-glow")).toHaveCount(hints ? n : 0);
    if (hints && n) await shot(page, "hints-uno");
  }
});

test("Uno Hausregeln: 7-0 und +4-Varianten stehen unter Hausregeln", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/uno/lokal");
  await page.getByRole("button", { name: /Hausregeln/ }).click();
  await expect(page.getByText("7-0", { exact: true })).toBeVisible();
  await expect(page.getByText("Ziehen, bis es passt")).toBeVisible();
  await expect(page.getByText("Anzweifeln", { exact: true })).toBeVisible();
});
