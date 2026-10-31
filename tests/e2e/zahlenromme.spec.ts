import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Ein Schritt auf diesem Handy: Sichtschutz weg, nächste Runde, den Tipp legen („Fertig“) oder einen Stein ziehen. */
async function step(p: Page): Promise<boolean> {
  const cover = p.getByRole("button", { name: /Steine zeigen/ });
  if (await cover.isVisible()) { await cover.click(); return true; }
  const next = p.getByTestId("next-round");
  if (await next.isVisible()) { await next.click(); return true; }
  const draw = p.getByTestId("draw");
  if (!(await draw.isVisible()) || !(await draw.isEnabled())) return false;
  const tip = p.getByRole("button", { name: /Tipp: \d+ Steine?/ });
  if (await tip.isVisible()) {
    await tip.click();
    const fin = p.getByTestId("finish");
    await expect(fin).toBeEnabled({ timeout: 1000 }).catch(() => {});
    if (await fin.isEnabled()) { await fin.click(); return true; }
  }
  await draw.click();
  return true;
}

const groups = (p: Page) => p.getByTestId("table").getByTestId("group").count();

// 320 px zu dritt, 360 px zu zweit
for (const [w, h, names] of [[320, 568, ["Anna", "Ben", "Cem"]], [360, 640, ["Anna", "Ben"]]] as const) {
  test(`Zahlen-Rommé an einem Handy für alle: auslegen, umbauen, ungültig rot, bis zum Ende – passt auf ${w}×${h}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: w, height: h });
    await captureSpeech(page);
    await startLocal(page, "zahlenromme", [...names], { settings: async (p) => { await p.getByTestId("presets").getByRole("radio", { name: /Kurz/ }).click(); } });
    await expect(page.getByTestId("handoff")).toContainText("Anna");
    await expectNoScroll(page);
    await page.getByRole("button", { name: /Steine zeigen/ }).click();
    // 14 Steine auf der Bank, sortieren nach Farbe und Zahl
    const bank = page.getByTestId("bank");
    await expect(bank.locator("button")).toHaveCount(14);
    const byColor = await bank.locator("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-tile")));
    await page.getByTestId("sort").click();
    await expect(page.getByTestId("sort")).toContainText("nach Zahl");
    const byNum = await bank.locator("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-tile")));
    expect([...byNum].sort()).toEqual([...byColor].sort());
    await page.getByTestId("sort").click();
    // Zwei Steine in eine neue Kombination: ungültig, rot markiert, „Fertig“ gesperrt – „Zurück“ setzt zurück
    await bank.locator("button").nth(0).click();
    await bank.locator("button").nth(1).click();
    await page.getByTestId("new-group").click();
    await expect(page.locator('[data-testid="group"][data-bad]')).toHaveCount(1);
    await expect(page.getByTestId("finish")).toBeDisabled();
    await expect(page.getByTestId("status")).toContainText(/ungültig/);
    await expect(bank.locator("button")).toHaveCount(12);
    await expectNoScroll(page);
    await shot(page, `zahlenromme-ungueltig-${w}`);
    // ein Stein vom Tisch zurück auf die Bank
    await page.getByTestId("table").locator("button[data-tile]").first().click();
    await page.getByTestId("to-bank").click();
    await expect(bank.locator("button")).toHaveCount(13);
    await page.getByTestId("reset").click();
    await expect(bank.locator("button")).toHaveCount(14);
    await expect(page.getByTestId("group")).toHaveCount(0);

    let shotFirst = false, most = 0;
    const over = page.getByRole("button", { name: "Nochmal spielen" });
    for (let i = 0; i < 3000 && (i % 10 || !(await over.isVisible())); i++) {
      // erstes Auslegen: Tipp übernehmen, die Summe zeigt mindestens 30
      if (!shotFirst && (await page.getByTestId("first-sum").isVisible()) && (await page.getByRole("button", { name: /Tipp: \d+ Steine?/ }).isVisible())) {
        await page.getByRole("button", { name: /Tipp: \d+ Steine?/ }).click();
        const sum = Number((await page.getByTestId("first-sum").textContent())?.match(/(\d+)\/30/)?.[1]);
        expect(sum).toBeGreaterThanOrEqual(30);
        await expect(page.getByTestId("finish")).toBeEnabled();
        await expectNoScroll(page);
        await shot(page, `zahlenromme-erstes-${w}`);
        shotFirst = true;
        await page.getByTestId("finish").click();
        continue;
      }
      if (await page.getByTestId("draw").isVisible()) {
        const n = await groups(page);
        if (n > most && n >= 6) {
          most = n;
          await expectNoScroll(page);
          await shot(page, `zahlenromme-tisch-${w}`);
        }
      }
      await step(page);
    }
    await expect(over).toBeVisible();
    await expectNoScroll(page);
    await shot(page, `zahlenromme-ende-${w}`);
    const said = await spoken(page);
    expect(said).toContain("dreißig Punkte");
    expect(said).toMatch(/beginnt\./);
    expect(said).toMatch(/gewinnt Runde 1/);
  });
}

test("Zahlen-Rommé online mit drei Bots: nur die eigene Bank, Zugzeit, legen bis zum Rundenende", async ({ page }) => {
  test.setTimeout(400_000);
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("zahlenromme");
  await expect(page.getByTestId("dev-bots")).toHaveText("3");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("bank")).toBeVisible();
  await expect(page.getByTestId("bank").locator("button")).toHaveCount(14);
  // die anderen Bänke sieht man nur als Zahl
  await expect(page.locator('[data-testid^="count-"]')).toHaveCount(4);
  let shotTurn = false, shotTimer = false;
  const roundEnd = page.getByTestId("round-end");
  for (let i = 0; i < 1500 && !(await roundEnd.isVisible()); i++) {
    if (!shotTimer && (await page.getByTestId("turn-timer").isVisible())) shotTimer = true;
    if (!shotTurn && (await page.getByTestId("draw").isEnabled().catch(() => false))) {
      await expectNoScroll(page); await shot(page, "zahlenromme-zug"); shotTurn = true;
    }
    if (!(await step(page))) await page.waitForTimeout(300);
  }
  expect(shotTimer).toBe(true);
  await expect(roundEnd).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "zahlenromme-runde");
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Zahlen-Rommé am Großen Tisch: der Tisch groß in der Mitte, keine Bänke", async ({ browser, request }) => {
  test.setTimeout(240_000);
  await setConfig(request, { ...ALL_ON, modes: { zahlenromme: { table: "on" } } });
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
    await phones[0].getByTestId("pick-zahlenromme").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-tiles")).toBeVisible();
    await expect(screen.getByTestId("table-view")).toContainText("Steine");
    // reihum legen, bis etwas auf dem Tisch liegt
    for (let k = 0; k < 40 && !(await screen.getByTestId("table-group").count()); k++) for (const p of phones) await step(p);
    await expect(screen.getByTestId("table-group").first()).toBeVisible();
    for (let k = 0; k < 6; k++) for (const p of phones) await step(p);
    await expect(screen.getByTestId("bank")).toHaveCount(0);
    await shot(screen, "zahlenromme-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
