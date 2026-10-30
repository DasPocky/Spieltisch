import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/**
 * Ein Schritt wie ein vorsichtiger Spieler: würfeln; bei einer Entscheidung dem Tipp folgen (ankreuzen oder verzichten).
 * true, wenn etwas getan wurde.
 */
async function step(p: Page): Promise<boolean> {
  const roll = p.getByRole("button", { name: /Würfeln$/ });
  if (await roll.isVisible().catch(() => false)) { await roll.click({ timeout: 5000 }).catch(() => {}); return true; }
  const go = p.getByTestId("mark-go");
  if (!(await go.isVisible().catch(() => false))) return false;
  const tip = p.getByTestId("hint-chip");
  const text = (await tip.textContent({ timeout: 500 }).catch(() => "")) ?? "";
  if (/ankreuzen/.test(text)) {
    await tip.click({ timeout: 3000 }).catch(() => {});
    await go.click({ timeout: 3000 }).catch(() => {});
  } else {
    await p.getByTestId("mark-pass").click({ timeout: 3000 }).catch(() => {});
  }
  return true;
}

test("Ankreuzspiel an einem Handy für alle: Weiß reihum, Farbe, Fehlwurf, bis zum Ergebnis – passt auf 360×640", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 360, height: 640 });
  await captureSpeech(page);
  await startLocal(page, "ankreuzspiel", ["Anna", "Ben", "Cem"], {
    settings: async (p) => { await p.getByTestId("presets").getByRole("radio", { name: /Kurz/ }).click(); },
  });
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(page.getByTestId("row-0").getByRole("button")).toHaveCount(11);
  await expect(page.getByTestId("turn-info")).toContainText("Anna würfelt");
  await expectNoScroll(page);
  await shot(page, "ankreuzspiel-blatt-360");

  // Anna würfelt; Weiß geht reihum: Anna, Ben, Cem – jeder kreuzt das erste mögliche Feld an
  await page.getByRole("button", { name: /Würfeln$/ }).click();
  await expect(page.getByTestId("dice-tray").getByRole("button")).toHaveCount(6);
  for (const name of ["Anna", "Ben", "Cem"]) {
    if (!(await page.getByTestId("mark-go").isVisible())) break;
    await expect(page.getByTestId("ak-status")).toContainText(name);
    const opt = page.locator('[data-state="option"]').first();
    if (await opt.count()) {
      await opt.click();
      await expect(page.locator('[data-state="selected"]')).toHaveCount(1);
      if (name === "Anna") { await expectNoScroll(page); await shot(page, "ankreuzspiel-weiss-360"); }
      await page.getByTestId("mark-go").click();
    } else await page.getByTestId("mark-pass").click();
  }
  // Anna darf noch eine Farbe – sie verzichtet
  if (await page.getByTestId("turn-info").textContent().then((t) => /Weiß \+ Farbe/.test(t ?? ""))) {
    await expect(page.getByTestId("mark-pass")).toHaveText(/Keine Farbe|Fehlwurf/);
    await page.getByTestId("mark-pass").click();
  }
  await expect(page.getByTestId("turn-info")).toContainText("Ben würfelt");
  await expect(page.getByTestId("last-turn")).toBeVisible();

  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 1500 && (i % 10 || !(await over.isVisible())); i++) await step(page);
  await expect(over).toBeVisible();
  await expect(page.getByTestId("winner")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "ankreuzspiel-ergebnis-360");
  const said = await spoken(page);
  expect(said).toContain("Anna beginnt und würfelt.");
  expect(said).toMatch(/Anna würfelt\. Weiß \d und \d, zusammen \d+ für alle\./);
  expect(said).toContain("Angekreuzt:");
  expect(said).toMatch(/gewinnt mit -?\d+ Punkten\./);
});

test("Ankreuzspiel online mit Bots: Weiß gleichzeitig, eigener Zug mit Farbe", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("spieltisch:diceHQ", "1"));
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("ankreuzspiel");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("sheet")).toBeVisible();
  let ownColor = false, white = 0;
  for (let i = 0; i < 600 && !(ownColor && white >= 2); i++) {
    const info = (await page.getByTestId("turn-info").textContent().catch(() => "")) ?? "";
    if (await page.getByRole("button", { name: "Nochmal spielen" }).isVisible().catch(() => false)) break;
    if (await page.getByTestId("mark-go").isVisible().catch(() => false)) {
      const opt = page.locator('[data-state="option"]').first();
      if (/Farbe/.test(info) && !ownColor && (await opt.count())) {
        await opt.click();
        await expectNoScroll(page); await shot(page, "ankreuzspiel-farbe"); ownColor = true;
        await page.getByTestId("mark-go").click().catch(() => {});
        continue;
      }
      if (/Weiß \d+ für alle/.test(info)) {
        white++;
        if (white === 1) { await expectNoScroll(page); await shot(page, "ankreuzspiel-weiss"); }
      }
      await step(page);
      continue;
    }
    if (await step(page)) continue;
    await page.waitForTimeout(250);
  }
  expect(white).toBeGreaterThanOrEqual(1);
  // Blatt eines Bots ansehen
  await page.getByRole("button", { name: /^Bot/ }).first().click().catch(() => {});
  await expect(page.getByTestId("turn-info")).toBeVisible();
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Ankreuzspiel am Großen Tisch: weiße und farbige Würfel in der Mitte, Kreuze an den Plätzen", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { ankreuzspiel: { table: "on" } } });
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
    await phones[0].getByTestId("pick-ankreuzspiel").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Ankreuzspiel");
    await expect(screen.getByTestId("table-view")).toContainText("würfelt");
    await phones[0].getByRole("button", { name: /Würfeln$/ }).click();
    await expect(screen.getByTestId("table-dice").locator("svg")).toHaveCount(6);
    await expect(screen.getByTestId("table-view")).toContainText("für alle");
    // Ben kreuzt gleich an, die anderen überlegen noch
    const opt = phones[1].locator('[data-state="option"]').first();
    if (await opt.count()) { await opt.click(); await phones[1].getByTestId("mark-go").click(); }
    await expect(phones[1].getByTestId("ak-status")).toContainText("Warte auf");
    await shot(screen, "ankreuzspiel-fernseher");
    // die anderen entscheiden, dann ist Ben dran
    for (const p of [phones[0], phones[2]]) if (await p.getByTestId("mark-pass").isVisible()) await p.getByTestId("mark-pass").click();
    if (await phones[0].getByTestId("mark-pass").isVisible()) await phones[0].getByTestId("mark-pass").click();
    await expect(phones[1].getByRole("button", { name: /Würfeln$/ })).toBeVisible();
    await expect(screen.getByTestId("table-view")).toContainText("Ben würfelt");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
