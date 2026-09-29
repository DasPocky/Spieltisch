import { expect, test, type Browser, type Page } from "@playwright/test";
import { expectNoScroll, shot } from "./util";

async function newPhone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
  return ctx.newPage();
}

async function createRoom(host: Page, name: string, pin: string): Promise<string> {
  await host.goto("/spiel/tutto");
  await host.getByLabel("Dein Name").fill(name);
  await host.getByLabel("PIN (4–8 Ziffern)").fill(pin);
  await host.getByRole("button", { name: "Raum erstellen" }).click();
  await expect(host).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  const code = (await host.getByTestId("room-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);
  return code;
}

async function joinRoom(page: Page, code: string, name: string, pin: string) {
  await page.goto("/");
  await page.getByLabel("Raum beitreten").fill(code);
  await page.getByRole("button", { name: "Los" }).click();
  await expect(page.getByText(`Tutto · Raum`)).toBeVisible();
  await page.getByLabel("Dein Name").fill(name);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Beitreten" }).click();
}

test("Zwei Handys spielen online in einem Raum", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);

  const code = await createRoom(host, "Anna", "4711");
  await shot(host, "20-online-lobby-host");

  // Falsche PIN wird abgelehnt
  await joinRoom(guest, code, "Ben", "0000");
  await expect(guest.getByRole("alert")).toHaveText("Die PIN stimmt nicht.");

  // Richtige PIN
  await guest.getByLabel("PIN").fill("4711");
  await guest.getByRole("button", { name: "Beitreten" }).click();
  await expect(guest.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible();
  await expect(host.getByText("Ben")).toBeVisible();
  await shot(guest, "21-online-lobby-guest");

  // Nur der Host kann Einstellungen ändern
  await expect(guest.getByRole("radio", { name: /App-Würfel/ })).toBeDisabled();
  await host.getByRole("radio", { name: /App-Würfel/ }).click();
  await expect(guest.getByRole("radio", { name: /App-Würfel/ })).toHaveAttribute("aria-checked", "true");

  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(guest.getByTestId("current-player")).toHaveText("Anna");
  await expect(host.getByTestId("current-player")).toHaveText("Du");
  await expect(guest.getByText("Warte auf Anna")).toBeVisible();

  // Die Karte liegt offen – bei Stopp macht der Spieler am Zug weiter, bis gewürfelt werden kann
  const actor = async () => ((await host.getByTestId("current-player").textContent()) === "Du" ? host : guest);
  for (let i = 0; i < 12; i++) {
    await host.waitForTimeout(500);
    const p = await actor();
    if (await p.getByRole("button", { name: /Würfeln/ }).isVisible()) break;
    await p.getByRole("button", { name: /ächster Spieler/ }).click();
  }
  const roller = await actor();
  await roller.getByRole("button", { name: /Würfeln/ }).click();
  const dice = (p: Page) => p.getByRole("img", { name: /^Würfel \d$/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await expect(roller.getByRole("img", { name: /^Würfel \d$/ }).first()).toBeVisible();
  const rolled = await dice(roller);
  expect(rolled.length).toBe(6);
  await expect.poll(() => dice(roller === host ? guest : host)).toEqual(rolled);
  await host.waitForTimeout(500);
  await expectNoScroll(host);
  await expectNoScroll(guest);
  await shot(host, "22-online-host");
  await shot(guest, "23-online-guest");

  // Der Gast ist nicht am Zug: keine Würfel-Knöpfe
  if ((await guest.getByTestId("current-player").textContent()) === "Anna") {
    await expect(guest.getByRole("button", { name: /Würfeln/ })).toHaveCount(0);
    await expect(guest.getByText("Warte auf Anna")).toBeVisible();
  }

  // Neu laden: Wiederverbinden per Token ohne PIN
  await guest.reload();
  await expect(guest.getByTestId("current-player")).toBeVisible();
  await expect(guest.getByLabel("PIN")).toHaveCount(0);

  // Host löscht den Raum – der Gast fliegt raus
  await host.getByRole("button", { name: "Menü" }).click();
  await host.getByRole("button", { name: "Raum löschen" }).click();
  await host.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(guest.getByRole("heading", { name: "Raum beendet" })).toBeVisible();
  await expect(guest.getByText("Der Host hat den Raum gelöscht.")).toBeVisible();
  await shot(guest, "24-online-closed");

  await guest.goto(`/r/${code}`);
  await expect(guest.getByRole("heading", { name: `Raum ${code} gibt es nicht` })).toBeVisible();
});

test("Host entfernt einen Spieler", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "Anna", "123456");
  await joinRoom(guest, code, "Ben", "123456");
  await expect(host.getByText("Ben")).toBeVisible();
  await host.getByRole("button", { name: "Ben entfernen" }).click();
  await host.getByRole("button", { name: "Entfernen", exact: true }).click();
  await expect(guest.getByText("Du wurdest aus dem Raum entfernt.")).toBeVisible();
});

test("Host wechselt in der Lobby zu Kniffel", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "Anna", "2468");
  await joinRoom(guest, code, "Ben", "2468");
  await host.getByRole("button", { name: /Gespielt wird/ }).click();
  await host.getByRole("button", { name: /Kniffel/ }).click();
  await expect(guest.getByText("Gespielt wird")).toBeVisible();
  await expect(guest.getByRole("button", { name: /Gespielt wird Kniffel/ })).toBeVisible();
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(guest.getByText("Warte auf Anna")).toBeVisible();
  await host.getByRole("button", { name: /Würfeln/ }).click();
  const dice = (p: Page) => p.getByRole("img", { name: /^Würfel \d$/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await expect.poll(() => dice(host)).toHaveLength(5);
  await expect.poll(() => dice(guest)).toEqual(await dice(host));
  await expectNoScroll(guest);
  await shot(host, "36-kniffel-online-host");
  await shot(guest, "37-kniffel-online-guest");
  await host.getByRole("button", { name: /Chance/ }).click();
  await host.getByRole("button", { name: /eintragen/ }).click();
  await expect(guest.getByTestId("current-player")).toHaveText("Du");
  await expect(guest.getByRole("button", { name: /Würfeln/ })).toBeVisible();
});

test("Unbekannter Raum", async ({ page }) => {
  await page.goto("/r/ZZZZZ");
  await expect(page.getByRole("heading", { name: "Raum ZZZZZ gibt es nicht" })).toBeVisible();
});

test("Spielleiter-Funktionen: Host spielt normal mit, bis er sie einschaltet", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "Anna", "5151");
  await joinRoom(guest, code, "Ben", "5151");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(guest.getByTestId("current-player")).toBeVisible();
  // Anna beendet ihren Zug, Ben ist dran – Anna sieht nur „Warte auf Ben“
  await host.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
  await expect(host.getByText("Warte auf Ben")).toBeVisible();
  await host.getByRole("button", { name: "Menü" }).click();
  await expect(host.getByRole("button", { name: /zurücknehmen/ })).toHaveCount(0);
  await host.getByRole("checkbox", { name: /Spielleiter-Funktionen/ }).click();
  await expect(host.getByRole("button", { name: /zurücknehmen/ })).toBeVisible();
  await host.keyboard.press("Escape");
  await expect(host.getByText("Warte auf Ben")).toHaveCount(0);
  // Gast hat den Schalter nicht
  await guest.getByRole("button", { name: "Menü" }).click();
  await expect(guest.getByRole("checkbox", { name: /Spielleiter-Funktionen/ })).toHaveCount(0);
});
