import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectInView, expectNoScroll, joinRoom, newPhone, openSettings, shot, startLocal } from "./util";

const startDuel = (page: Page) => startLocal(page, "muehle", ["Anna", "Ben"], { start: false });
const pt = (p: Page, name: string) => p.getByRole("button", { name: new RegExp(`^Punkt ${name}( |$)`) });

test("Mühle lokal: setzen, Mühle schließen, Stein nehmen, aufgeben", async ({ page }) => {
  await startDuel(page);
  await openSettings(page);
  await shot(page, "muehle-01-settings");
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("duel-0")).toContainText("noch 9");
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("muehle-board"));

  // Weiß a7, d7, g7 – Schwarz b6, d6
  for (const p of ["a7", "b6", "d7", "d6"]) await pt(page, p).click();
  await expect(page.getByTestId("status")).toContainText("Anna, du setzt");
  await pt(page, "g7").click();
  await expect(page.getByTestId("status")).toContainText("Mühle!");
  await expect(page.getByTestId("removable")).toHaveCount(2);
  await shot(page, "muehle-02-mill");
  await pt(page, "b6").click();
  await expect(pt(page, "b6")).toHaveAccessibleName("Punkt b6");
  await expect(page.getByTestId("duel-1")).toContainText("noch 7");
  await expect(page.getByTestId("duel-1")).toHaveAttribute("data-cur", "true");
  await shot(page, "muehle-03-local");

  // Aufgeben über das Menü
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Ben gibt auf" }).click();
  await page.getByRole("button", { name: "Aufgeben" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("winner")).toHaveText("Anna gewinnt");
  await expectNoScroll(page);
  await shot(page, "muehle-04-result");
});

test("Mühle auf kleinem Handy (320×568) mit gedrehtem Brett", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startDuel(page);
  await openSettings(page);
  await page.getByRole("checkbox", { name: /Brett für Schwarz drehen/ }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await pt(page, "a7").click();
  // Schwarz ist dran: das Brett liegt gedreht, a7 ist jetzt unten rechts
  const box = await pt(page, "a7").boundingBox();
  const g1 = await pt(page, "g1").boundingBox();
  expect(box!.y).toBeGreaterThan(g1!.y);
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("muehle-board"));
  await expectInView(page, page.getByTestId("status"));
  await shot(page, "muehle-05-small");
});

test("Mühle online mit zwei Handys", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "muehle", "Anna", "5151");
  await joinRoom(guest, code, "Ben", "5151");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByTestId("status")).toContainText("Du setzt");
  await expect(guest.getByTestId("status")).toContainText("Anna ist dran");
  await pt(host, "d7").click();
  await expect(guest.getByTestId("status")).toContainText("Du setzt");
  // Ben sieht seine Farbe unten: d7 von Anna liegt bei ihm unten
  const d7 = await pt(guest, "d7").boundingBox();
  const d1 = await pt(guest, "d1").boundingBox();
  expect(d7!.y).toBeGreaterThan(d1!.y);
  await pt(guest, "d6").click();
  await expect(host.getByTestId("duel-1")).toContainText("noch 8");
  await expectNoScroll(guest);
  await shot(host, "muehle-06-online-host");
  await shot(guest, "muehle-07-online-guest");
});
