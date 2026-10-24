import { expect, test, type Browser, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone } from "./util";

/** Screenshots fürs Rollenmodell (390×844 und 320×568) */
const SHOT = (p: Page, name: string) => p.waitForTimeout(400).then(() => p.screenshot({ path: `screenshots/geraete-${name}.png` }));

async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "de-DE" });
  return ctx.newPage();
}

async function openDevice(page: Page) {
  await page.getByRole("button", { name: "Menü" }).click();
  await expect(page.getByTestId("device-row")).toBeVisible();
}

test("Mein Gerät ist …: Spiel-Handy wird Fernseher und zurück, Gast sieht keine Fernbedienung", async ({ browser }) => {
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "maumau", "Anna", "4712");
  await joinRoom(ben, code, "Ben", "4712");

  // Handy: „Dieses Gerät: Spiel-Handy“ im Menü unter „Mein Gerät“
  await openDevice(anna);
  await expect(anna.getByTestId("device-role")).toHaveText("Spiel-Handy");
  await SHOT(anna, "menue");
  await anna.getByTestId("device-row").click();
  await expect(anna.getByTestId("device-sheet")).toBeVisible();
  await expect(anna.getByTestId("device-current")).toContainText("Spiel-Handy");
  await expect(anna.getByTestId("device-switch-screen")).toBeVisible();
  await expectNoScroll(anna);
  await SHOT(anna, "blatt");
  // Kleines Handy: Menü und Blatt neu geöffnet, ohne Scrollen
  await anna.keyboard.press("Escape");
  await anna.setViewportSize({ width: 320, height: 568 });
  await openDevice(anna);
  await SHOT(anna, "menue-klein");
  await anna.getByTestId("device-row").click();
  await expect(anna.getByTestId("device-sheet")).toBeVisible();
  await expectNoScroll(anna);
  await SHOT(anna, "blatt-klein");
  await anna.setViewportSize({ width: 390, height: 844 });

  // Wechsel: dieses Handy wird zum Fernseher (PIN wie am Fernseher) – und der Weg zurück steht da
  await anna.getByTestId("device-switch-screen").click();
  await expect(anna).toHaveURL(new RegExp(`/tisch/${code}$`));
  await expect(anna.getByTestId("tv-back")).toBeVisible();
  await anna.getByLabel("PIN des Raums").fill("4712");
  await anna.getByRole("button", { name: "Verbinden" }).click();
  await expect(anna.getByTestId("table-view")).toBeVisible();
  await anna.mouse.move(100, 100);
  await anna.mouse.move(200, 300);
  await expect(anna.getByTestId("tv-menu")).toHaveAttribute("data-shown", "true");
  await expect(anna.getByTestId("tv-role")).toContainText("Großer Bildschirm");
  await SHOT(anna, "handy-als-fernseher");
  await anna.getByTestId("tv-back").click();
  await expect(anna).toHaveURL(new RegExp(`/r/${code}$`));
  await openDevice(anna);
  await expect(anna.getByTestId("device-role")).toHaveText("Spiel-Handy");
  await anna.keyboard.press("Escape");

  // Ein echter Fernseher kommt dazu: Host wird Fernbedienung, Gast bleibt Spiel-Handy ohne Fernbedienung
  const tv = await newScreen(browser);
  await tv.goto("/tisch");
  await tv.getByLabel("Raumcode").fill(code);
  await tv.getByLabel("PIN").fill("4712");
  await tv.getByTestId("table-connect").click();
  await expect(tv.getByTestId("table-lobby")).toBeVisible();
  await tv.mouse.move(300, 300);
  await tv.mouse.move(600, 400);
  await expect(tv.getByTestId("tv-role")).toContainText("Großer Bildschirm");
  await expect(tv.getByTestId("tv-back")).toHaveCount(0);
  await tv.waitForTimeout(400);
  await tv.screenshot({ path: "screenshots/geraete-fernseher.png" });

  await openDevice(anna);
  await expect(anna.getByTestId("device-role")).toHaveText("Fernbedienung");
  await anna.getByTestId("device-row").click();
  await expect(anna.getByTestId("device-sheet").getByTestId("remote")).toBeVisible();
  await expect(anna.getByTestId("device-switch-screen")).toHaveCount(0);
  await expectNoScroll(anna);
  await SHOT(anna, "fernbedienung");

  await openDevice(ben);
  await expect(ben.getByTestId("device-role")).toHaveText("Spiel-Handy");
  await ben.getByTestId("device-row").click();
  await expect(ben.getByTestId("device-sheet")).toBeVisible();
  await expect(ben.getByTestId("device-sheet").getByTestId("remote")).toHaveCount(0);
  await expect(ben.getByTestId("device-switch-screen")).toHaveCount(0);
});
