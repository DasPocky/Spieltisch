import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, newPhone, shot } from "./util";

const PW = "test-admin";

async function adminPhone(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin-Passwort").fill(PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByTestId("admin-tile-live")).toBeVisible();
}

test("Verwaltung: Tab erscheint nach der Anmeldung, Abmelden nimmt ihn wieder weg", async ({ page }) => {
  await page.goto("/profil");
  await expect(page.getByTestId("tabbar-verwaltung")).toHaveCount(0);
  await page.getByTestId("admin-link").click();
  await page.getByLabel("Admin-Passwort").fill(PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByTestId("tabbar-verwaltung")).toBeVisible();
  // Profil-Link braucht es auf Admin-Geräten nicht mehr
  await page.getByTestId("tabbar-profil").click();
  await expect(page.getByTestId("admin-link")).toHaveCount(0);
  await page.getByTestId("tabbar-verwaltung").click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByTestId("tabbar-verwaltung")).toHaveCount(0);
});

test("Verwaltung Live: Nachricht, Host, Einstellungen, Partie beenden, PIN, Entfernen, Zuschauen", async ({ browser }) => {
  const anna = await newPhone(browser);
  const code = await createRoom(anna, "tutto", "Anna", "1234");
  const ben = await newPhone(browser);
  await joinRoom(ben, code, "Ben", "1234");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByRole("button", { name: "Spiel starten" })).toHaveCount(0);

  const admin = await newPhone(browser);
  await adminPhone(admin);
  await admin.getByTestId("admin-tile-live").click();
  await admin.getByTestId(`room-${code}`).click();
  const sheet = admin.getByTestId("room-sheet");
  await expect(sheet.getByText("Partie läuft")).toBeVisible();
  await expect(sheet.getByTestId("room-player-Ben")).toBeVisible();
  await shot(admin, "admin-live-raum");

  // Nachricht an alle
  await sheet.getByLabel("Nachricht an alle im Raum").fill("Gleich ist Wartung");
  await sheet.getByRole("button", { name: "Nachricht senden" }).click();
  await expect(anna.getByRole("button", { name: "Verwaltung: Gleich ist Wartung" })).toBeVisible();
  await expect(ben.getByText("Nachricht der Verwaltung")).toBeVisible();

  // Zuschauen: unsichtbar, im Raum taucht niemand auf
  await sheet.getByRole("button", { name: "Zuschauen" }).click();
  await expect(admin.getByTestId("admin-watch")).toBeVisible();
  await expect(admin.getByTestId("admin-watch").getByText("Anna").first()).toBeVisible();
  await shot(admin, "admin-live-zuschauen");
  await admin.getByRole("button", { name: "Zuschauen beenden" }).click();
  await expect(admin.getByTestId("admin-watch")).toHaveCount(0);

  // Partie beenden
  await admin.getByTestId(`room-${code}`).click();
  await sheet.getByRole("button", { name: "Partie beenden" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Beenden" }).click();
  await expect(sheet.getByText("Lobby", { exact: false }).first()).toBeVisible();
  await expect(anna.getByRole("button", { name: "Spiel starten" })).toBeVisible();

  // Host übergeben
  await sheet.getByRole("button", { name: "Ben zum Host machen" }).click();
  await expect(sheet.getByTestId("room-player-Ben").getByText("Host")).toBeVisible();
  await expect(ben.getByRole("button", { name: "Spiel starten" })).toBeVisible();

  // Einstellungen: Name und Dauerraum
  await sheet.getByLabel("Name", { exact: true }).fill("Stammtisch");
  await sheet.getByLabel("Name", { exact: true }).press("Enter");
  await expect(admin.getByText("Name: Stammtisch")).toBeVisible();
  await sheet.getByRole("radio", { name: "Dauer" }).click();
  await expect(admin.getByText("Ist jetzt ein Dauerraum")).toBeVisible();

  // Neue PIN: Neue Leute brauchen sie, wer drin ist, bleibt drin
  await sheet.getByLabel(/Neue PIN/).fill("9876");
  await sheet.getByRole("button", { name: "Setzen" }).click();
  await expect(admin.getByText("Neue PIN gilt ab sofort.")).toBeVisible();
  const cara = await newPhone(browser);
  await cara.goto(`/r/${code}`);
  await cara.getByLabel("Dein Name").fill("Cara");
  await cara.getByLabel("PIN").fill("1234");
  await cara.getByRole("button", { name: "Beitreten" }).click();
  await expect(cara.getByText("Die PIN stimmt nicht.")).toBeVisible();
  await joinRoom(cara, code, "Cara", "9876");
  await expect(sheet.getByTestId("room-player-Cara")).toBeVisible({ timeout: 10_000 });

  // Entfernen
  await sheet.getByRole("button", { name: "Cara entfernen" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Entfernen" }).click();
  await expect(cara.getByText("Du wurdest aus dem Raum entfernt.")).toBeVisible();
  await expect(sheet.getByTestId("room-player-Cara")).toHaveCount(0);
  await shot(admin, "admin-live-raum-danach");

  // Schließen
  await sheet.getByRole("button", { name: "Raum schließen" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Schließen" }).click();
  await expect(anna.getByText("Raum beendet")).toBeVisible();
});

test("Verwaltung Status: Version, Dienste und Anfragen; Details zum Aufklappen", async ({ page, request }) => {
  const s = await (await request.get("/api/admin/status", { headers: { "x-admin-password": PW } })).json();
  expect(s.build.sha).toMatch(/^([0-9a-f]{40}|dev)$/);
  expect(s.services).toMatchObject({ password: true, realtime: true });
  expect(typeof s.requests.count).toBe("number");
  expect((await request.get("/api/admin/status")).status()).toBe(403);
  await adminPhone(page);
  await expect(page.getByTestId("status-version")).not.toHaveText(/…/);
  await page.getByTestId("admin-status").getByRole("button").first().click();
  await expect(page.getByTestId("status-details")).toContainText("Anfragen heute");
  await expect(page.getByTestId("status-details")).toContainText(s.build.sha.slice(0, 7));
});
