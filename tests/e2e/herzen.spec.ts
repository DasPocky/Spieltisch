import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Ein Schritt auf diesem Handy: Sichtschutz weg, drei Karten weitergeben, eine erlaubte Karte spielen oder nächste Runde. true, wenn etwas getan wurde. */
async function step(p: Page): Promise<boolean> {
  const cover = p.getByRole("button", { name: /Karten zeigen/ });
  if (await cover.isVisible()) { await cover.click(); return true; }
  const go = p.getByTestId("pass-go");
  if (await go.isVisible()) {
    if (await go.isDisabled()) {
      const cards = p.getByTestId("hand").locator("button");
      for (let i = 0; i < 3; i++) await cards.nth(i).click();
    }
    await go.click();
    return true;
  }
  const next = p.getByRole("button", { name: /^Runde \d+ geben$/ });
  if (await next.isVisible()) { await next.click(); return true; }
  const cards = p.getByTestId("hand").locator("button:not([disabled])");
  // Nach dem Zug kommt sofort der Sichtschutz – dann ist die Karte schon weg
  if (await cards.count()) { await cards.first().click({ timeout: 2000 }).catch(() => {}); return true; }
  return false;
}

test("Herzen an einem Handy für alle: Sichtschutz, weitergeben, Stiche, Wertung bis zum Ende – passt auf 320 px", async ({ page }) => {
  // bis 50 Punkte an einem Handy: jeder Zug mit Sichtschutz – dauert ein paar Minuten
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await captureSpeech(page);
  await startLocal(page, "herzen", ["Anna", "Ben", "Cem", "Dora"], { settings: async (p) => { await p.getByRole("radio", { name: /kürzere Partie/ }).click(); } });
  await expect(page.getByTestId("handoff")).toContainText("Anna");
  await expectNoScroll(page);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  // Weitergeben: drei wählen, dann an Ben
  await expect(page.getByTestId("pass-go")).toHaveText("Noch 3 Karten wählen");
  const hand = page.getByTestId("hand").locator("button");
  await expect(hand).toHaveCount(13);
  for (let i = 0; i < 3; i++) await hand.nth(i).click();
  await expect(page.getByTestId("pass-go")).toHaveText("An Ben geben");
  await expectNoScroll(page);
  await shot(page, "herzen-weitergeben-320");
  await page.getByTestId("pass-go").click();
  // Danach ist Ben dran – Annas Karten sind verdeckt
  await expect(page.getByTestId("handoff")).toContainText("Ben");
  let shotTrick = false, shotSummary = false;
  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 4000 && (i % 20 || !(await over.isVisible())); i++) {
    if (!shotTrick && (await page.getByTestId("trick").isVisible()) && (await page.getByTestId("hand").locator("button:not([disabled])").count())) {
      await expectNoScroll(page); await shot(page, "herzen-stich-320"); shotTrick = true;
    }
    if (!shotSummary && (await page.getByTestId("round-summary").isVisible())) {
      await expectNoScroll(page); await shot(page, "herzen-wertung-320"); shotSummary = true;
    }
    await step(page);
  }
  await expect(page.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "herzen-ergebnis-320");
  const said = await spoken(page);
  expect(said).toContain("Jeder gibt drei Karten nach links weiter.");
  expect(said).toContain("hat die Kreuz-Zwei und spielt aus.");
  expect(said).toContain("Herz ist gebrochen!");
  expect(said).toMatch(/gewinnt? mit \d+ Punkten/);
});

test("Herzen online mit drei Bots: weitergeben, eine Runde spielen, Wertung – nur die eigene Hand", async ({ page }) => {
  test.setTimeout(240_000);
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("herzen");
  await expect(page.getByTestId("dev-bots")).toHaveText("3");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  // Nur die eigene Hand: 13 Karten, von den anderen nur Zahlen
  await expect(page.getByTestId("hand").getByRole("img")).toHaveCount(13);
  await expect(page.getByTestId("pass-info")).toBeVisible();
  const hand = page.getByTestId("hand").locator("button");
  for (let i = 0; i < 3; i++) await hand.nth(10 + i).click();
  await expectNoScroll(page);
  await shot(page, "herzen-weitergeben");
  await page.getByTestId("pass-go").click();
  // Bots geben auch weiter – dann spielt die Kreuz-Zwei aus
  await expect(page.getByTestId("round")).toContainText("Stich", { timeout: 30_000 });
  await expect(page.getByTestId("hand").getByRole("img")).toHaveCount(13);
  let shotHand = false, shotTrick = false;
  for (let i = 0; i < 600 && !(await page.getByTestId("round-summary").isVisible()); i++) {
    const cards = page.getByTestId("hand").locator("button:not([disabled])");
    if (await cards.count()) {
      if (!shotHand) { await expectNoScroll(page); await shot(page, "herzen-hand"); shotHand = true; }
      else if (!shotTrick && (await page.getByTestId("trick").isVisible())) { await expectNoScroll(page); await shot(page, "herzen-stich"); shotTrick = true; }
      await cards.first().click();
    }
    await page.waitForTimeout(250);
  }
  await expect(page.getByTestId("round-summary")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "herzen-wertung");
  await page.getByRole("button", { name: "Runde 2 geben" }).click();
  await expect(page.getByTestId("round")).toContainText("Runde 2 · nach rechts");
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Herzen am Großen Tisch: Stich in der Mitte, keine fremden Karten", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { herzen: { table: "on" } } });
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
    await phones[0].getByTestId("pick-herzen").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Herzen");
    await expect(screen.getByTestId("table-view")).toContainText("gibt nach links");
    for (const p of phones) await step(p);
    // Zwei Karten in den Stich
    for (let k = 0; k < 8; k++) for (const p of phones) await step(p);
    await expect(screen.getByTestId("table-view")).toContainText("Pkt. diese Runde");
    await expect(screen.getByTestId("hand")).toHaveCount(0);
    await shot(screen, "herzen-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
