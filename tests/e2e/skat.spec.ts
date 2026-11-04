import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, expectNoScroll, newPhone, setConfig, shot, spoken, startLocal } from "./util";

// das Reizfeld kann gerade verschwinden (Bots sind schnell) – dann nicht ewig warten
const num = async (p: Page) => Number((await p.getByTestId("bid-current").textContent({ timeout: 1000 }).catch(() => ""))?.replace(/\D/g, "") || 0);

/**
 * Ein Schritt auf diesem Handy: Sichtschutz weg, reizen bis `upTo`, Skat aufnehmen, zwei Karten drücken, Grand ansagen,
 * eine erlaubte Karte spielen oder das nächste Spiel geben. Gibt zurück, was getan wurde (oder null).
 */
async function step(p: Page, upTo = 24): Promise<string | null> {
  const cover = p.getByRole("button", { name: /Karten zeigen/ });
  if (await cover.isVisible()) { await cover.click(); return "cover"; }
  const t = { timeout: 2000 };
  if (await p.getByTestId("bid").isVisible()) {
    const say = p.getByTestId("bid-say"), yes = p.getByRole("button", { name: "Ja", exact: true }), pass = p.getByRole("button", { name: "Passe", exact: true });
    const v = await num(p);
    if (await say.isVisible()) { await (v < upTo ? say : pass).click(t).catch(() => {}); return "bid"; }
    if (await yes.isVisible()) { await (v <= upTo ? yes : pass).click(t).catch(() => {}); return "bid"; }
    return null;
  }
  const take = p.getByRole("button", { name: "Skat aufnehmen" });
  if (await take.isVisible()) { await take.click(t).catch(() => {}); return "skat"; }
  if (await p.getByTestId("discard").isVisible()) {
    const cards = p.getByTestId("hand").locator("button");
    await cards.nth(0).click(t).catch(() => {});
    await cards.nth(1).click(t).catch(() => {});
    await p.getByTestId("discard-go").click(t).catch(() => {});
    return "discard";
  }
  if (await p.getByTestId("declare").isVisible()) {
    await p.getByTestId("kind-grand").click(t).catch(() => {});
    await p.getByTestId("declare-go").click(t).catch(() => {});
    return "declare";
  }
  const next = p.getByRole("button", { name: /^Spiel \d+ geben$/ });
  if (await next.isVisible()) { await next.click(t).catch(() => {}); return "next"; }
  const cards = p.getByTestId("hand").locator("button:not([disabled])");
  if (await cards.count()) { await cards.first().click(t).catch(() => {}); return "play"; }
  return null;
}

test("Skat an einem Handy für alle: Sichtschutz, Reizen, Skat, Drücken, Spielwahl, Stiche, Abrechnung bis zum Ende – passt auf 320 px", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await captureSpeech(page);
  await startLocal(page, "skat", ["Anna", "Ben", "Cem"], { settings: async (p) => { await p.getByRole("radio", { name: /3 Spiele/ }).click(); } });
  // Cem gibt: Ben (Mittelhand) sagt Anna (Vorhand)
  await expect(page.getByTestId("handoff")).toContainText("Ben");
  await expectNoScroll(page);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(page.getByTestId("bid")).toBeVisible();
  await expect(page.getByTestId("bid-head")).toContainText("Du sagst Anna");
  await expect(page.getByTestId("hand").locator("button")).toHaveCount(10);
  await expectNoScroll(page);
  await shot(page, "skat-reizen-320");
  const shots = new Set<string>();
  const over = page.getByRole("button", { name: "Nochmal spielen" });
  for (let i = 0; i < 3000 && (i % 20 || !(await over.isVisible())); i++) {
    for (const [id, name] of [["discard", "druecken"], ["declare", "spielwahl"], ["round-summary", "abrechnung"]] as const) {
      if (!shots.has(id) && (await page.getByTestId(id).isVisible())) {
        if (id === "discard") await expect(page.getByTestId("hand").locator("button")).toHaveCount(12);
        await expectNoScroll(page); await shot(page, `skat-${name}-320`); shots.add(id);
      }
    }
    if (!shots.has("trick") && (await page.getByTestId("trick").getByRole("img").count()) === 2) { await expectNoScroll(page); await shot(page, "skat-stich-320"); shots.add("trick"); }
    await step(page);
  }
  await expect(over).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "skat-ergebnis-320");
  expect([...shots].sort()).toEqual(["declare", "discard", "round-summary", "trick"]);
  const said = await spoken(page);
  expect(said).toContain("Spiel 1. Cem gibt. Ben sagt Anna.");
  expect(said).toMatch(/Ben: 18\./);
  expect(said).toMatch(/spielt Grand/);
  expect(said).toMatch(/nimmt den Stich mit \d+ Augen/);
  expect(said).toMatch(/mal 24 sind \d+/);
  expect(said).toMatch(/(gewinnt|verliert) Grand: (plus|minus) \d+ Punkte/);
  expect(said).toMatch(/Die Liste ist zu Ende\./);
});

/** Online-Testraum mit Bots öffnen und starten */
async function botRoom(page: Page, bots: number) {
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("skat");
  await expect(page.getByTestId("dev-bots")).toHaveText("3");
  for (let n = 3; n > bots; n--) await page.getByRole("button", { name: "Ein Bot weniger" }).click();
  await expect(page.getByTestId("dev-bots")).toHaveText(String(bots));
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

for (const [w, h, bots] of [[360, 640, 2], [390, 844, 3]] as const) {
  test(`Skat online mit ${bots} Bots (${w}×${h}): reizen, Skat drücken, Spiel ansagen, Abrechnung – nur die eigene Hand`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: w, height: h });
    await botRoom(page, bots);
    await expect(page.getByTestId("contract")).toBeVisible({ timeout: 30_000 });
    // zu viert sitzt der Geber aus – dann hat er keine Karten
    let shotBid = false, shotOut = false, declared = false, shotSummary = false;
    const sum = page.getByTestId("round-summary");
    // nach Zeit statt nach Zügen: die Bots ziehen mit Pausen, ein Mensch wird nicht in jedem Spiel Alleinspieler
    const until = Date.now() + 360_000;
    while (Date.now() < until) {
      if (await sum.isVisible()) {
        if (!shotSummary || declared) { await expectNoScroll(page); await shot(page, `skat-abrechnung-${w}`); shotSummary = true; }
        if (declared) break;
        await page.getByRole("button", { name: /^Spiel \d+ geben$/ }).click({ timeout: 3000 }).catch(() => {});
        continue;
      }
      if (!shotOut && (await page.getByTestId("sitting-out").isVisible())) { await expectNoScroll(page); await shot(page, `skat-aussetzen-${w}`); shotOut = true; }
      if (await page.getByTestId("bid-say").isVisible()) {
        await expect(page.getByTestId("hand").getByRole("img")).toHaveCount(10);
        if (!shotBid) { await expectNoScroll(page); await shot(page, `skat-reizen-${w}`); shotBid = true; }
      }
      if (await page.getByTestId("declare").isVisible()) {
        await expectNoScroll(page);
        await shot(page, `skat-spielwahl-${w}`);
        declared = true;
      }
      // hoch reizen, damit der Mensch auch einmal Alleinspieler wird
      const did = await step(page, 48);
      if (did === "declare") {
        await expect(page.getByTestId("contract")).toContainText("Grand", { timeout: 10_000 });
      }
      if (!did) await page.waitForTimeout(200);
      if (did === "play" && !(await page.getByTestId("trick").isVisible().catch(() => false))) await page.waitForTimeout(100);
    }
    expect(declared).toBe(true);
    await expect(sum).toBeVisible();
    await expect(page.getByTestId("lines")).toContainText("× 24");
    await expect(page.getByTestId("skat-shown").getByRole("img")).toHaveCount(2);
    if (bots === 3) expect(shotOut).toBe(true);
    // Bots geben nicht von selbst weiter – der Mensch liest erst
    await page.waitForTimeout(7000);
    await expect(sum).toBeVisible();
    const n = Number((await page.getByTestId("round").textContent())?.match(/Spiel (\d+)/)?.[1]);
    await page.getByRole("button", { name: `Spiel ${n + 1} geben` }).click();
    await expect(page.getByTestId("round")).toContainText(`Spiel ${n + 1}/12`);
  });
}

async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Skat am Großen Tisch: zwei Handys, ein Bot füllt auf – Reizwert, Spielansage, Stich in der Mitte, keine Hände, kein Skat", async ({ browser, request }) => {
  test.setTimeout(300_000);
  await setConfig(request, { ...ALL_ON, modes: { skat: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/, { timeout: 20_000 });
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const name of ["Anna", "Ben"]) {
      const p = await newPhone(browser);
      await p.goto(`/r/${code}#pin=${pin}`);
      await expect(p.getByLabel("PIN")).toHaveValue(pin, { timeout: 20_000 });
      await p.getByLabel("Dein Name").fill(name);
      await p.getByRole("button", { name: "Beitreten" }).click();
      phones.push(p);
    }
    await expect(screen.getByTestId("table-seat")).toHaveCount(2);
    await phones[0].getByTestId("meet-play").click();
    await phones[0].getByTestId("pick-skat").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-view")).toContainText("Skat");
    await expect(screen.getByTestId("table-view")).toContainText(/Reizen|Vorhand|Mittelhand/, { timeout: 20_000 });
    await expect(screen.getByTestId("table-seat")).toHaveCount(3);
    await shot(screen, "skat-fernseher-reizen");
    for (let k = 0; k < 60 && !(await screen.getByTestId("table-view").textContent())?.includes("nimmt den Stich"); k++) for (const p of phones) await step(p, 30);
    await expect(screen.getByTestId("table-view")).toContainText("Stich");
    await expect(screen.getByTestId("table-view")).toContainText("(Bot)");
    await expect(screen.getByTestId("hand")).toHaveCount(0);
    await expect(screen.getByTestId("table-trick")).toBeVisible();
    const news = await screen.getByTestId("table-news").boundingBox();
    for (const seat of await screen.getByTestId("table-seat").all()) {
      const b = (await seat.boundingBox())!;
      expect(b.y >= news!.y + news!.height || b.y + b.height <= news!.y || b.x >= news!.x + news!.width || b.x + b.width <= news!.x, "Platz unter der Meldung").toBe(true);
    }
    await shot(screen, "skat-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
