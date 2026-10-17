import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectInView, expectNoScroll, joinRoom, newPhone, openSettings, shot, startLocal } from "./util";

const startDuel = (page: Page, gameId: string) => startLocal(page, gameId, ["Anna", "Ben"], { start: false });
const col = (p: Page, c: number) => p.getByRole("button", { name: `Spalte ${c}`, exact: true });

test("Vier in einer Reihe lokal: Steine fallen, Reihe gewinnt, Nochmal tauscht die Farben", async ({ page }) => {
  await startDuel(page, "vier");
  await openSettings(page);
  await shot(page, "vier-01-settings");
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();

  await expect(page.getByTestId("duel-0")).toContainText("Anna");
  await expect(page.getByTestId("duel-0")).toHaveAttribute("data-cur", "true");
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("vier-board"));
  for (const c of [1, 1, 2, 2, 3]) await col(page, c).click();
  // Spielhilfe: Gewinnzug wird angeboten
  await expect(page.getByTestId("hint-chip")).toContainText(/Spalte 4|droht/);
  await shot(page, "vier-02-local");
  await col(page, 3).click();
  await col(page, 4).click();
  await expect(page.getByTestId("winner")).toHaveText("Anna gewinnt");
  await expect(page.getByTestId("win-cell")).toHaveCount(4);
  await expectNoScroll(page);
  await shot(page, "vier-03-result");

  await page.getByRole("button", { name: "Nochmal spielen" }).click();
  await expect(page.getByTestId("duel-0")).toContainText("Ben");
  await expect(page.getByTestId("duel-0")).toHaveAttribute("data-cur", "true");
});

test("Vier in einer Reihe auf kleinem Handy (320×568), großes Brett", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startDuel(page, "vier");
  await openSettings(page);
  await page.getByRole("radio", { name: /9 × 7/ }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(col(page, 9)).toBeVisible();
  for (const c of [5, 5, 6]) await col(page, c).click();
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("vier-board"));
  await expectInView(page, page.getByTestId("status"));
  await shot(page, "vier-04-small");
});

test("Vier in einer Reihe online mit zwei Handys", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "vier", "Anna", "4242");
  await joinRoom(guest, code, "Ben", "4242");
  await host.getByRole("button", { name: "Spiel starten" }).click();

  await expect(host.getByTestId("status")).toContainText("Du bist dran");
  await expect(guest.getByTestId("status")).toContainText("Anna ist dran");
  await expect(col(guest, 1)).toHaveAttribute("aria-disabled", "true");
  await col(host, 4).click();
  await expect(guest.getByTestId("status")).toContainText("Du bist dran");
  await col(guest, 4).click();
  await expect(host.getByTestId("status")).toContainText("Du bist dran");
  await expectNoScroll(host);
  await shot(host, "vier-05-online-host");
  await shot(guest, "vier-06-online-guest");
});
