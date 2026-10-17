import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectInView, expectNoScroll, joinRoom, newPhone, openSettings, shot, startLocal } from "./util";

const startDuel = (page: Page) => startLocal(page, "dame", ["Anna", "Ben"], { start: false });
const sq = (p: Page, name: string) => p.getByRole("button", { name: new RegExp(`^Feld ${name}( |$)`) });
async function move(p: Page, ...squares: string[]) {
  for (const s of squares) await sq(p, s).click();
}

test("Dame lokal: ziehen, Schlagzwang, schlagen, Ergebnis", async ({ page }) => {
  await startDuel(page);
  await openSettings(page);
  await shot(page, "dame-01-settings");
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("duel-0")).toContainText("12");
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("dame-board"));
  // Spielhilfe: 4 Steine können ziehen
  await expect(page.getByTestId("movable")).toHaveCount(4);

  await move(page, "c3", "d4");
  await move(page, "f6", "e5");
  // Weiß muss schlagen: d4×f6
  await expect(page.getByTestId("status")).toContainText("musst schlagen");
  await move(page, "c3");
  await expect(page.getByTestId("status")).toContainText("musst schlagen");
  await sq(page, "d4").click();
  await expect(page.getByTestId("target")).toHaveCount(1);
  await shot(page, "dame-02-capture");
  await sq(page, "f6").click();
  await expect(page.getByTestId("duel-1")).toContainText("11");
  await expect(page.getByTestId("duel-1")).toHaveAttribute("data-cur", "true");
  await shot(page, "dame-03-local");

  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Ben gibt auf" }).click();
  await page.getByRole("button", { name: "Aufgeben" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("winner")).toHaveText("Anna gewinnt");
  await expectNoScroll(page);
  await shot(page, "dame-04-result");
  await page.getByRole("button", { name: "Nochmal spielen" }).click();
  await expect(page.getByTestId("duel-0")).toContainText("Ben");
});

test("Dame auf kleinem Handy (320×568), 10×10, Brett gedreht", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startDuel(page);
  await openSettings(page);
  await page.getByRole("radio", { name: /10 × 10/ }).click();
  await page.getByRole("checkbox", { name: /Brett für Schwarz drehen/ }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("duel-0")).toContainText("20");
  await move(page, "d4", "e5");
  // Schwarz ist dran: seine Steine liegen jetzt unten
  const j10 = await sq(page, "j10").boundingBox();
  const a1 = await sq(page, "a1").boundingBox();
  expect(j10!.y).toBeGreaterThan(a1!.y);
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("dame-board"));
  await expectInView(page, page.getByTestId("status"));
  await shot(page, "dame-05-small");
});

test("Dame online mit zwei Handys", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "dame", "Anna", "8888");
  await joinRoom(guest, code, "Ben", "8888");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByTestId("status")).toContainText("Du bist dran");
  await expect(guest.getByTestId("status")).toContainText("Anna ist dran");
  // Ben sieht Schwarz unten
  const h8 = await sq(guest, "h8").boundingBox();
  const a1 = await sq(guest, "a1").boundingBox();
  expect(h8!.y).toBeGreaterThan(a1!.y);
  await expect(guest.getByTestId("movable")).toHaveCount(0);
  await move(host, "e3", "f4");
  await expect(guest.getByTestId("status")).toContainText("Du bist dran");
  await move(guest, "b6", "a5");
  await expect(host.getByTestId("status")).toContainText("Du bist dran");
  await expectNoScroll(guest);
  await shot(host, "dame-06-online-host");
  await shot(guest, "dame-07-online-guest");
});
