import { expect, test, type Browser, type Page } from "@playwright/test";
import { newPhone, shot } from "./util";

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

async function joinByLink(browser: Browser, code: string, pin: string, name: string): Promise<Page> {
  const phone = await newPhone(browser);
  await phone.goto(`/r/${code}#pin=${pin}`);
  // Die PIN kommt aus dem Link und verschwindet gleich wieder aus der Adresse
  await expect(phone.getByLabel("PIN")).toHaveValue(pin);
  await expect(phone).toHaveURL(new RegExp(`/r/${code}$`));
  await phone.getByLabel("Dein Name").fill(name);
  await phone.getByRole("button", { name: "Beitreten" }).click();
  return phone;
}

test("Großer Tisch: Bildschirm baut auf, Handys treten per QR-Link bei, Mau-Mau läuft am Tisch mit", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  await expect(screen.getByTestId("table-lobby")).toContainText(code);
  await expect(screen.getByTestId("table-lobby")).toContainText("Wer zuerst beitritt");

  const anna = await joinByLink(browser, code, pin, "Anna");
  const ben = await joinByLink(browser, code, pin, "Ben");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("table-lobby")).toContainText("Anna wählt am Handy das Spiel");
  await shot(screen, "90-table-lobby");

  // Wer zuerst kam, ist Host: Spiel wählen und starten
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-lobby")).toBeHidden();
  await expect(screen.getByTestId("table-view")).toContainText("Mau-Mau");
  await expect(screen.getByTestId("table-seat").first()).toContainText(/· 5/);

  // Wer dran ist, zieht am Handy – der Tisch zählt mit
  const turn = screen.locator('[data-testid="table-seat"][data-turn="true"]');
  await expect(turn).toHaveCount(1);
  const mover = (await turn.textContent())?.includes("Anna") ? anna : ben;
  await mover.getByRole("button", { name: /ziehen/i }).first().click();
  await expect(screen.getByTestId("table-seat").filter({ hasText: /· [67]/ })).toHaveCount(1);
  await shot(screen, "91-table-maumau");
  // Der Tisch zeigt keine fremden Karten – nur die Anzahl
  await expect(screen.getByTestId("hand")).toHaveCount(0);
});

test("Großer Tisch: falsche PIN wird abgelehnt, die richtige verbindet", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;

  const other = await newScreen(browser);
  await other.goto("/tisch");
  await other.getByLabel("Raumcode").fill(code);
  await other.getByLabel("PIN").fill(pin === "111111" ? "222222" : "111111");
  await other.getByTestId("table-connect").click();
  await expect(other.getByRole("alert")).toContainText("PIN");
  await other.getByLabel("PIN des Raums").fill(pin);
  await other.getByRole("button", { name: "Verbinden" }).click();
  await expect(other.getByTestId("table-lobby")).toContainText(code);
});
