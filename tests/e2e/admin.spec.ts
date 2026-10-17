import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createRoom, newPhone, openSettings, shot } from "./util";

const PW = "test-admin";
const allOn = { site: "on", games: {}, message: "", features: { online: true, call: true, groups: true, profiles: true, local: true, offline: false } };

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
  await expect(page.getByTestId("admin-tile-live")).toBeVisible();
}

/** Bereich der Verwaltung öffnen (über die Kachel auf dem Admin-Start) */
async function section(page: Page, id: "live" | "statistik" | "spiele" | "leute" | "einstellungen") {
  if (!/\/admin\/?$/.test(new URL(page.url()).pathname)) await page.goto("/admin");
  await page.getByTestId(`admin-tile-${id}`).click();
  await expect(page).toHaveURL(new RegExp(`/admin/${id}$`));
}

// Läuft in der CI auf einem eigenen Server ohne Einrichtungsschritt – deshalb hier selbst alles einschalten
test.beforeAll(async ({ request }) => {
  await setConfig(request, allOn, null);
});

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
  await section(page, "spiele");
  await page.getByRole("radiogroup", { name: "Freigabe Kniffel" }).getByRole("radio", { name: "Aus" }).click();
  await expect(page.getByText("Kniffel: Aus")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Freigabe Flip 7" }).getByRole("radio", { name: "Code" }).click();
  await expect(page.getByText("Flip 7: Code")).toBeVisible();
  await shot(page, "99-admin");
  // Ohne Zugangscode weist der Admin-Start darauf hin – ein Tipp führt hin
  await page.goto("/admin");
  await page.getByTestId("admin-notes").getByRole("button", { name: "Festlegen" }).click();
  await page.getByLabel(/Zugangscode/).fill("spieleabend");
  await page.getByRole("button", { name: "Setzen" }).click();
  await expect(page.getByRole("status")).toHaveText("Zugangscode gespeichert.");

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
  await expect(page.getByTestId("admin-tile-live")).toBeVisible();
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
  // Admin-Start meldet die Sperre und löst sie mit einem Tipp; der Tab trägt einen Punkt
  await expect(page.getByTestId("admin-notes")).toContainText(code);
  await expect(page.getByTestId("admin-dot")).toBeVisible();
  await section(page, "live");
  const card = page.getByTestId(`room-${code}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Tutto");
  await expect(card).toContainText("Lobby");
  await expect(card).toContainText("1 Spieler, 1 online");
  await expect(card).toContainText("gesperrt");
  await adminShot(page, "2-raeume");

  await card.click();
  const sheet = page.getByTestId("room-sheet");
  await expect(sheet.getByTestId("room-player-Hanna")).toBeVisible();
  await sheet.getByRole("button", { name: "Lösen" }).click();
  await expect(page.getByText(`PIN-Sperre von ${code} ist aufgehoben.`)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Lösen" })).toHaveCount(0);

  await sheet.getByRole("button", { name: "Raum schließen" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByText(`Raum ${code} ist geschlossen.`)).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(host.getByRole("heading", { name: "Raum beendet" })).toBeVisible();
  await expect(host.getByText("Der Raum wurde geschlossen.")).toBeVisible();
  await host.context().close();
});

test("Admin: Standard-Einstellungen gelten für neue Räume und lokal", async ({ page, browser }) => {
  await login(page);
  await section(page, "spiele");
  await page.getByRole("button", { name: "Standards Kniffel" }).click();
  const sheet = page.getByTestId("defaults-sheet");
  await sheet.getByRole("radio", { name: /Ohne Extra/ }).click();
  await expect(page.getByText(/^Kniffel: /)).toBeVisible();
  await adminShot(page, "3-standards");
  await sheet.getByRole("button", { name: "Fertig" }).click();
  await expect(page.getByTestId("admin-game-kniffel")).toContainText("eigene Standards");

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

test("Admin: Übersicht zählt Räume und Partien", async ({ page, request, browser }) => {
  const before = await (await request.get("/api/admin/stats", { headers: { "x-admin-password": PW } })).json();
  const rooms = (before.totals.kniffel?.rooms ?? 0) as number;

  // Online-Raum anlegen und eine Partie starten
  const host = await newPhone(browser);
  await createRoom(host, "kniffel", "Hanna", "4321");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByRole("button", { name: "Spiel starten" })).toHaveCount(0);
  await host.context().close();

  const after = await (await request.get("/api/admin/stats", { headers: { "x-admin-password": PW } })).json();
  expect(after.totals.kniffel.rooms).toBeGreaterThanOrEqual(rooms + 1);
  // Spitzenzeit gezählt
  expect(Object.values(after.days[0].slots ?? {}).reduce((a: number, b) => a + (b as number), 0)).toBeGreaterThanOrEqual(1);

  await login(page);
  await section(page, "statistik");
  await page.getByRole("radio", { name: "Gesamt" }).click();
  const row = page.getByTestId("stat-game-kniffel");
  await expect(row).toBeVisible();
  await expect(row).toContainText(/[1-9]\d* online/);
  await expect(page.getByRole("heading", { name: "Partien pro Woche" })).toBeVisible();
  await expect(page.getByTestId("stat-heatmap")).toContainText("Am meisten los");
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
  await section(page, "statistik");
  await expect(page.getByRole("heading", { name: "Partien pro Tag" })).toBeVisible();
  await adminShot(page, "5-statistik-320");
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(320);
  await ctx.close();
});

test("Admin: Verlauf zeigt, wer da war; Gruppen, Optionen, Export und Löschen", async ({ page, request, browser }) => {
  // Ein Raum mit zwei Leuten und einer Partie
  const host = await newPhone(browser);
  const code = await createRoom(host, "vier", "Henrike", "2580");
  const guest = await newPhone(browser);
  await guest.goto(`/r/${code}`);
  await guest.getByLabel("Dein Name").fill("Gustav");
  await guest.getByLabel("PIN").fill("2580");
  await guest.getByRole("button", { name: "Beitreten" }).click();
  await expect(host.getByText("Gustav")).toBeVisible();
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(host.getByRole("button", { name: "Spiel starten" })).toHaveCount(0);

  await login(page);
  // Admin-Start: gerade offen
  await expect(page.getByTestId("live-rooms")).not.toContainText(/^Räume offen0/);
  await adminShot(page, "6-uebersicht");
  // Verlauf: Raum mit beiden Namen, Leute-Liste, Suche
  await section(page, "leute");
  const card = page.getByTestId(`arch-${code}`);
  await expect(card).toContainText("Henrike");
  await expect(card).toContainText("Gustav");
  await expect(card).toContainText("Vier in einer Reihe");
  await expect(card).toContainText("1 Partie");
  await page.getByRole("radio", { name: /Leute/ }).click();
  await expect(page.getByTestId("people")).toContainText("Gustav");
  await page.getByLabel("Verlauf durchsuchen").fill("henri");
  await expect(page.getByTestId("people")).not.toContainText("Gustav");
  await adminShot(page, "7-verlauf");

  // Banner und „Neu“ gelten sofort für Besucher
  await section(page, "spiele");
  await page.getByRole("button", { name: "Dame als neu markieren" }).click();
  await expect(page.getByText("Dame als neu markiert")).toBeVisible();
  await section(page, "einstellungen");
  await page.getByLabel("Hinweis-Banner (optional)").fill("Neu: Mühle und Dame!");
  await page.getByLabel("Hinweis-Banner (optional)").press("Enter");
  await expect(page.getByText("Banner gespeichert")).toBeVisible();
  await adminShot(page, "8-optionen");
  const visitor = await newPhone(browser);
  await visitor.goto("/");
  await expect(visitor.getByTestId("banner")).toHaveText("Neu: Mühle und Dame!");
  await visitor.getByRole("button", { name: /Ein Handy für alle/ }).click();
  await visitor.getByTestId("game-card").click();
  await expect(visitor.getByTestId("pick-dame")).toContainText("NEU");
  await visitor.context().close();

  // Ein benutztes Handy (Name, Profil) – vor dem Neustart bleibt beim Laden alles, wie es ist
  const phone = await newPhone(browser);
  await phone.goto("/");
  await phone.evaluate(() => localStorage.setItem("spieltisch:name", "Oma"));
  await phone.reload();
  await expect(phone.getByTestId("greeting")).toHaveText("Hallo, Oma!");

  // Daten: alles löschen braucht „LÖSCHEN“, danach leer und der Raum ist zu
  await page.getByRole("button", { name: "Alles auswählen" }).click();
  const wipe = page.getByRole("button", { name: /endgültig löschen/ });
  await expect(wipe).toBeDisabled();
  await page.getByLabel(/LÖSCHEN/).fill("löschen");
  await adminShot(page, "9-daten");
  await wipe.click();
  await expect(page.getByTestId("data").getByRole("status")).toHaveText("Gelöscht.");
  await expect(host.getByText(/geschlossen|beendet/i).first()).toBeVisible();
  await page.goto("/admin/leute");
  await expect(page.getByTestId("history")).toContainText("Noch keine Räume im Verlauf");
  const stats = await (await request.get("/api/admin/stats", { headers: { "x-admin-password": PW } })).json();
  expect(Object.keys(stats.totals)).toHaveLength(0);
  // Einstellungen auf Auslieferungszustand: kein Banner, alle Spiele frei, „Ein Handy für alle“ aus, Obergrenze 1 Woche
  const fresh = await (await request.get("/api/config")).json();
  expect(fresh).toMatchObject({ banner: "", games: {}, featured: [], limits: { roomHours: 168 }, features: { local: false, online: true } });
  await page.goto("/admin/einstellungen");
  await expect(page.getByLabel("Hinweis-Banner (optional)")).toHaveValue("");
  // Kompletter Neustart: das Handy löscht beim nächsten Öffnen einmal alles – danach nie wieder von selbst
  expect(fresh.epoch).toBeTruthy();
  await phone.reload();
  // Die App löscht und lädt dabei selbst neu – danach ohne Namen
  await expect(phone.getByTestId("greeting")).toHaveText("Spieltisch");
  expect(await phone.evaluate(() => localStorage.getItem("spieltisch:name"))).toBeNull();
  expect(await phone.evaluate(() => localStorage.getItem("spieltisch:epoch"))).toBe(fresh.epoch);
  await phone.evaluate(() => localStorage.setItem("spieltisch:name", "Oma"));
  await phone.reload();
  await expect(phone.getByTestId("greeting")).toHaveText("Hallo, Oma!");
  await phone.context().close();
  // Der Admin selbst bleibt angemeldet
  await page.reload();
  await expect(page.getByTestId("data")).toBeVisible();
  await host.context().close();
  await guest.context().close();
});

test("Admin: Gruppen und Profile erscheinen im Verzeichnis und lassen sich löschen", async ({ page, request }) => {
  const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const profile = Array.from({ length: 16 }, () => AB[Math.floor(Math.random() * AB.length)]).join("");
  // Profil spielt eine Partie, Gruppe wird angelegt
  expect((await request.post(`/api/profile/${profile}/result`, { data: { gameId: "kniffel", won: true, score: 210, players: 2 } })).ok()).toBe(true);
  const g = await (await request.post("/api/groups", { data: { profile, member: "Ida", name: "Testrunde" } })).json();
  const code = g.group.code as string;

  await login(page);
  await section(page, "leute");
  await page.getByRole("radio", { name: /Gruppen & Profile/ }).click();
  await expect(page.getByTestId(`group-${code}`)).toContainText("Testrunde");
  await expect(page.getByTestId(`profile-${profile}`)).toContainText("1 Partie");
  await adminShot(page, "10-gruppen");
  await page.getByTestId(`group-${code}`).getByRole("button", { name: "Gruppe Testrunde löschen" }).click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page.getByTestId(`group-${code}`)).toHaveCount(0);
  expect((await request.get(`/api/groups/${code}`)).status()).toBe(404);
  await page.getByTestId(`profile-${profile}`).getByRole("button").click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page.getByTestId(`profile-${profile}`)).toHaveCount(0);
});
