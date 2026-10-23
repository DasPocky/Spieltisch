import { expect, test } from "@playwright/test";
import { adminLogin, ADMIN_PW, newPhone, shot } from "./util";

/**
 * Die App unter einem Basispfad (endlab.de/spieltisch): läuft nur gegen einen Build mit APP_BASE=/spieltisch
 * (z. B. `APP_BASE=/spieltisch npm run build && npx vite preview --port 5202`, dann PW_PORT=5202 APP_BASE=/spieltisch).
 */
const BASE = process.env.APP_BASE ?? "";
test.skip(!BASE, "nur mit APP_BASE (Build unter einem Basispfad)");

test("Unter /spieltisch: Raum öffnen, Link teilen, beitreten, spielen – alle Adressen behalten den Basispfad", async ({ browser }) => {
  const anna = await newPhone(browser);
  await anna.goto(`${BASE}/`);
  await expect(anna).toHaveURL(new RegExp(`${BASE}/$`));
  await anna.evaluate(() => localStorage.setItem("spieltisch:lastGame", "maumau"));
  await anna.getByRole("button", { name: "Raum öffnen" }).click();
  await anna.getByLabel("Dein Name").fill("Anna");
  await anna.getByLabel(/PIN/).fill("4242");
  await anna.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(anna).toHaveURL(new RegExp(`${BASE}/r/[A-Z0-9]{5}$`));
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  const code = (await anna.getByTestId("room-code").textContent())!.trim();
  await shot(anna, "basispfad-lobby");

  // Der geteilte Link enthält den Basispfad – das zweite Handy landet im selben Raum
  const ben = await newPhone(browser);
  await ben.goto(`${BASE}/r/${code}`);
  await ben.getByLabel("Dein Name").fill("Ben");
  await ben.getByLabel("PIN").fill("4242");
  await ben.getByRole("button", { name: "Beitreten" }).click();
  await expect(ben.getByText(/Warte, bis der Host/)).toBeVisible();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(ben.getByTestId("hand")).toBeVisible();
  await expect(ben).toHaveURL(new RegExp(`${BASE}/r/${code}$`));

  // Profil und Tabs bleiben unter dem Basispfad, die Statistik kommt vom Server
  const cem = await newPhone(browser);
  await cem.goto(`${BASE}/profil`);
  await expect(cem.getByRole("heading", { name: "Mein Profil" })).toBeVisible();
  await expect(cem.getByTestId("stats")).toBeVisible();
  await cem.getByRole("button", { name: /Gruppe/ }).first().click();
  await expect(cem).toHaveURL(new RegExp(`${BASE}/gruppe$`));
});

test("Unter /spieltisch: Verwaltung und Kartensets laufen über den Basispfad", async ({ page }) => {
  expect(ADMIN_PW).toBeTruthy();
  await page.goto(`${BASE}/admin`);
  await page.getByLabel("Admin-Passwort").fill(ADMIN_PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByTestId("admin-tile-live")).toBeVisible();
  await page.getByTestId("admin-tile-kartensets").click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/admin/kartensets$`));
  await expect(page.getByTestId("admin-sets")).toBeVisible();
  void adminLogin;
});
