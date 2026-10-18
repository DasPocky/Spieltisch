import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, newPhone, shot } from "./util";

/** Server meldet eine neuere Version (wie nach einem Deploy) – nur für diese Seite */
async function newerServer(page: Page) {
  await page.route("**/api/version", (r) => r.fulfill({ json: { build: { sha: "f".repeat(40), branch: "main", time: "2999-01-01T00:00:00.000Z" }, mode: "now", pending: null } }));
}
/** Merker im Fenster – nach einem Neuladen ist er weg */
const mark = (page: Page) => page.evaluate(() => { (window as unknown as { __mark?: boolean }).__mark = true; });
const marked = (page: Page) => page.evaluate(() => !!(window as unknown as { __mark?: boolean }).__mark);
/** App fragt nach (wie beim Zurückkommen in den Tab) */
const poke = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test("Update: alte App lädt auf der Startseite gleich neu und sagt kurz Bescheid – kein Neuladen im Kreis", async ({ browser }) => {
  const page = await newPhone(browser);
  // Beim ersten Laden ist das Gerät „alt“
  await page.addInitScript(() => {
    if (sessionStorage.getItem("t-old")) return;
    sessionStorage.setItem("t-old", "1");
    (window as unknown as { __TEST_BUILD__: object }).__TEST_BUILD__ = { sha: "0000000", branch: "main", time: "2000-01-01T00:00:00.000Z" };
  });
  await page.goto("/");
  await expect(page.getByText("Neue Version geladen")).toBeVisible({ timeout: 10_000 });
  // Hinweis bleibt unter Statusleiste/Notch
  expect(await page.locator("[data-sonner-toaster]").getAttribute("style")).toContain("safe-area-inset-top");
  await shot(page, "90-update-geladen");
  await mark(page);
  await page.waitForTimeout(2500);
  expect(await marked(page)).toBe(true);
});

test("Update im Spiel: wer dran ist, wird nicht unterbrochen – die anderen laden neu und sind sofort wieder im Raum", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "maumau", "Anna", "3131");
  await joinRoom(guest, code, "Ben", "3131");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByTestId("hand")).toBeVisible();
  await expect(guest.getByTestId("hand")).toBeVisible();

  // Anna ist dran: kein Neuladen mitten im Zug
  await newerServer(host);
  await mark(host);
  await poke(host);
  await host.waitForTimeout(4000);
  expect(await marked(host)).toBe(true);

  // Ben ist nicht dran: lädt neu, landet wieder in derselben Partie als Ben
  await newerServer(guest);
  await mark(guest);
  await poke(guest);
  let loads = 0;
  guest.on("framenavigated", (f) => { if (f === guest.mainFrame()) loads++; });
  await expect.poll(() => marked(guest).catch(() => false), { timeout: 10_000 }).toBe(false);
  await expect(guest.getByTestId("hand")).toBeVisible();
  // Der Server meldet weiter „neuer“ (z. B. Zwischenspeicher): trotzdem nur einmal neu laden
  await guest.waitForTimeout(3000);
  expect(loads).toBe(1);
  await expect(guest).toHaveURL(new RegExp(`/r/${code}$`));
  await shot(guest, "92-update-im-spiel");
});

test("Was ist neu: einmal pro Gerät, danach im Profil", async ({ browser }) => {
  const page = await newPhone(browser);
  await page.addInitScript(() => {
    localStorage.setItem("spieltisch:test-news", "true");
    localStorage.setItem("spieltisch:onboarded", "true");
    localStorage.setItem("spieltisch:name", "Ida");
    if (!sessionStorage.getItem("t-news")) { sessionStorage.setItem("t-news", "1"); localStorage.setItem("spieltisch:newsSeen", "2026-10-schamlos"); }
  });
  await page.goto("/");
  const sheet = page.getByTestId("whats-new");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("news-entry")).toHaveCount(1);
  await shot(page, "91-was-ist-neu");
  await sheet.getByRole("button", { name: "Alles klar" }).click();
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("whats-new")).toHaveCount(0);
  await page.goto("/profil");
  await page.getByTestId("news-link").click();
  await expect(page.getByTestId("news-entry").first()).toBeVisible();
});
