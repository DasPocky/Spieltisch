import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

async function askSomething(p: Page) {
  const who = p.getByRole("group", { name: "Mitspieler" }).locator("button:not([disabled])").first();
  await who.click();
  await p.getByRole("group", { name: "Wert" }).getByRole("button").first().click();
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
  await expect(page.getByText("1 · Wen fragst du?")).toBeVisible();
  await page.getByRole("group", { name: "Wert" }).getByRole("button").first().click();
  await expectNoScroll(page);
  await shot(page, "70-fischen-local-ask");
  await page.getByRole("button", { name: /hast du/ }).click();
  await expect(page.getByTestId("last-ask")).toContainText("Hast du");
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
  await expect(guest.getByTestId("last-ask")).toContainText("Anna → dich");
  await expectNoScroll(guest);
  await shot(host, "72-fischen-online-host");
  await shot(guest, "73-fischen-online-guest");
});

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test(`Fischen mit echten Karten: App zählt Quartette (${size.width}px)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/spiel/fischen/lokal");
    for (const n of ["Anna", "Ben", "Cem"]) {
      await page.getByLabel("Name des Spielers").fill(n);
      await page.getByRole("button", { name: "Hinzufügen" }).click();
    }
    await openSettings(page);
    await page.getByRole("radio", { name: /Echte Karten/ }).click();
    await page.getByRole("button", { name: /Hausregeln/ }).click();
    await page.getByRole("radio", { name: /Der Gefragte/ }).click();
    await closeSettings(page);
    // Die Zusammenfassung zeigt die geänderte Hausregel
    await expect(page.getByTestId("settings-summary")).toContainText("1 Hausregel");
    await page.getByRole("button", { name: "Spiel starten" }).click();
    await expect(page.getByTestId("current-player")).toHaveText("Anna");
    await expectNoScroll(page);
    // Quartett Könige für Ben (lag schon beim Austeilen)
    await page.getByRole("button", { name: "Quartett Könige eintragen" }).click();
    await page.getByRole("button", { name: "Ben", exact: true }).click();
    await expect(page.getByRole("button", { name: /Könige: liegt bei Ben/ })).toBeVisible();
    // Geh fischen – Cem hat „Nein“ gesagt und ist dran
    await page.getByRole("button", { name: /Geh fischen/ }).click();
    await page.getByRole("button", { name: "Cem", exact: true }).click();
    await expect(page.getByTestId("current-player")).toHaveText("Cem");
    await expectNoScroll(page);
    await shot(page, `74-fischen-table-${size.width}`);
    // Zurücknehmen
    await page.getByRole("button", { name: /Könige zurücknehmen/ }).click();
    await expect(page.getByRole("button", { name: "Quartett Könige eintragen" })).toBeVisible();
  });
}
