import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Ein Schritt auf diesem Handy: Sichtschutz weg, „gesund“ sagen, eine erlaubte Karte spielen oder nächste Runde. true, wenn etwas getan wurde. */
async function step(p: Page): Promise<boolean> {
  const cover = p.getByRole("button", { name: /Karten zeigen/ });
  if (await cover.isVisible()) { await cover.click(); return true; }
  const healthy = p.getByRole("button", { name: "Gesund", exact: true });
  if (await healthy.isVisible()) { await healthy.click(); return true; }
  const next = p.getByRole("button", { name: /^Runde \d+ geben$/ });
  if (await next.isVisible()) { await next.click(); return true; }
  const cards = p.getByTestId("hand").locator("button:not([disabled])");
  // Nach dem Zug kommt sofort der Sichtschutz – dann ist die Karte schon weg
  if (await cards.count()) { await cards.first().click({ timeout: 2000 }).catch(() => {}); return true; }
  return false;
}

test("Doppelkopf an einem Handy für alle: Sichtschutz, Vorbehalt, Ansage, Stiche, Abrechnung bis zum Ende – passt auf 320 px", async ({ page }) => {
  // vier Runden an einem Handy: jeder Zug mit Sichtschutz – dauert ein paar Minuten
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await captureSpeech(page);
  await startLocal(page, "doppelkopf", ["Anna", "Ben", "Cem", "Dora"], { settings: async (p) => { await p.getByRole("radio", { name: /jeder gibt einmal/ }).click(); } });
  // Dora gibt, Anna sagt zuerst
  await expect(page.getByTestId("handoff")).toContainText("Anna");
  await expectNoScroll(page);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(page.getByTestId("reserve")).toBeVisible();
  await expect(page.getByTestId("hand").locator("button")).toHaveCount(12);
  await expectNoScroll(page);
  await shot(page, "doppelkopf-vorbehalt-320");
  // Solo-Liste aufklappen und wieder zurück
  await page.getByTestId("solo-open").click();
  await expect(page.getByTestId("solo-list")).toContainText("Damensolo");
  await expectNoScroll(page);
  await page.getByRole("button", { name: "Zurück" }).click();
  await page.getByRole("button", { name: "Gesund", exact: true }).click();
  await expect(page.getByTestId("handoff")).toContainText("Ben");
  let shotCall = false, shotSummary = false, called = false;
  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 4000 && (i % 20 || !(await over.isVisible())); i++) {
    // einmal ansagen (wer gerade darf), mit Bild
    if (!called && (await page.getByTestId("call").isVisible())) {
      if (!shotCall) { await expectNoScroll(page); await shot(page, "doppelkopf-ansage-320"); shotCall = true; }
      await page.getByTestId("call").click();
      called = true;
      continue;
    }
    if (!shotSummary && (await page.getByTestId("round-summary").isVisible())) {
      await expectNoScroll(page); await shot(page, "doppelkopf-abrechnung-320"); shotSummary = true;
    }
    await step(page);
  }
  await expect(over).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "doppelkopf-ergebnis-320");
  expect(called).toBe(true);
  const said = await spoken(page);
  expect(said).toContain("Runde 1. Dora gibt. Anna sagt zuerst: gesund oder Vorbehalt?");
  expect(said).toMatch(/nimmt den Stich mit \d+ Augen/);
  expect(said).toMatch(/sagt (Re|Kontra)!/);
  expect(said).toMatch(/Re hat \d+ Augen, Kontra \d+ Augen/);
  expect(said).toMatch(/gewinnt? mit -?\d+ Punkt/);
});

/** Online-Testraum mit drei Bots öffnen und starten */
async function botRoom(page: Page, settings?: (p: Page) => Promise<void>) {
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("doppelkopf");
  await expect(page.getByTestId("dev-bots")).toHaveText("3");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  if (settings) await settings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

for (const [w, h] of [[360, 640], [390, 844]] as const) {
  test(`Doppelkopf online mit drei Bots (${w}×${h}): Vorbehalt, zwölf Karten, Ansage, eine Runde, Abrechnung – nur die eigene Hand`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    await botRoom(page);
    await expect(page.getByTestId("hand").getByRole("img")).toHaveCount(12, { timeout: 30_000 });
    // Bots sagen vor mir – bis ich dran bin
    await expect(page.getByTestId("reserve")).toBeVisible({ timeout: 30_000 });
    await expectNoScroll(page);
    await shot(page, `doppelkopf-vorbehalt-${w}`);
    // Ansage (bis vor der zweiten eigenen Karte) – je nach Blatt erst in einer späteren Runde möglich (z. B. Hochzeit der Bots)
    let shotHand = false, shotTrick = false, shotSummary = false, called = false;
    for (let i = 0; i < 1500; i++) {
      if (await page.getByTestId("round-summary").isVisible()) {
        if (!shotSummary) { await expect(page.getByTestId("lines")).not.toBeEmpty(); await expectNoScroll(page); await shot(page, `doppelkopf-abrechnung-${w}`); shotSummary = true; }
        if (called) break;
        await page.getByRole("button", { name: /^Runde \d+ geben$/ }).click();
        continue;
      }
      const healthy = page.getByRole("button", { name: "Gesund", exact: true });
      if (await healthy.isVisible()) { await healthy.click().catch(() => {}); continue; }
      const cards = page.getByTestId("hand").locator("button:not([disabled])");
      if (!called && (await page.getByTestId("call").isVisible())) {
        await expect(page.getByTestId("call")).toHaveText(/^(Re|Kontra) ansagen$/);
        await expectNoScroll(page);
        await shot(page, `doppelkopf-ansage-${w}`);
        await page.getByTestId("call").click();
        await expect(page.getByRole("group", { name: "Mitspieler" })).toContainText(/Re|Kontra/);
        called = true;
        continue;
      }
      if (await cards.count()) {
        if (!shotHand && (await cards.count()) === 12) { await expectNoScroll(page); await shot(page, `doppelkopf-hand-${w}`); shotHand = true; }
        else if (!shotTrick && (await page.getByTestId("trick").isVisible())) { await expectNoScroll(page); await shot(page, `doppelkopf-stich-${w}`); shotTrick = true; }
        await cards.first().click().catch(() => {});
      }
      await page.waitForTimeout(200);
    }
    expect(called).toBe(true);
    await expect(page.getByTestId("round-summary")).toBeVisible();
    await expect(page.getByTestId("lines")).toContainText("angesagt");
    await expectNoScroll(page);
    await shot(page, `doppelkopf-abrechnung-angesagt-${w}`);
    // Bots geben nicht von selbst weiter – der Mensch liest erst
    await page.waitForTimeout(8000);
    await expect(page.getByTestId("round-summary")).toBeVisible();
    const n = Number((await page.getByTestId("round").textContent())?.match(/Runde (\d+)/)?.[1]);
    await page.getByRole("button", { name: `Runde ${n + 1} geben` }).click();
    await expect(page.getByTestId("round")).toContainText(`Runde ${n + 1}/8`);
  });
}

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Doppelkopf am Großen Tisch: zwei Handys, zwei Bots füllen auf – Stich in der Mitte, keine Hände", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { doppelkopf: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const name of ["Anna", "Ben"]) {
      const p = await newPhone(browser);
      await p.goto(`/r/${code}#pin=${pin}`);
      await expect(p.getByLabel("PIN")).toHaveValue(pin);
      await p.getByLabel("Dein Name").fill(name);
      await p.getByRole("button", { name: "Beitreten" }).click();
      phones.push(p);
    }
    await expect(screen.getByTestId("table-seat")).toHaveCount(2);
    await phones[0].getByTestId("meet-play").click();
    await phones[0].getByTestId("pick-doppelkopf").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Doppelkopf");
    // Vorbehalte, dann ein paar Karten
    for (let k = 0; k < 12; k++) for (const p of phones) await step(p);
    await expect(screen.getByTestId("table-view")).toContainText("Stiche");
    await expect(phones[0].getByTestId("seat-note-bot-1")).toBeVisible();
    await expect(screen.getByTestId("hand")).toHaveCount(0);
    await shot(screen, "doppelkopf-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
