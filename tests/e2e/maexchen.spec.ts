import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectInView, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

async function addPlayers(page: Page, names: string[]) {
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("Mäxchen lokal: Sichtschutz, Becher anheben, ansagen, aufdecken", async ({ page }) => {
  await page.goto("/spiel/maexchen/lokal");
  await addPlayers(page, ["Anna", "Ben", "Cem"]);
  await openSettings(page);
  await page.getByRole("button", { name: /Hausregeln/ }).click();
  await expect(page.getByText("Blind weitergeben")).toBeVisible();
  await shot(page, "maexchen-01-settings");
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();

  // Sichtschutz: erst „Ich bin Anna“
  await expect(page.getByTestId("handoff")).toContainText("Anna");
  await expectNoScroll(page);
  await shot(page, "maexchen-02-handoff");
  await page.getByRole("button", { name: "Ich bin Anna" }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  await page.getByRole("button", { name: "Würfeln" }).click();
  // Wurf erst nach Antippen sichtbar
  await expect(page.getByTestId("my-roll")).toHaveCount(0);
  await page.getByRole("button", { name: /Becher anheben/ }).click();
  await expect(page.getByTestId("my-roll")).toBeVisible();
  await page.getByRole("radio", { name: "54" }).click();
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("announce"));
  await shot(page, "maexchen-03-roll");
  await page.getByTestId("announce").click();

  // Ben: Sichtschutz, dann Ansage sehen und aufdecken
  await expect(page.getByTestId("handoff")).toContainText("Ben");
  await expect(page.getByTestId("announced")).toHaveText("54");
  await page.getByRole("button", { name: "Ich bin Ben" }).click();
  await expect(page.getByText("Glaubst du")).toBeVisible();
  await expect(page.getByTestId("hint-chip")).toContainText("%");
  await expectNoScroll(page);
  await shot(page, "maexchen-04-believe");
  await page.getByTestId("reveal-btn").click();
  await expect(page.getByTestId("reveal")).toContainText(/Stimmt!|Gelogen!/);
  await expectNoScroll(page);
  await shot(page, "maexchen-05-reveal");
});

test("Mäxchen online: Wurf nur für den Würfelnden, Ansage für alle", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "maexchen", "Anna", "4242");
  await joinRoom(guest, code, "Ben", "4242");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(guest.getByText("Warte auf Anna")).toBeVisible();
  await host.getByRole("button", { name: "Würfeln" }).click();
  await host.getByRole("button", { name: /Becher anheben/ }).click();
  await expect(host.getByTestId("my-roll")).toBeVisible();
  // Ben sieht den Becher, aber keinen Wurf
  await expect(guest.getByTestId("current-player")).toContainText("Anna");
  await expect(guest.getByText("hat gewürfelt")).toBeVisible();
  await expect(guest.getByTestId("my-roll")).toHaveCount(0);
  await expect(guest.getByRole("button", { name: /Becher anheben/ })).toHaveCount(0);
  await expectNoScroll(host);
  await shot(host, "maexchen-06-online-host");
  await shot(guest, "maexchen-07-online-guest");
  await host.getByRole("radio", { name: "Sechserpasch" }).click();
  await host.getByTestId("announce").click();
  await expect(guest.getByTestId("announced")).toHaveText("Sechserpasch");
  await expect(host.getByText("Warte auf Ben")).toBeVisible();
  // Ben könnte blind weitergeben – oder deckt auf
  await expect(guest.getByRole("button", { name: /blind weitergeben/ })).toBeVisible();
  await guest.getByTestId("reveal-btn").click();
  await expect(host.getByTestId("reveal")).toBeVisible();
  await expect(guest.getByTestId("reveal")).toBeVisible();
  await expectNoScroll(guest);
  await shot(guest, "maexchen-08-online-reveal");
});

test("Mäxchen mit echten Würfeln auf kleinem Handy bis zum Sieg", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/spiel/maexchen/lokal");
  await addPlayers(page, ["Anna", "Ben"]);
  await openSettings(page);
  await page.getByRole("radio", { name: /Echte Würfel/ }).click();
  await page.getByRole("button", { name: /Leben.*verringern/ }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("current-player")).toHaveText("Anna");
  await page.getByRole("radio", { name: "43" }).click();
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("announce"));
  await shot(page, "maexchen-09-table-320");
  await page.getByTestId("announce").click();
  // Ben glaubt und sagt höher an
  await expect(page.getByRole("radio", { name: "43" })).toBeDisabled();
  await page.getByRole("radio", { name: "Fünferpasch" }).click();
  await page.getByTestId("announce").click();
  // Anna deckt auf: gelogen – Ben verliert
  await page.getByRole("button", { name: "Aufdecken" }).click();
  await expectNoScroll(page);
  await shot(page, "maexchen-10-table-reveal-ask");
  await page.getByRole("button", { name: "Gelogen" }).click();
  await expect(page.getByTestId("reveal")).toContainText("Ben verliert 1 Leben");
  await expect(page.getByTestId("current-player")).toHaveText("Ben");
  await expectNoScroll(page);
  // Ben sagt Mäxchen, Anna deckt auf, es stimmt: doppelt – Anna (2 Leben) ist raus
  await page.getByRole("radio", { name: "Mäxchen" }).click();
  await page.getByTestId("announce").click();
  await page.getByRole("button", { name: "Aufdecken!" }).click();
  await page.getByRole("button", { name: "Stimmt" }).click();
  await expect(page.getByTestId("winner")).toHaveText("Ben");
  await expectNoScroll(page);
  await shot(page, "maexchen-11-result");
});

test("Mäxchen: Regeln erklären Rangfolge und Hausregeln", async ({ page }) => {
  await page.goto("/spiel/maexchen/lokal");
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Regeln: Mäxchen" }).click();
  await expect(page.getByText("Mäxchen kostet doppelt")).toBeVisible();
  await shot(page, "maexchen-12-rules");
});
