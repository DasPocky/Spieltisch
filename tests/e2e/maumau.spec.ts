import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

/** Einen Zug machen: passende Karte legen (beim Unter eine Farbe wünschen) oder ziehen */
async function takeTurn(p: Page) {
  const playable = p.getByTestId("hand").locator("button:not([disabled])");
  if (await playable.count()) {
    await playable.first().click();
    const wish = p.getByRole("button", { name: "Rot", exact: true });
    if (await wish.isVisible()) await wish.click();
  } else {
    await p.getByRole("button", { name: /ziehen/i }).first().click();
    const pass = p.getByRole("button", { name: "Passen" });
    await p.waitForTimeout(200);
    if ((await pass.isVisible()) && (await pass.isEnabled())) await pass.click();
  }
}

test("Mau-Mau lokal: Handy weitergeben und spielen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/maumau/lokal");
  for (const n of ["Anna", "Ben", "Cem"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /Karten zeigen/ }).click();
    await expect(page.getByTestId("hand").getByRole("img").first()).toBeVisible();
    if (i === 0) { await expectNoScroll(page); await shot(page, "60-maumau-local-hand"); }
    await takeTurn(page);
    await page.waitForTimeout(250);
    // Nach Acht oder Ass kann derselbe Spieler weiter dran sein – dann gibt es keinen Deckel
    if (!(await page.getByRole("button", { name: /Karten zeigen/ }).isVisible())) await takeTurn(page).catch(() => {});
  }
  await expectNoScroll(page);
  await shot(page, "61-maumau-local-cover");
});

test("Mau-Mau online mit zwei Handys", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "maumau", "Anna", "7777");
  await joinRoom(guest, code, "Ben", "7777");
  // Kartenspiele: keine Einstellung „Wer darf für den Spieler am Zug handeln?“
  await expect(host.getByText("Wer darf für den Spieler am Zug handeln?")).toHaveCount(0);
  await host.getByRole("button", { name: "Spiel starten" }).click();

  await expect(host.getByTestId("hand").getByRole("img")).toHaveCount(5);
  await expect(guest.getByTestId("hand").getByRole("img")).toHaveCount(5);
  await expectNoScroll(host);
  await shot(host, "62-maumau-online-host");
  await shot(guest, "63-maumau-online-guest");

  // Wer nicht dran ist, kann nichts legen
  const first = (await host.getByTestId("status").textContent())?.includes("ist am Zug") ? guest : host;
  const other = first === host ? guest : host;
  await expect(other.getByTestId("hand").locator("button:not([disabled])")).toHaveCount(0);
  await expect(other.getByRole("button", { name: /ziehen/i }).first()).toBeDisabled();
  await takeTurn(first);
  await expect.poll(async () => (await other.getByTestId("status").textContent()) ?? "").not.toContain("ist am Zug");
  await takeTurn(other);
  await shot(host, "64-maumau-online-after");
});
