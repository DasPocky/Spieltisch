import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

async function local(page: Page, names: string[], table = false) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/phase10/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (table) await page.getByRole("radio", { name: /Echte Karten/ }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

const hand = (p: Page) => p.getByTestId("hand").getByRole("button");

test("Phase 10 lokal: ziehen, Auslage öffnen, ablegen – passt auf 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await local(page, ["Anna", "Ben", "Cem"]);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(hand(page)).toHaveCount(10);
  await page.getByRole("button", { name: "Ziehen", exact: true }).click();
  await expect(hand(page)).toHaveCount(11);
  await page.getByRole("button", { name: "Phase auslegen" }).click();
  await expect(page.getByTestId("slots").getByText("3 Gleiche")).toHaveCount(2);
  await expectNoScroll(page);
  await shot(page, "72-phase10-lay-320");
  await page.getByRole("button", { name: "Zurück" }).click();
  await hand(page).first().click();
  await page.getByRole("button", { name: /ablegen$/ }).click();
  await expect(page.getByRole("button", { name: /Ich bin/ })).toBeVisible();
  await expectNoScroll(page);
});

test("Phase 10 online: Hände geheim, Zug geht weiter", async ({ browser }) => {
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "phase10", "Anna", "7777");
  await joinRoom(ben, code, "Ben", "7777");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(hand(anna)).toHaveCount(10);
  await expect(hand(ben)).toHaveCount(10);
  // Ben gibt als zweiter Spieler, Anna beginnt
  const first = (await anna.getByTestId("status").textContent())?.includes("ist am Zug") ? ben : anna;
  const other = first === anna ? ben : anna;
  await expect(other.getByRole("button", { name: "Ziehen", exact: true })).toBeDisabled();
  await first.getByRole("button", { name: "Ziehen", exact: true }).click();
  await expect(hand(first)).toHaveCount(11);
  await expectNoScroll(first);
  await shot(first, "73-phase10-online");
  await hand(first).last().click();
  await first.getByRole("button", { name: /ablegen$/ }).click();
  await expect(other.getByRole("button", { name: "Ziehen", exact: true })).toBeEnabled();
});

test("Phase 10 mit echten Karten: Phasen und Punkte", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await local(page, ["Anna", "Ben", "Cem"], true);
  await page.getByLabel("Punkte Anna").fill("0");
  await page.getByLabel("Punkte Ben").fill("35");
  await page.getByLabel("Punkte Cem").fill("60");
  await page.getByLabel("Punkte Cem").blur();
  await page.getByRole("button", { name: "Anna hat Phase 1 geschafft" }).click();
  await expectNoScroll(page);
  await shot(page, "74-phase10-table");
  await page.getByRole("button", { name: "Runde 1 abschließen" }).click();
  await expect(page.getByRole("button", { name: "Anna hat Phase 2 geschafft" })).toBeVisible();
});
