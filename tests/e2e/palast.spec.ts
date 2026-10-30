import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Ein Schritt auf diesem Handy: Sichtschutz weg, fertig tauschen, niedrigste passende Karten legen, aufnehmen oder blind aufdecken. */
async function step(p: Page): Promise<boolean> {
  const cover = p.getByRole("button", { name: /Karten zeigen/ });
  if (await cover.isVisible()) { await cover.click(); return true; }
  const ready = p.getByTestId("swap-ready");
  if (await ready.isVisible()) {
    if (await ready.isEnabled()) { await ready.click(); return true; }
    return false;
  }
  const blind = p.getByTestId("blind-go");
  if (await blind.isVisible()) {
    if (await blind.isEnabled()) { await blind.click(); return true; }
    return false;
  }
  const take = p.getByTestId("take");
  if (!(await take.isVisible())) return false;
  if (await take.isEnabled()) { await take.click(); return true; }
  const go = p.getByTestId("play-go");
  const card = p.locator('[data-testid="hand"] button:not([disabled]), [data-testid="my-table"] [data-testid="up-card"]:not([disabled])').first();
  if (await card.count()) {
    if (!(await go.isEnabled())) {
      // links antippen – im Fächer liegt die nächste Karte rechts darüber
      await card.click({ timeout: 2000, position: { x: 6, y: 24 } }).catch(() => {});
      await expect(go).toBeEnabled({ timeout: 1000 }).catch(() => {});
    }
    if (await go.isEnabled()) { await go.click({ timeout: 2000 }).catch(() => {}); return true; }
  }
  return false;
}

/** Wie viele verschiedene Werte hat die Hand gerade? */
const groupsShown = (p: Page) => p.getByTestId("hand").locator("button").count();

// 320 px zu dritt, 360 px zu zweit (kürzer)
for (const [w, h, names] of [[320, 568, ["Anna", "Ben", "Cem"]], [360, 640, ["Anna", "Ben"]]] as const) {
  test(`Palast an einem Handy für alle: tauschen, legen, aufnehmen, Tischkarten bis zum Ende – passt auf ${w}×${h}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: w, height: h });
    await captureSpeech(page);
    await startLocal(page, "palast", [...names]);
    await expect(page.getByTestId("handoff")).toContainText("Anna");
    await expectNoScroll(page);
    await page.getByRole("button", { name: /Karten zeigen/ }).click();
    // Tauschen: eine Handkarte und eine offene antippen
    await expect(page.getByTestId("swap")).toBeVisible();
    const before = await page.getByTestId("swap-hand-0").getAttribute("data-card");
    await page.getByTestId("swap-hand-0").click();
    await page.getByTestId("swap-up-0").getByTestId("up-card").click();
    await expect(page.locator(`[data-testid^="swap-up-"] [data-card="${before}"]`)).toHaveCount(1);
    await expectNoScroll(page);
    await shot(page, `palast-tauschen-${w}`);
    await page.getByTestId("swap-ready").click();
    await expect(page.getByTestId("handoff")).toContainText("Ben");
    let most = 0, shotTable = false, shotBlind = false;
    const over = page.getByRole("button", { name: "Nochmal spielen" });
    for (let i = 0; i < 3000 && (i % 10 || !(await over.isVisible())); i++) {
      if (await page.getByTestId("hand").isVisible()) {
        const n = await groupsShown(page);
        if (n > most && n >= 5 && (await page.getByTestId("play-go").isVisible())) {
          most = n;
          await expectNoScroll(page);
          await shot(page, `palast-hand-${w}`);
        }
      }
      if (!shotTable && (await page.getByTestId("slot-0").isVisible()) && (await page.getByTestId("up-card").count())) {
        await expectNoScroll(page); await shot(page, `palast-tischkarten-${w}`); shotTable = true;
      }
      if (!shotBlind && (await page.getByTestId("blind-go").isVisible()) && (await page.getByTestId("blind-go").isEnabled())) {
        await expectNoScroll(page); await shot(page, `palast-blind-${w}`); shotBlind = true;
      }
      await step(page);
    }
    await expect(over).toBeVisible();
    await expectNoScroll(page);
    await expect(page.getByText("Palastwache").first()).toBeVisible();
    await shot(page, `palast-ende-${w}`);
    const said = await spoken(page);
    expect(said).toContain("Tauscht jetzt");
    expect(said).toMatch(/beginnt\./);
    expect(said).toMatch(/hält die Palastwache\./);
  });
}

test("Palast online mit drei Bots: nur die eigene Hand, tauschen, legen bis zum Ende", async ({ page }) => {
  test.setTimeout(400_000);
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("palast");
  await expect(page.getByTestId("dev-bots")).toHaveText("3");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  // Tauschen: nur die eigenen drei Handkarten, von den anderen nur offene Karten und Zahlen
  await expect(page.getByTestId("swap")).toBeVisible();
  await expect(page.locator('[data-testid^="swap-hand-"]')).toHaveCount(3);
  await page.getByTestId("swap-suggest").click();
  await expectNoScroll(page);
  await shot(page, "palast-tauschen");
  await page.getByTestId("swap-ready").click();
  await expect(page.getByTestId("need")).not.toHaveText("Tauschen", { timeout: 30_000 });
  let shotHand = false;
  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 1500 && !(await over.isVisible()); i++) {
    if (!shotHand && (await page.getByTestId("play-go").isVisible()) && (await page.getByTestId("play-go").isEnabled() || await page.getByTestId("hand").locator("button:not([disabled])").count())) {
      await expectNoScroll(page); await shot(page, "palast-zug"); shotHand = true;
    }
    if (!(await step(page))) await page.waitForTimeout(300);
  }
  await expect(over).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "palast-ende");
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Palast am Großen Tisch: Stapel und Ablage in der Mitte, Tischkarten am Platz, keine Handkarten", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { palast: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const name of ["Anna", "Ben", "Cem"]) {
      const p = await newPhone(browser);
      await p.goto(`/r/${code}#pin=${pin}`);
      await expect(p.getByLabel("PIN")).toHaveValue(pin);
      await p.getByLabel("Dein Name").fill(name);
      await p.getByRole("button", { name: "Beitreten" }).click();
      phones.push(p);
    }
    await expect(screen.getByTestId("table-seat")).toHaveCount(3);
    await phones[0].getByTestId("meet-play").click();
    await phones[0].getByTestId("pick-palast").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Palast");
    await expect(screen.getByTestId("table-view")).toContainText("tauscht");
    for (const p of phones) await step(p);
    for (let k = 0; k < 6; k++) for (const p of phones) await step(p);
    await expect(screen.getByTestId("table-view")).toContainText("Karten übrig");
    await expect(screen.getByTestId("seat-board").first()).toBeVisible();
    await expect(screen.getByTestId("hand")).toHaveCount(0);
    await shot(screen, "palast-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
