import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Ein Schritt an einem Handy: weiter, Sichtschutz, zweifeln (oder ansagen). true, wenn etwas getan wurde. */
async function step(p: Page, doubt = true): Promise<boolean> {
  const quick = { timeout: 3000 };
  const next = p.getByTestId("next");
  if (await next.isVisible()) { await next.click(quick).catch(() => {}); return true; }
  const handoff = p.getByTestId("handoff");
  if (await handoff.isVisible()) { await handoff.getByRole("button").click(quick).catch(() => {}); return true; }
  const d = p.getByTestId("doubt");
  if (doubt && (await d.isVisible())) { await d.click(quick).catch(() => {}); return true; }
  const bid = p.getByTestId("bid");
  if ((await bid.isVisible()) && (await bid.isEnabled())) { await bid.click(quick).catch(() => {}); return true; }
  return false;
}

test("Bluff an einem Handy für alle: Sichtschutz, Becher anheben, ansagen, Bluff!, bis zum Ergebnis – passt auf 320 px", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await captureSpeech(page);
  await startLocal(page, "bluff", ["Anna", "Ben", "Cem"], { settings: async (p) => { await p.getByRole("radiogroup", { name: "Regeln" }).getByRole("radio", { name: /Kurz/ }).click(); } });
  await expect(page.getByTestId("handoff")).toContainText("Anna");
  await expectNoScroll(page);
  await page.getByRole("button", { name: "Ich bin Anna" }).click();
  await expect(page.getByTestId("my-dice")).toHaveCount(0);
  await page.getByRole("button", { name: /Becher anheben/ }).click();
  await expect(page.getByTestId("my-dice").getByRole("img")).toHaveCount(3);
  await page.getByRole("radio", { name: "Fünfen" }).click();
  await page.getByRole("button", { name: "Anzahl erhöhen" }).click();
  await expect(page.getByTestId("bid")).toHaveText("2 × Fünfen");
  await expectNoScroll(page);
  await shot(page, "bluff-becher-320");
  await page.getByTestId("bid").click();
  // Ben: erst Sichtschutz, dann erhöhen oder zweifeln
  await expect(page.getByTestId("handoff")).toContainText("Ben");
  await expect(page.getByTestId("announced")).toHaveText("2 × Fünfen");
  await page.getByRole("button", { name: "Ich bin Ben" }).click();
  await expect(page.getByRole("radio", { name: "Vieren" })).toBeEnabled();
  await page.getByTestId("doubt").click();
  await expect(page.getByTestId("reveal")).toContainText(/Stimmt!|Gelogen!/);
  await expect(page.getByTestId("all-cups")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "bluff-aufdecken-320");
  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 600 && (i % 5 || !(await over.isVisible())); i++) await step(page, i % 3 !== 0);
  await expect(page.getByTestId("winner")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "bluff-ergebnis-320");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "bluff-ergebnis");
  const said = await spoken(page);
  expect(said).toContain("Anna sagt zuerst an.");
  expect(said).toContain("Anna: mindestens zwei Fünfen.");
  expect(said).toContain("Ben ruft: Bluff!");
  expect(said).toMatch(/Alle decken auf\. Es liegen/);
  expect(said).toContain("gewinnt!");
});

test("Bluff online mit Bots: eigener Becher, ansagen, Bots zweifeln oder erhöhen", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("bluff");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("announcement")).toBeVisible();
  let shotBid = false, reveals = 0;
  for (let i = 0; i < 600 && reveals < 1; i++) {
    if (await page.getByTestId("reveal").isVisible()) {
      // Bots können schon vor dem eigenen Zug aufdecken – dann auf die nächste Runde warten
      if (!shotBid) { await page.waitForTimeout(500); continue; }
      reveals++;
      await expect(page.getByTestId("all-cups")).toBeVisible();
      await expectNoScroll(page);
      await shot(page, "bluff-aufdecken");
      break;
    }
    const bid = page.getByTestId("bid");
    if (await bid.isVisible().catch(() => false)) {
      if (!shotBid) {
        await page.getByRole("button", { name: /Becher anheben/ }).click();
        await expect(page.getByTestId("my-dice")).toBeVisible();
        await expectNoScroll(page);
        await shot(page, "bluff-becher");
        shotBid = true;
      }
      if (await page.getByTestId("doubt").isVisible() && i > 20) await page.getByTestId("doubt").click({ timeout: 3000 }).catch(() => {});
      else await bid.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(250);
  }
  expect(shotBid).toBe(true);
  expect(reveals).toBe(1);
});

async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Bluff am Großen Tisch: Becher verdeckt, Ansage groß, erst beim Aufdecken alle Würfel", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { bluff: { table: "on" } } });
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
    await phones[0].getByTestId("pick-bluff").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Bluff");
    await expect(screen.getByTestId("table-cup")).toBeVisible();
    // vor dem Aufdecken: an jedem Platz nur verdeckte Würfel
    const boards = screen.getByTestId("seat-board");
    await expect(boards).toHaveCount(3);
    expect((await boards.allInnerTexts()).join("").replace(/[?\s]/g, "")).toBe("");
    // Wer dran ist, sagt an; der Nächste ruft Bluff!
    let bidder = -1;
    for (let k = 0; k < 20 && bidder < 0; k++) {
      for (let i = 0; i < phones.length; i++) if (await phones[i].getByTestId("bid").isVisible()) { bidder = i; break; }
      if (bidder < 0) await screen.waitForTimeout(300);
    }
    expect(bidder).toBeGreaterThanOrEqual(0);
    await phones[bidder].getByTestId("bid").click();
    await expect(screen.getByTestId("table-view")).toContainText("mindestens");
    expect((await boards.allInnerTexts()).join("").replace(/[?\s]/g, "")).toBe("");
    await shot(screen, "bluff-fernseher");
    const doubter = phones[(bidder + 1) % phones.length];
    await doubter.getByTestId("doubt").click();
    await expect(screen.getByTestId("table-view")).toContainText("Bluff!");
    await expect.poll(async () => (await boards.allInnerTexts()).join("").replace(/[?\s]/g, "").length).toBe(15);
    await shot(screen, "bluff-fernseher-aufgedeckt");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
