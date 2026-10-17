import { expect, test } from "@playwright/test";
import { ADMIN_PW, adminLogin, createRoom, joinRoom, newPhone, shot } from "./util";

test("Verwaltung: Tab erscheint nach der Anmeldung, Abmelden nimmt ihn wieder weg", async ({ page }) => {
  await page.goto("/profil");
  await expect(page.getByTestId("tabbar-verwaltung")).toHaveCount(0);
  await page.getByTestId("admin-link").click();
  await page.getByLabel("Admin-Passwort").fill(ADMIN_PW);
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
  await adminLogin(admin);
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
  const s = await (await request.get("/api/admin/status", { headers: { "x-admin-password": ADMIN_PW } })).json();
  expect(s.build.sha).toMatch(/^([0-9a-f]{40}|dev)$/);
  expect(s.services).toMatchObject({ password: true, realtime: true });
  expect(typeof s.requests.count).toBe("number");
  expect((await request.get("/api/admin/status")).status()).toBe(403);
  await adminLogin(page);
  await expect(page.getByTestId("status-version")).not.toHaveText(/…/);
  await page.getByTestId("admin-status").getByRole("button").first().click();
  await expect(page.getByTestId("status-details")).toContainText("Anfragen heute");
  await expect(page.getByTestId("status-details")).toContainText(s.build.sha.slice(0, 7));
});

test("Entwickler-Modus: Testraum mit Bots – Bots ziehen selbst, Raum ist unsichtbar, Bot lässt sich übernehmen", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await adminLogin(page);
  await page.goto("/admin/einstellungen");
  await page.getByRole("checkbox", { name: "Entwickler-Modus" }).click();
  await page.goto("/admin");
  await page.getByTestId("admin-tile-entwickler").click();
  await page.getByTestId("dev-game").selectOption("tutto");
  await page.getByRole("button", { name: "Ein Bot weniger" }).click();
  await expect(page.getByTestId("dev-bots")).toHaveText("2");
  await page.getByRole("button", { name: "Testraum öffnen" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  const code = page.url().slice(-5);
  // Der Admin ist Host und startet
  await page.getByRole("button", { name: "Spiel starten" }).click();
  // Bots sind zuerst dran und geben irgendwann ab
  await expect(page.getByTestId("current-player")).toHaveText("Du", { timeout: 60_000 });
  await shot(page, "dev-testraum");

  // Unsichtbar für andere
  const other = await newPhone(browser);
  await other.goto("/");
  const open = await (await other.request.get("/api/rooms/open")).json();
  expect(open.rooms.map((r: { code: string }) => r.code)).not.toContain(code);

  // Live: Testraum mit Bots; Bot übernehmen
  await page.goto("/admin/live");
  await expect(page.getByTestId(`room-${code}`)).toContainText("Test");
  await page.getByTestId(`room-${code}`).click();
  const sheet = page.getByTestId("room-sheet");
  await expect(sheet.getByTestId("room-player-Bot 1")).toContainText("Bot");
  await shot(page, "dev-live-bots");
  await sheet.getByRole("button", { name: "Bot 2 übernehmen" }).click();
  await expect(page).toHaveURL(new RegExp(`/r/${code}$`));
  await expect(page.getByTestId("tutto-board").or(page.getByTestId("current-player"))).toBeVisible();
});

test("Entwickler-Modus: Bots in „Ein Handy für alle“ ziehen, wenn sie dran sind", async ({ page }) => {
  test.setTimeout(120_000);
  await adminLogin(page);
  await page.evaluate(() => localStorage.setItem("spieltisch:dev", JSON.stringify({ on: true })));
  await page.goto("/spiel/tutto/lokal");
  await page.getByRole("button", { name: /Bot dazu/ }).click();
  await page.getByLabel("Name des Spielers").fill("Anna");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Anna", { timeout: 60_000 });
});

test("Entwickler-Modus: Diagnose-Anzeige und künstliches Funkloch – der Raum verbindet sich danach von selbst", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const host = await newPhone(browser);
  const code = await createRoom(host, "tutto", "Hanna", "4321");
  await adminLogin(page);
  await page.evaluate(() => localStorage.setItem("spieltisch:dev", JSON.stringify({ on: true, overlay: true })));
  await joinRoom(page, code, "Admin", "4321");
  await expect(page.getByTestId("dev-overlay")).toContainText(`Raum ${code}: verbunden`);
  // In die Verwaltung (ohne Neuladen), Funkloch auslösen, zurück in den Raum
  await page.evaluate(() => { history.pushState(null, "", "/admin/entwickler"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.getByTestId("admin-dev")).toBeVisible();
  await shot(page, "dev-bereich");
  await page.getByRole("button", { name: "5 s weg" }).click();
  await page.evaluate(() => history.back());
  await expect(page.getByTestId("dev-overlay")).toContainText("Funkloch");
  await shot(page, "dev-funkloch");
  await expect(page.getByTestId("dev-overlay")).toContainText("Netz: online", { timeout: 15_000 });
  await expect(page.getByTestId("dev-overlay")).toContainText(`Raum ${code}: verbunden`, { timeout: 15_000 });
  await expect(host.getByText("Admin")).toBeVisible();
});
