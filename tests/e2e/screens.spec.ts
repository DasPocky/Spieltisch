import { expect, test } from "@playwright/test";
import { expectInView, expectNoScroll, shot, startLocalTutto } from "./util";

/** Kleine und große Handys, Tablet und Browserfenster */
const SIZES = [
  { name: "se", width: 320, height: 568 },
  { name: "android", width: 360, height: 640 },
  { name: "iphone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 720 },
];

for (const size of SIZES) {
  test(`Tutto passt ohne Scrollen: ${size.name} ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await expectNoScroll(page);
    await startLocalTutto(page, ["Anna", "Ben", "Cem", "Dora", "Emil"]);
    const plus = page.getByRole("button", { name: "+100", exact: true });
    for (let i = 0; i < 40 && !(await plus.isVisible()); i++) {
      await page.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
      await page.waitForTimeout(150);
    }
    await plus.click();
    await page.waitForTimeout(500);
    for (const mode of ["simple", "full"] as const) {
      if (mode === "full") {
        await page.getByRole("button", { name: "Menü" }).click();
        await page.getByRole("radio", { name: /Voll/ }).click();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      await expectNoScroll(page);
      await expectInView(page, page.getByRole("button", { name: /eintragen/ }));
      await expectInView(page, page.getByRole("button", { name: "+1.000", exact: true }));
      const card = await page.getByRole("button", { name: /Tippen für|Karte ziehen/ }).boundingBox();
      expect(card!.height, "Karte zu klein").toBeGreaterThan(110);
      await shot(page, `95-screen-${size.name}-${mode}`);
    }
  });
}

test("Kartenspiel-Auswahl mit Bild (Mau-Mau, Fischen)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const game of ["maumau", "fischen"]) {
    await page.goto(`/spiel/${game}/lokal`);
    const group = page.getByRole("radiogroup", { name: "Kartenspiel" });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await group.getByRole("radio", { name: /Deutsch/ }).click();
    await expect(page.getByTestId("deck-info")).toContainText("Eichel");
    await expect(page.getByTestId("deck-info")).toContainText("8 Vierergruppen");
    await group.getByRole("radio", { name: /Rommé/ }).click();
    await expect(page.getByTestId("deck-info")).toContainText("13 Vierergruppen");
    await group.scrollIntoViewIfNeeded();
    await expectNoScroll(page).catch(() => {}); // Lobby darf senkrecht scrollen – nur nicht seitlich
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w).toBeLessThanOrEqual(360);
    await shot(page, `96-deck-picker-${game}`);
  }
});

test("Als App installierbar: Manifest, Icons, Hinweis fürs iPhone", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByTestId("install-hint")).toContainText("Zum Home-Bildschirm");
  await expectNoScroll(page);
  await shot(page, "97-install-hint-iphone");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  expect((await page.request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
  expect((await page.request.get("/sw.js")).ok()).toBe(true);
  await page.getByRole("button", { name: "Hinweis ausblenden" }).click();
  await expect(page.getByTestId("install-hint")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Spieltisch" })).toBeVisible();
  await expect(page.getByTestId("install-hint")).toHaveCount(0);
  await ctx.close();
});

/** Knöpfe, die nicht in einer eigenen Scroll-Liste stecken, müssen komplett im Bild sein */
async function clippedButtons(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p);
        if ((/(auto|scroll)/.test(o.overflowY) && p.scrollHeight > p.clientHeight) || (/(auto|scroll)/.test(o.overflowX) && p.scrollWidth > p.clientWidth)) return true;
      }
      return false;
    };
    return [...document.querySelectorAll("button")]
      .filter((b) => b.checkVisibility() && !b.closest("[role=dialog]") && !inScroller(b))
      .map((b) => ({ text: (b.textContent ?? "").trim().slice(0, 30), r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1))
      .map(({ text }) => text);
  });
}

const GAMES: [string, number][] = [["skyjo", 4], ["codenames", 4], ["tutto", 3], ["kniffel", 3], ["flip7", 4], ["werwolf", 6], ["einenacht", 4], ["maumau", 4], ["uno", 3], ["skipbo", 3], ["fischen", 3]];
for (const size of [{ width: 320, height: 568 }, { width: 1280, height: 720 }]) {
  for (const [game, n] of GAMES) {
    test(`${game} ohne Scrollen und Abschneiden: ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await page.goto(`/spiel/${game}/lokal`);
      for (const name of ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"].slice(0, n)) {
        await page.getByLabel("Name des Spielers").fill(name);
        await page.getByRole("button", { name: "Hinzufügen" }).click();
      }
      await page.getByRole("button", { name: "Spiel starten" }).click();
      const show = page.getByRole("button", { name: /Karten zeigen/ });
      if (await show.isVisible().catch(() => false)) await show.click();
      await page.waitForTimeout(700);
      await shot(page, `98-${game}-${size.width}`);
      await expectNoScroll(page);
      expect(await clippedButtons(page)).toEqual([]);
    });
  }
}
