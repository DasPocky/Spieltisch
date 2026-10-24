import { expect, test, type Page } from "@playwright/test";
import { shot } from "./util";

/** Im automatisierten Browser ist die Begrüßung sonst aus – hier gezielt einschalten */
async function withIntro(page: Page, extra: Record<string, string> = {}) {
  await page.addInitScript((extra) => {
    localStorage.setItem("spieltisch:test-intro", "true");
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, extra);
}

test("Erster Start: Willkommen, Name und Avatar, Rundgang – danach begrüßt der Start mit Namen", async ({ page }) => {
  await withIntro(page);
  await page.goto("/");
  const intro = page.getByTestId("onboarding");
  await expect(intro.getByRole("heading", { name: "Willkommen bei Spieltisch" })).toBeVisible();
  await shot(page, "06-willkommen");
  await intro.getByRole("button", { name: "Los geht's" }).click();
  await expect(intro.getByRole("button", { name: "Weiter" })).toBeDisabled();
  await intro.getByLabel("Dein Name").fill("Mia");
  await intro.getByRole("radio", { name: "Emoji 🦊" }).click();
  await intro.getByRole("button", { name: "Weiter" }).click();
  await expect(intro.getByRole("heading", { name: "Schön, dass du da bist, Mia!" })).toBeVisible();
  await intro.getByRole("button", { name: "Kurz zeigen" }).click();
  await expect(intro.getByRole("heading", { name: "Raum veranstalten, Code teilen" })).toBeVisible();
  await intro.getByRole("button", { name: "Weiter" }).click();
  await intro.getByRole("button", { name: "Weiter" }).click();
  await intro.getByRole("button", { name: "Los geht's" }).click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByTestId("greeting")).toHaveText("Hallo, Mia!");
  expect(await page.evaluate(() => localStorage.getItem("spieltisch:avatar"))).toContain('"emoji":2');
  // Beim nächsten Öffnen kein Willkommen mehr – und kurz nach dem Verlassen auch keine Begrüßung
  await page.reload();
  await expect(page.getByTestId("greeting")).toBeVisible();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  await expect(page.getByTestId("welcome")).toHaveCount(0);
});

test("Erster Start: Überspringen geht jederzeit, ein Raum-Link führt direkt in den Raum", async ({ page }) => {
  await withIntro(page);
  await page.goto("/r/ABCDE");
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  await page.goto("/");
  await page.getByRole("button", { name: "Überspringen" }).click();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Raum veranstalten" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
});

test("Erster Start: Profil vom alten Handy per Code übernehmen", async ({ browser }) => {
  // Altes Handy: Profil mit Namen, Code zum Übertragen holen
  const old = await (await browser.newContext()).newPage();
  await old.goto("/");
  await old.evaluate(() => localStorage.setItem("spieltisch:name", "Oma"));
  const code = await old.evaluate(async () => {
    const { id, key } = JSON.parse(localStorage.getItem("spieltisch:profile")!);
    const headers = { "content-type": "application/json", "x-profile-key": key };
    await fetch(`/api/profile/${id}`, { method: "PUT", headers, body: JSON.stringify({ name: "Oma", avatar: { color: 3, emoji: 5 } }) });
    return (await (await fetch(`/api/profile/${id}/transfer`, { method: "POST", headers })).json()).code as string;
  });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE" })).newPage();
  await withIntro(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await page.getByRole("button", { name: "Ich habe schon ein Profil" }).click();
  await page.getByLabel("Übertragungs-Code").fill(code);
  await shot(page, "06b-profil-uebernehmen");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.getByRole("heading", { name: "Schön, dass du da bist, Oma!" })).toBeVisible();
  await page.getByRole("button", { name: "Gleich los" }).click();
  await expect(page.getByTestId("greeting")).toHaveText("Hallo, Oma!");
});

test("Wiederkommen: Begrüßung mit Ladebalken, endet von selbst oder per Tipp", async ({ page }) => {
  await withIntro(page, { "spieltisch:name": "Björn", "spieltisch:seen": "1" });
  await page.goto("/");
  const welcome = page.getByTestId("welcome");
  await expect(welcome).toContainText("Willkommen zurück,");
  await expect(welcome).toContainText("Björn!");
  // Der Balken füllt sich gleichmäßig mit der Zeit (CSS-Animation, kein Springen): nach 0,9 s etwa ein Drittel, nach 1,9 s etwa zwei Drittel
  const fill = () => page.getByTestId("welcome-progress").evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>(".strip-fill")].reduce((n, s) => n + new DOMMatrix(getComputedStyle(s).transform).a, 0) / 5);
  await page.waitForTimeout(900);
  const early = await fill();
  await page.waitForTimeout(1000);
  const later = await fill();
  expect(early).toBeGreaterThan(0.15);
  expect(early).toBeLessThan(0.55);
  expect(later).toBeGreaterThan(early + 0.2);
  expect(later).toBeLessThan(0.95);
  await page.screenshot({ path: "screenshots/06c-begruessung.png" });
  // Spätestens nach gut drei Sekunden ist sie weg
  await expect(welcome).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByTestId("greeting")).toHaveText("Hallo, Björn!");
  // Antippen überspringt
  await page.goto("/spiele");
  await page.evaluate(() => localStorage.setItem("spieltisch:seen", "1"));
  await page.goto("about:blank");
  await page.goto("/spiele");
  await expect(page.getByTestId("welcome")).toBeVisible();
  await page.getByTestId("welcome").click();
  await expect(page.getByTestId("welcome")).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByTestId("game-grid")).toBeVisible();
});
