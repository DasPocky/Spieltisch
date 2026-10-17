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
  await expect(screen.getByTestId("table-lobby")).toContainText("Wer zuerst da ist, wählt das Spiel");

  const anna = await joinByLink(browser, code, pin, "Anna");
  const ben = await joinByLink(browser, code, pin, "Ben");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("table-lobby")).toContainText("Anna wählt das Spiel und startet");
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

test("Großer Tisch ohne 3D: einfacher flacher Tisch mit Karten, Plätzen und Ablage – Partie läuft weiter", async ({ browser }) => {
  const screen = await newScreen(browser);
  // Grafik „Ohne 3D“ (wie im Profil gewählt)
  await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  await expect(screen.getByTestId("table-flat")).toBeAttached();
  await expect(screen.getByTestId("table-3d")).toHaveCount(0);
  const anna = await joinByLink(browser, code, pin, "Anna");
  await joinByLink(browser, code, pin, "Ben");
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-uno").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-view")).toContainText("Uno");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("table-seat").first()).toContainText(/· \d/);
  await screen.waitForTimeout(600);
  await shot(screen, "93-table-flach");
});

test("Ton am Tisch: Musik läuft, Regler für Effekte, Musik und Publikum, ausschaltbar – ohne Fehler", async ({ browser }) => {
  const screen = await newScreen(browser);
  const errors: string[] = [];
  screen.on("pageerror", (e) => errors.push(e.message));
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen.getByTestId("table-lobby")).toBeVisible();
  // Der Klick auf „Tisch aufbauen“ hat den Ton freigeschaltet
  await expect(screen.getByTestId("sound-panel")).toBeVisible();
  await screen.getByTestId("sound-more").click();
  const music = screen.getByRole("slider", { name: "Musik" });
  await music.fill("0");
  await screen.getByRole("slider", { name: "Publikum" }).fill("80");
  await shot(screen, "94-table-ton");
  const prefs = await screen.evaluate(() => JSON.parse(localStorage.getItem("spieltisch:prefs") ?? "{}"));
  expect(prefs.volMusic).toBe(0);
  expect(prefs.volCrowd).toBe(0.8);
  await screen.getByTestId("sound-toggle").click();
  await expect(screen.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(screen.getByRole("slider", { name: "Musik" })).toHaveCount(0);

  // Neu geladen (ohne Klick): Ton wieder an → „Ton einschalten“, bis jemand klickt
  await screen.getByTestId("sound-toggle").click();
  await screen.reload();
  await expect(screen.getByTestId("sound-unlock").or(screen.getByTestId("sound-panel"))).toBeVisible();
  if (await screen.getByTestId("sound-unlock").isVisible()) {
    await screen.getByTestId("sound-unlock").click();
    await expect(screen.getByTestId("sound-panel")).toBeVisible();
  }
  await screen.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
