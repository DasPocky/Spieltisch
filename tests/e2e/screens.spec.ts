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
      await page.getByRole("button", { name: /^(Weiter|Niete)/ }).first().click();
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
