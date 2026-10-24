import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Ein Schritt: weiter nach der Wertung, stehen lassen oder würfeln. true, wenn etwas getan wurde. */
async function step(p: Page): Promise<boolean> {
  const next = p.getByTestId("next");
  if (await next.isVisible()) { await next.click({ timeout: 3000 }).catch(() => {}); return true; }
  const stop = p.getByTestId("stop");
  if ((await stop.isVisible()) && (await stop.isEnabled())) { await stop.click({ timeout: 3000 }).catch(() => {}); return true; }
  const roll = p.getByRole("button", { name: /^Würfeln/ });
  if (await roll.isVisible()) { await roll.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

test("Schocken an einem Handy für alle: würfeln, herauslegen, Deckel, eine Hälfte bis zum Ergebnis – passt auf 320 px", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await captureSpeech(page);
  await startLocal(page, "schocken", ["Anna", "Ben", "Cem"], { settings: async (p) => { await p.getByRole("radio", { name: /Eine Hälfte/ }).click(); } });
  await expect(page.getByTestId("round")).toContainText("1. Hälfte");
  await expect(page.getByTestId("pot")).toContainText("13 in der Mitte");
  await expectNoScroll(page);
  // Anna beginnt: würfeln, einen Würfel herauslegen, nochmal – damit gelten zwei Würfe für alle
  await page.getByRole("button", { name: /^Würfeln/ }).click();
  const dice = page.getByTestId("dice-tray").getByRole("button");
  await expect(dice).toHaveCount(3);
  await expect(page.getByTestId("hand-label")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "schocken-wurf-320");
  await dice.nth(0).click();
  await expect(dice.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expectNoScroll(page);
  await shot(page, "schocken-herauslegen-320");
  await page.getByRole("button", { name: /^Würfeln/ }).click();
  await expect(page.getByRole("button", { name: /^Würfeln/ })).toContainText("(1)");
  await page.getByTestId("stop").click();
  await expect(page.getByTestId("round")).toBeVisible();
  await expect(page.getByText("Anna hat zwei Würfe vorgelegt")).toBeVisible();
  let shotEnd = false;
  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 2000 && (i % 10 || !(await over.isVisible())); i++) {
    if (!shotEnd && (await page.getByTestId("round-summary").isVisible())) {
      await expectNoScroll(page); await shot(page, "schocken-runde-320"); shotEnd = true;
    }
    await step(page);
  }
  await expect(over).toBeVisible();
  await expect(page.getByTestId("winner")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "schocken-ergebnis-320");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "schocken-ergebnis");
  const said = await spoken(page);
  expect(said).toContain("Erste Hälfte. 13 Deckel liegen in der Mitte. Anna beginnt.");
  expect(said).toContain("Höchstens zwei Würfe für alle.");
  expect(said).toMatch(/bekommt (einen|\d+) Deckel/);
  expect(said).toContain("hat die Partie verloren.");
});

test("Schocken online mit Bots: eigener Zug, Bots würfeln, Wertung mit Deckeln", async ({ page }) => {
  test.setTimeout(240_000);
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("schocken");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("round")).toContainText("1. Hälfte");
  let shotRoll = false, shotHold = false, rounds = 0;
  for (let i = 0; i < 800 && rounds < 1; i++) {
    const roll = page.getByRole("button", { name: /^Würfeln/ });
    if (await page.getByTestId("round-summary").isVisible()) {
      if (!rounds) { await expectNoScroll(page); await shot(page, "schocken-runde"); }
      rounds++;
      await expect(page.getByTestId("round-summary")).toBeHidden({ timeout: 10_000 }).catch(async () => { await page.getByTestId("next").click().catch(() => {}); });
      continue;
    }
    if (await roll.isVisible().catch(() => false)) {
      await roll.click({ timeout: 5000 }).catch(() => {});
      const dice = page.getByTestId("dice-tray").getByRole("button");
      if (!shotRoll && (await page.getByTestId("hand-label").isVisible())) { await expectNoScroll(page); await shot(page, "schocken-wurf"); shotRoll = true; }
      if (!shotHold && (await dice.nth(0).isEnabled().catch(() => false))) {
        await dice.nth(0).click().catch(() => {});
        await expectNoScroll(page); await shot(page, "schocken-herauslegen"); shotHold = true;
      }
      await page.getByTestId("stop").click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(250);
  }
  expect(rounds).toBeGreaterThanOrEqual(1);
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Schocken am Großen Tisch: Würfel in der Mitte, Deckel an den Plätzen", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { schocken: { table: "on" } } });
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
    await phones[0].getByTestId("pick-schocken").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Schocken");
    await expect(screen.getByTestId("table-view")).toContainText("Mitte 13 Deckel");
    // Jeder würfelt einmal und lässt stehen – dann liegt die Wertung auf dem Tisch
    for (let k = 0; k < 12 && !(await phones[0].getByTestId("round-summary").isVisible()); k++) for (const p of phones) await step(p);
    await expect(screen.getByTestId("table-view")).toContainText("bekommt");
    // die Wertung steht nur einmal (in der Mitte), nicht noch oben im Verlauf
    await expect(screen.getByTestId("table-news")).toHaveCount(0);
    await shot(screen, "schocken-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
