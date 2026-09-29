import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { shot } from "./util";

const PW = "test-admin";
const allOn = { site: "on", games: {}, message: "" };

async function setConfig(request: APIRequestContext, config: object, code?: string | null) {
  const res = await request.post("/api/admin", { data: { password: PW, config, code } });
  expect(res.ok()).toBe(true);
}

async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin-Passwort").fill(PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("radiogroup", { name: "Spieltisch" })).toBeVisible();
}

test.afterEach(async ({ request }) => { await setConfig(request, allOn, null); });

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

  // Startseite: Kniffel weg, Flip 7 mit Schloss
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Tutto/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kniffel/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Flip 7/ })).toContainText("🔒");

  // Kniffel direkt aufgerufen: geschlossen
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
  await expect(page.getByRole("heading", { name: "Flip 7" })).toBeVisible();
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
