import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createRoom, newPhone, openSettings, shot } from "./util";

const PW = "test-admin";
const allOn = { site: "on", games: {}, message: "" };

async function setConfig(request: APIRequestContext, config: object, code?: string | null) {
  const res = await request.post("/api/admin", { data: { password: PW, config, code } });
  expect(res.ok()).toBe(true);
}

async function setDefaults(request: APIRequestContext, defaults: object) {
  const res = await request.post("/api/admin", { data: { password: PW, defaults } });
  expect(res.ok()).toBe(true);
}

/** Admin-Screenshots für die Durchsicht (ganze Seite) */
const ADMIN_SHOTS = process.env.ADMIN_SHOTS;
async function adminShot(page: Page, name: string) {
  if (!ADMIN_SHOTS) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ADMIN_SHOTS}/${name}.png`, fullPage: true });
}

async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin-Passwort").fill(PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("radiogroup", { name: "Spieltisch" })).toBeVisible();
}

test.afterEach(async ({ request }) => {
  await setConfig(request, allOn, null);
  await setDefaults(request, {});
});

test("Admin: falsches Passwort wird abgelehnt", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Admin-Passwort").fill("falsch");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("alert")).toHaveText("Falsches Passwort.");
});

test("Admin: Spiel abschalten und hinter Zugangscode legen", async ({ page, request }) => {
  await setConfig(request, allOn, null);
  await login(page);
  await page.getByRole("radiogroup", { name: "Kniffel" }).getByRole("radio", { name: /Aus/ }).click();
  await page.getByRole("radiogroup", { name: "Flip 7" }).getByRole("radio", { name: /Code/ }).click();
  await page.getByLabel(/Zugangscode/).fill("spieleabend");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");
  await shot(page, "99-admin");

  // Spielauswahl der Lobby: Kniffel weg, Flip 7 mit Schloss
  await page.goto("/");
  await page.getByRole("button", { name: /Ein Handy für alle/ }).click();
  await page.getByTestId("game-card").click();
  await expect(page.getByRole("button", { name: /^Tutto/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kniffel/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Flip 7/ })).toHaveAccessibleName(/Flip 7/);
  await expect(page.getByRole("button", { name: /^Flip 7/ }).getByLabel("mit Zugangscode")).toBeVisible();

  // Kniffel über den alten Link: geschlossen
  await page.goto("/spiel/kniffel");
  await expect(page.getByTestId("closed")).toHaveText("Kniffel ist gerade geschlossen");

  // Server lehnt Online-Räume ab
  const off = await request.post("/api/rooms", { data: { pin: "1234", game: "kniffel" } });
  expect(off.status()).toBe(403);
  const noCode = await request.post("/api/rooms", { data: { pin: "1234", game: "flip7" } });
  expect(noCode.status()).toBe(403);
  const withCode = await request.post("/api/rooms", { data: { pin: "1234", game: "flip7", access: "spieleabend" } });
  expect(withCode.status()).toBe(201);

  // Flip 7: erst Code, dann geht's
  await page.goto("/spiel/flip7");
  await page.getByLabel("Zugangscode").fill("falsch1");
  await page.getByRole("button", { name: "Freischalten" }).click();
  await expect(page.getByRole("alert")).toHaveText("Der Code stimmt nicht.");
  await page.getByLabel("Zugangscode").fill("spieleabend");
  await page.getByRole("button", { name: "Freischalten" }).click();
  await expect(page.getByTestId("game-card")).toContainText("Flip 7");
});

test("Admin: ganzer Spieltisch aus mit Hinweis", async ({ page, request }) => {
  await setConfig(request, { site: "off", games: {}, message: "Heute ab 20 Uhr wieder offen" });
  await page.goto("/");
  await expect(page.getByTestId("closed")).toHaveText("Der Spieltisch ist gerade geschlossen");
  await expect(page.getByText("Heute ab 20 Uhr wieder offen")).toBeVisible();
  await shot(page, "99-admin-closed");
  // Admin-Seite bleibt erreichbar
  await login(page);
});

test("Admin: bleibt nach dem Neuladen angemeldet, Abmelden beendet die Sitzung", async ({ page, request }) => {
  await login(page);
  const token = await page.evaluate(() => localStorage.getItem("spieltisch:admin"));
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  // Token gilt für die Admin-API
  expect((await request.get("/api/admin/stats", { headers: { authorization: `Bearer ${token}` } })).ok()).toBe(true);

  await page.reload();
  await expect(page.getByRole("tab", { name: "Räume" })).toBeVisible();
  await expect(page.getByLabel("Admin-Passwort")).toHaveCount(0);

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByLabel("Admin-Passwort")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("spieltisch:admin"))).toBeNull();
  await page.reload();
  await expect(page.getByLabel("Admin-Passwort")).toBeVisible();
  // Auf dem Server widerrufen
  expect((await request.get("/api/admin/stats", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(401);
  expect((await request.get("/api/admin/stats")).status()).toBe(403);
});

test("Admin: Räume sehen, PIN-Sperre aufheben und Raum schließen", async ({ page, browser }) => {
  const host = await newPhone(browser);
  const code = await createRoom(host, "tutto", "Hanna", "4321");
  await expect(host.getByText(/Hanna/).first()).toBeVisible();

  // Achtmal falsche PIN: Raum gesperrt
  await host.evaluate(async (c) => {
    const ws = new WebSocket(`${location.origin.replace("http", "ws")}/api/rooms/${c}/ws`);
    await new Promise((r) => ws.addEventListener("open", r));
    for (let i = 0; i < 8; i++) {
      ws.send(JSON.stringify({ type: "join", name: `X${i}`, pin: "0000" }));
      await new Promise((r) => ws.addEventListener("message", r, { once: true }));
    }
    ws.close();
  }, code);

  await login(page);
  await page.getByRole("tab", { name: "Räume" }).click();
  const card = page.getByTestId(`room-${code}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Tutto");
  await expect(card).toContainText("Lobby");
  await expect(card).toContainText("1 Spieler · 1 online");
  await expect(card).toContainText("Hanna");
  await expect(card).toContainText("PIN gesperrt");
  await adminShot(page, "2-raeume");

  await card.getByRole("button", { name: "PIN-Sperre aufheben" }).click();
  await expect(page.getByRole("status")).toHaveText(`PIN-Sperre von ${code} ist aufgehoben.`);
  await expect(card).not.toContainText("PIN gesperrt");

  await card.getByRole("button", { name: "Raum schließen" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("status")).toHaveText(`Raum ${code} ist geschlossen.`);
  await expect(card).toHaveCount(0);
  await expect(host.getByRole("heading", { name: "Raum beendet" })).toBeVisible();
  await expect(host.getByText("Der Raum wurde geschlossen.")).toBeVisible();
  await host.context().close();
});

test("Admin: Standard-Einstellungen gelten für neue Räume und lokal", async ({ page, browser }) => {
  await login(page);
  await page.getByRole("tab", { name: "Standards" }).click();
  await page.getByRole("button", { name: "Kniffel", exact: true }).click();
  await page.getByRole("radio", { name: /Ohne Extra/ }).click();
  await adminShot(page, "3-standards");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");
  await expect(page.getByRole("button", { name: "Kniffel (angepasst)" })).toBeVisible();

  // Online: neuer Raum hat den Standard
  const host = await newPhone(browser);
  await createRoom(host, "kniffel", "Hanna", "4321");
  await openSettings(host);
  await expect(host.getByRole("radio", { name: /Ohne Extra/ })).toBeChecked();
  await host.context().close();

  // Lokal: frischer Spielstand startet mit dem Standard, lässt sich aber ändern
  const local = await newPhone(browser);
  await local.goto("/spiel/kniffel/lokal");
  await openSettings(local);
  const box = local.getByRole("radio", { name: /Ohne Extra/ });
  await expect(box).toBeChecked();
  await local.getByRole("radio", { name: /\+50 und Joker/ }).click();
  await expect(box).not.toBeChecked();
  await local.context().close();
});

test("Admin: Statistik zählt Räume und Partien", async ({ page, request, browser }) => {
  const before = await (await request.get("/api/admin/stats", { headers: { "x-admin-password": PW } })).json();
  const rooms = (before.totals.kniffel?.rooms ?? 0) as number;

  // Online-Raum anlegen und eine Partie starten
  const host = await newPhone(browser);
  await createRoom(host, "kniffel", "Hanna", "4321");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByRole("button", { name: "Spiel starten" })).toHaveCount(0);
  await host.context().close();

  await login(page);
  await page.getByRole("tab", { name: "Statistik" }).click();
  const row = page.getByTestId("stat-game-kniffel");
  await expect(row).toBeVisible();
  const cells = row.getByRole("cell");
  expect(Number(await cells.nth(1).textContent())).toBeGreaterThanOrEqual(rooms + 1);
  expect(Number(await cells.nth(2).textContent())).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "Pro Woche" })).toBeVisible();
  await adminShot(page, "4-statistik");

  // Lokale Meldung: nur bekannte Spiele
  expect((await request.post("/api/stats", { data: { game: "gibtsnicht" } })).status()).toBe(400);
});

test("Admin: Screenshot Freigaben", async ({ page }) => {
  test.skip(!ADMIN_SHOTS);
  await login(page);
  await adminShot(page, "1-freigaben");
});

test("Admin: Screenshot schmales Handy", async ({ browser }) => {
  test.skip(!ADMIN_SHOTS);
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
  const page = await ctx.newPage();
  await login(page);
  await page.getByRole("tab", { name: "Statistik" }).click();
  await expect(page.getByRole("heading", { name: "Pro Woche" })).toBeVisible();
  await adminShot(page, "5-statistik-320");
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(320);
  await ctx.close();
});
