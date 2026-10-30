import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, ALL_ON, captureSpeech, createRoom, expectNoScroll, joinRoom, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Liegen auf diesem Handy gerade genau fünf Früchte einer Sorte offen? (oberste Karten aus den Kacheln bzw. Zonen) */
async function ready(p: Page, scope: string): Promise<boolean> {
  return p.evaluate((sel) => {
    const t: Record<string, number> = {};
    for (const el of document.querySelectorAll(`${sel} [data-testid="fruit-card"]`)) {
      const c = el.getAttribute("data-card") ?? "";
      const [f, n] = c.split("-");
      t[f] = (t[f] ?? 0) + Number(n);
    }
    return Object.values(t).includes(5);
  }, scope);
}

/** Wer gerade aufdecken darf, deckt auf (online) */
async function flipSomeone(phones: Page[]): Promise<boolean> {
  for (const p of phones) {
    const b = p.getByTestId("kl-flip");
    if (await b.isEnabled().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); return true; }
  }
  return false;
}

async function sizes(p: Page, name: string) {
  await expectNoScroll(p);
  await shot(p, name);
  await p.setViewportSize({ width: 360, height: 640 });
  await expectNoScroll(p);
  await shot(p, `${name}-360`);
  await p.setViewportSize({ width: 320, height: 568 });
  await expectNoScroll(p);
  await shot(p, `${name}-320`);
  await p.setViewportSize({ width: 390, height: 844 });
}

test("Klingel online mit drei Handys: aufdecken, falsch und richtig klingeln – der Schnellste bekommt die Karten", async ({ browser }) => {
  test.setTimeout(180_000);
  const anna = await newPhone(browser);
  await captureSpeech(anna);
  const ben = await newPhone(browser);
  const cem = await newPhone(browser);
  const code = await createRoom(anna, "klingel", "Anna", "4353");
  await joinRoom(ben, code, "Ben", "4353");
  await joinRoom(cem, code, "Cem", "4353");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  const phones = [anna, ben, cem];
  for (const p of phones) await expect(p.getByTestId("kl-bell")).toBeVisible();
  await expect(anna.getByTestId("kl-status")).toContainText("Du deckst auf");
  await expect(ben.getByTestId("kl-flip")).toBeDisabled();
  await anna.getByTestId("kl-flip").click();
  await expect(ben.getByTestId("kl-tile-Anna").getByTestId("fruit-card")).toBeVisible();
  await expect(ben.getByTestId("kl-status")).toContainText("Du deckst auf");

  let wrong = false, right = false;
  for (let i = 0; i < 120 && !right; i++) {
    if (await ready(anna, "[data-testid=kl-tiles]")) {
      if (!wrong) { await flipSomeone(phones); continue; }
      await sizes(anna, "klingel-online");
      // Ben und Cem hauen fast gleichzeitig drauf – einer bekommt alle offenen Karten
      await Promise.all([ben.getByTestId("kl-bell").click(), cem.getByTestId("kl-bell").click()]);
      await expect(anna.getByTestId("ring-flash")).toHaveAttribute("data-ok", "true");
      await expect(anna.getByTestId("ring-flash")).toContainText(/(Ben|Cem) war am schnellsten/);
      await expectNoScroll(anna);
      await shot(anna, "klingel-online-klingel");
      await expect(anna.getByTestId("kl-tiles").getByTestId("fruit-card")).toHaveCount(0);
      right = true;
      break;
    }
    const open = await anna.getByTestId("kl-tiles").getByTestId("fruit-card").count();
    if (!wrong && open >= 2) {
      // keine Fünf: Cem klingelt trotzdem – und gibt jedem eine Karte ab
      const before = Number(await cem.getByTestId("kl-tile-Du").locator("span").first().textContent());
      await cem.getByTestId("kl-bell").click();
      await expect(anna.getByTestId("ring-flash")).toHaveAttribute("data-ok", "false");
      await expect(anna.getByTestId("ring-flash")).toContainText("Cem hat falsch geklingelt");
      await expect(cem.getByTestId("kl-tile-Du").locator("span").first()).toHaveText(String(before - 2));
      await expect(cem.getByTestId("kl-bell")).toContainText("Geklingelt");
      wrong = true;
      await expect(anna.getByTestId("ring-flash")).toBeHidden({ timeout: 5000 });
    }
    await flipSomeone(phones);
    await anna.waitForTimeout(150);
  }
  expect(wrong).toBe(true);
  expect(right).toBe(true);
  const said = await spoken(anna);
  expect(said).toContain("Willkommen bei Klingel!");
  expect(said).toContain("Falsch geklingelt, Cem!");
  expect(said).toMatch(/(Ben|Cem) war am schnellsten/);
});

test("Klingel an einem Handy für alle: Zonen am Rand, Klingel in der Mitte, mehrere Finger – bis zum Sieg", async ({ page }) => {
  test.setTimeout(120_000);
  await captureSpeech(page);
  await startLocal(page, "klingel", ["Anna", "Ben", "Cem", "Dora"]);
  await expect(page.getByTestId("kl-local")).toBeVisible();
  for (const n of ["Anna", "Ben", "Cem", "Dora"]) await expect(page.getByTestId(`kl-zone-${n}`)).toBeVisible();
  // Reihum aufdecken – Anna, Ben, Cem, Dora
  for (const n of ["Anna", "Ben", "Cem", "Dora"]) {
    await page.getByTestId(`kl-flip-${n}`).click();
    await expect(page.getByTestId(`kl-zone-${n}`).getByTestId("fruit-card")).toBeVisible();
  }
  await sizes(page, "klingel-lokal");
  // Klingeln: Ben tippt in seine Zone, gleichzeitig tippt Dora auf die Klingel – der Erste zählt
  const ok = await ready(page, "[data-testid=kl-local]");
  await page.getByTestId("kl-zone-Ben").dispatchEvent("pointerdown", { clientX: 10, clientY: 10, pointerId: 1, isPrimary: true });
  if (ok) await page.getByTestId("kl-bell").dispatchEvent("pointerdown", { clientX: 200, clientY: 420, pointerId: 2, isPrimary: false });
  await expect(page.getByTestId("ring-flash")).toHaveAttribute("data-ok", String(ok));
  await expect(page.getByTestId("ring-flash")).toContainText(ok ? "Ben war am schnellsten" : "Ben hat falsch geklingelt");
  await expectNoScroll(page);
  await shot(page, "klingel-lokal-klingel");

  // Zum Ende: Ben hat nur noch eine Karte und klingelt falsch – er gibt sie ab und ist raus, bis Anna alles hat
  await page.evaluate(() => {
    const key = "spieltisch:local:klingel";
    const r = JSON.parse(localStorage.getItem(key)!);
    const s = r.game;
    const [a, b, c, d] = s.order;
    const all = [...Object.values(s.stock), ...Object.values(s.open)].flat() as string[];
    s.open = { [a]: [], [b]: [], [c]: [], [d]: [] };
    s.stock = { [a]: all.slice(1), [b]: all.slice(0, 1), [c]: [], [d]: [] };
    s.out = [c, d];
    s.fouls = [];
    s.ring = null;
    s.curId = a;
    localStorage.setItem(key, JSON.stringify(r));
  });
  await page.reload();
  await expect(page.getByTestId("kl-zone-Ben")).toBeVisible();
  await page.getByTestId("kl-zone-Ben").dispatchEvent("pointerdown", { clientX: 10, clientY: 10 });
  await expect(page.getByTestId("winner")).toContainText("Anna");
  await expect(page.getByText("hat alle 56 Karten")).toBeVisible();
  await sizes(page, "klingel-ende");
  const said = await spoken(page);
  expect(said).toContain("Falsch geklingelt, Ben!");
  expect(said).toContain("Anna hat alle Karten und gewinnt!");
});

test("Klingel online mit Bots: Bots decken auf und klingeln von selbst", async ({ page }) => {
  test.setTimeout(150_000);
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  const dev = page.getByRole("checkbox", { name: "Entwickler-Modus" });
  if (!(await dev.isChecked())) await dev.click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("klingel");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("kl-bell")).toBeVisible();
  // Ich decke auf, wenn ich dran bin – die Bots machen den Rest, bis einer (richtig oder falsch) klingelt
  const flash = page.getByTestId("ring-flash");
  for (let i = 0; i < 400 && !(await flash.isVisible()); i++) {
    const b = page.getByTestId("kl-flip");
    if (await b.isEnabled().catch(() => false)) await b.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await expect(flash).toBeVisible();
  await expectNoScroll(page);
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Klingel am Großen Tisch: offene Karten an den Plätzen, Klingel in der Mitte, wer klingelt, steht darauf", async ({ browser, request }) => {
  test.setTimeout(150_000);
  await setConfig(request, { ...ALL_ON, modes: { klingel: { table: "on" } } });
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
    await phones[0].getByTestId("pick-klingel").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-bell")).toBeVisible();
    await expect(screen.getByTestId("seat-fruit")).toHaveCount(3);
    for (let k = 0; k < 3; k++) await flipSomeone(phones);
    await expect(screen.getByTestId("seat-fruit").getByTestId("fruit-card")).toHaveCount(3);
    await shot(screen, "klingel-fernseher");
    await phones[1].getByTestId("kl-bell").click();
    await expect(screen.getByTestId("table-ring")).toContainText("Ben");
    await shot(screen, "klingel-fernseher-klingel");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
