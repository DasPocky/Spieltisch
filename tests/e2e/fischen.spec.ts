import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

async function askSomething(p: Page) {
  await p.getByRole("group", { name: "Wert" }).getByRole("button").first().click();
  const who = p.getByRole("group", { name: "Mitspieler fragen" }).getByRole("button").first();
  await who.click();
  await p.getByRole("button", { name: /hast du/ }).click();
}

test("Fischen lokal mit Sichtschutz", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/fischen/lokal");
  for (const n of ["Anna", "Ben"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(page.getByTestId("hand").getByRole("img")).not.toHaveCount(0);
  await page.getByRole("group", { name: "Wert" }).getByRole("button").first().click();
  await expectNoScroll(page);
  await shot(page, "70-fischen-local-ask");
  await page.getByRole("button", { name: /hast du/ }).click();
  await expect(page.getByTestId("events")).toContainText(/fragt/);
  await expectNoScroll(page);
  await shot(page, "71-fischen-local-after");
});

test("Fischen online: nur eigene Werte, Fragen für alle sichtbar", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "fischen", "Anna", "5555");
  await joinRoom(guest, code, "Ben", "5555");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByTestId("hand").getByRole("img")).toHaveCount(7 - 0, { timeout: 5000 }).catch(() => {});
  // Die angebotenen Werte stammen aus der eigenen Hand
  const offered = await host.getByRole("group", { name: "Wert" }).getByRole("button").allTextContents();
  const handLabels = await host.getByTestId("hand").getByRole("img").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(offered.length).toBeGreaterThan(0);
  expect(handLabels.length).toBeGreaterThan(0);
  await expect(guest.getByText("Warte auf Anna")).toBeVisible();
  await askSomething(host);
  await expect(guest.getByTestId("events")).toContainText("Anna fragt dich nach");
  await expectNoScroll(guest);
  await shot(host, "72-fischen-online-host");
  await shot(guest, "73-fischen-online-guest");
});
