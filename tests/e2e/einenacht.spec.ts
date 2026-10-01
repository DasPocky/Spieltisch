import { expect, test } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

const NAMES = ["Anna", "Ben", "Cem", "Dora"];

test("Eine Nacht lokal: Karten herumreichen, Nacht am Gerät, Auflösung", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/einenacht/lokal");
  for (const n of NAMES) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  // Ablauf von Hand mit „Weiter“ (die Automatik prüft der Werwolf-Test)
  await page.getByRole("checkbox", { name: /Automatik/ }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await page.getByRole("button", { name: "Anna", exact: true }).click();
  await page.getByRole("button", { name: /Deine Karte aufdecken/ }).click();
  await expect(page.getByTestId("on-role")).toBeVisible();
  await page.getByRole("button", { name: "Verdeckt – weitergeben" }).click();
  await page.getByRole("button", { name: /Nacht beginnen/ }).click();
  for (let i = 0; i < 12 && (await page.getByTestId("on-phase").textContent())?.includes("Nacht"); i++) {
    // Pflicht: der Betrunkene tauscht mit Karte 1
    const drunk = page.getByRole("group", { name: "Karten in der Mitte" }).getByRole("button", { name: "Karte 1" });
    if ((await page.getByRole("heading", { name: "Betrunkener", exact: true }).isVisible()) && (await drunk.isEnabled())) await drunk.click();
    if (i === 2) await shot(page, "58-on-local-night");
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId("countdown")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "59-on-local-day");
  await page.getByRole("group").getByRole("button", { name: "Ben" }).click();
  await page.getByRole("button", { name: /stirbt/ }).click();
  await expect(page.getByTestId("winner")).toBeVisible();
  await shot(page, "65-on-result");
});

test("Eine Nacht online mit vier Handys", async ({ browser }) => {
  const phones = await Promise.all(NAMES.map(() => newPhone(browser)));
  const [host] = phones;
  const code = await createRoom(host, "einenacht", "Anna", "3333");
  for (let i = 1; i < 4; i++) await joinRoom(phones[i], code, NAMES[i], "3333");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of phones) await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  await expect(host.getByTestId("on-phase")).toHaveText("Nacht");
  // Jeder erledigt seine Nacht: Betrunkener tauscht, alle anderen tippen „Fertig“
  for (const p of phones) {
    const drunk = p.getByRole("group", { name: "Karten in der Mitte" }).getByRole("button", { name: "Karte 1" });
    if (await p.getByText("Tausche mit einer Karte aus der Mitte").isVisible()) await drunk.click();
    else await p.getByRole("button", { name: "Fertig" }).click();
  }
  await expect(host.getByTestId("on-phase")).toHaveText("Tag");
  await expectNoScroll(phones[1]);
  await shot(phones[1], "66-on-online-day");
  for (const [i, p] of phones.entries()) await p.getByRole("group").getByRole("button", { name: NAMES[(i + 1) % 4] }).click();
  await expect(host.getByTestId("winner")).toBeVisible();
  await expect(phones[2].getByTestId("winner")).toBeVisible();
});
