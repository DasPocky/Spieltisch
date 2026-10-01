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
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(7);
  await expect(ben.getByTestId("hand").getByRole("img")).toHaveCount(7);
  await expectNoScroll(anna);
  await shot(anna, "67-uno-online");
  // Ben ist nicht dran und kann nichts tun
  await expect(ben.getByTestId("hand").locator("button:not([disabled])")).toHaveCount(0);
  await expect(ben.getByRole("button", { name: /ziehen/i }).first()).toBeDisabled();
  // Zu zweit wirken Aussetzen und Richtungswechsel so, dass Anna gleich wieder dran ist
  for (let i = 0; i < 8 && ((await ben.getByTestId("status").textContent()) ?? "").includes("ist am Zug"); i++) {
    await takeTurn(anna);
    await anna.waitForTimeout(300);
  }
  await expect.poll(async () => (await ben.getByTestId("status").textContent()) ?? "", { timeout: 5000 }).not.toContain("ist am Zug");
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
