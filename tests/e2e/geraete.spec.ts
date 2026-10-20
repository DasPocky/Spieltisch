import { expect, test, type Browser, type Page } from "@playwright/test";
import { ALL_ON, expectNoScroll, newPhone, setConfig, shot } from "./util";

/**
 * Kleine Prüfreihe für Desktop und Fernseher (die vielen Handy-Tests laufen im Projekt „spiele“):
 * Startseite, Tastatur, Barrierefreiheit (Namen für Knöpfe), Raum am Rechner, Großer Tisch in 4K und ohne 3D.
 */
async function desktop(browser: Browser, opts: { width?: number; height?: number; reducedMotion?: "reduce" } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 }, locale: "de-DE", reducedMotion: opts.reducedMotion });
  return ctx.newPage();
}

/** Jeder sichtbare Knopf und Link hat einen Namen (Text, aria-label oder title) */
async function expectNamedControls(page: Page) {
  const unnamed = await page.evaluate(() => [...document.querySelectorAll("button, a[href], [role=button]")]
    .filter((el) => (el as HTMLElement).offsetParent !== null)
    .filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent?.trim() || el.getAttribute("aria-labelledby")))
    .map((el) => el.outerHTML.slice(0, 120)));
  expect(unnamed, unnamed.join("\n")).toEqual([]);
}

test("Desktop: Startseite mit Seitenleiste, Tastatur erreicht die Hauptaktionen, alle Knöpfe haben Namen", async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Bereiche" })).toBeVisible();
  await expectNamedControls(page);
  // Mit Tab zu „Raum öffnen“
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => /Raum öffnen|Hier selbst mitspielen/.test(document.activeElement?.textContent ?? ""));
  }
  expect(reached).toBe(true);
  await shot(page, "g1-desktop-start");
});

test("Desktop: Raum am Rechner, Handy tritt bei, Partie passt ohne Scrollen", async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("spieltisch:lastGame", "maumau"));
  await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill("6060");
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByTestId("meet-play").click();
  await page.getByTestId("pick-maumau").click();
  const code = (await page.getByTestId("room-code").textContent())!.trim();
  const phone = await newPhone(browser);
  await phone.goto(`/r/${code}`);
  await phone.getByLabel("Dein Name").fill("Ben");
  await phone.getByLabel("PIN").fill("6060");
  await phone.getByRole("button", { name: "Beitreten" }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("hand")).toBeVisible();
  await expectNoScroll(page);
  await expectNamedControls(page);
  await shot(page, "g2-desktop-partie");
});

test("Fernseher (4K-Fläche): Tisch-Lobby passt, ohne 3D bleibt alles bedienbar, reduzierte Bewegung", async ({ browser }) => {
  const tv = await desktop(browser, { width: 1920, height: 1080, reducedMotion: "reduce" });
  // Kein WebGL (alter Fernseher, Grafik abgestürzt): der Tisch zeigt trotzdem Lobby und Plätze
  await tv.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof orig;
  });
  await tv.goto("/tisch");
  await tv.getByTestId("table-new").click();
  await expect(tv).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  await expect(tv.getByTestId("table-lobby")).toBeVisible();
  // ohne WebGL: der einfache flache Tisch
  await expect(tv.getByTestId("table-flat")).toBeAttached();
  await expectNoScroll(tv);
  await expectNamedControls(tv);
  await shot(tv, "g3-tv-ohne-3d");
});

test("Am Rechner am Tisch mitspielen (Mau-Mau): Tisch aus eigener Sicht, Hand darunter, Tastatur, umschaltbar", async ({ browser, request }) => {
  // Spielweise „Am Rechner“ für Mau-Mau einschalten (eingebaut: Beta)
  await setConfig(request, { ...ALL_ON, modes: { maumau: { desk: "on" } } });
  try {
    const page = await desktop(browser);
    await page.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("spieltisch:lastGame", "maumau"));
    await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
    await page.getByLabel("Dein Name").fill("Anna");
    await page.getByLabel(/PIN/).fill("7070");
    await page.getByRole("button", { name: "Öffnen", exact: true }).click();
    await page.getByTestId("meet-play").click();
    await page.getByTestId("pick-maumau").click();
    const code = (await page.getByTestId("room-code").textContent())!.trim();
    const phone = await newPhone(browser);
    await phone.goto(`/r/${code}`);
    await phone.getByLabel("Dein Name").fill("Ben");
    await phone.getByLabel("PIN").fill("7070");
    await phone.getByRole("button", { name: "Beitreten" }).click();
    await page.getByRole("button", { name: "Spiel starten" }).click();

    await expect(page.getByTestId("desk-stage")).toBeVisible();
    await expect(page.getByTestId("desk-hand").getByTestId("hand").locator("button")).toHaveCount(5);
    // Ben sitzt am Tisch gegenüber (eigener Platz ohne Schild)
    await expect(page.getByTestId("table-seat")).toHaveCount(1);
    await expect(page.getByTestId("table-seat")).toContainText("Ben");
    await expectNoScroll(page);
    await shot(page, "g4-desk-maumau");

    // Anna fängt an: mit Z ziehen, dann P passen (sofern die Karte nicht passt) – Ben ist danach dran
    const status = page.getByTestId("desk-hand").getByTestId("status");
    await expect(status).not.toContainText("ist am Zug");
    await page.keyboard.press("z");
    // eine Karte – oder zwei, wenn eine Sieben oben liegt
    await expect.poll(() => page.getByTestId("desk-hand").getByTestId("hand").locator("button").count()).toBeGreaterThan(5);
    await page.keyboard.press("p");
    await expect.poll(async () => (await status.textContent()) ?? "").toMatch(/ist am Zug|Leg|Gezogene/);

    // Klassische Ansicht und zurück
    await page.getByTestId("desk-toggle").click();
    await expect(page.getByTestId("desk-stage")).toHaveCount(0);
    await page.getByTestId("desk-toggle").click();
    await expect(page.getByTestId("desk-stage")).toBeVisible();
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Handy als Begleiter: QR am Rechner, Handy wird zweites Gerät desselben Spielers – Rechner bleibt verbunden, Code gilt nur einmal", async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("spieltisch:lastGame", "maumau"));
  await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill("8080");
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await page.getByTestId("meet-play").click();
  await page.getByTestId("pick-maumau").click();
  await page.getByTestId("pair-open").click();
  const link = (await page.getByTestId("pair-link").textContent())!;
  expect(link).toMatch(/#pair=[A-Z0-9]{8}$/);
  await shot(page, "g5-koppeln");

  const phone = await newPhone(browser);
  await phone.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(phone.getByTestId("companion-note")).toBeVisible();
  await expect(phone.getByText("Anna (du) · Host")).toBeVisible();
  await shot(phone, "g6-begleiter");
  // Der Rechner bleibt verbunden (wird nicht verdrängt) und ist weiter Anna
  await page.keyboard.press("Escape");
  await expect(page.getByText("Anna (du) · Host")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText(/Verbindung wackelt/)).toHaveCount(0);
  // Begleit-Handy lädt neu: bleibt Begleiter (über den Zugang, nicht über den Code)
  await phone.reload();
  await expect(phone.getByTestId("companion-note")).toBeVisible();
  await expect(page.getByText("Anna (du) · Host")).toBeVisible();
  // Derselbe Code ein zweites Mal: abgelehnt
  const again = await newPhone(browser);
  await again.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(again.getByText(/Kopplungs-Code ist abgelaufen/)).toBeVisible();
});

test("Am Rechner am Tisch mitspielen (Eins!): eigene Hand unter dem Tisch, Tastatur zum Ziehen und Passen", async ({ browser, request }) => {
  await setConfig(request, { ...ALL_ON, modes: { eins: { desk: "on" } } });
  try {
    const page = await desktop(browser);
    await page.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("spieltisch:lastGame", "eins"));
    await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
    await page.getByLabel("Dein Name").fill("Anna");
    await page.getByLabel(/PIN/).fill("7171");
    await page.getByRole("button", { name: "Öffnen", exact: true }).click();
    await page.getByTestId("meet-play").click();
    await page.getByTestId("pick-eins").click();
    const code = (await page.getByTestId("room-code").textContent())!.trim();
    const phone = await newPhone(browser);
    await phone.goto(`/r/${code}`);
    await phone.getByLabel("Dein Name").fill("Ben");
    await phone.getByLabel("PIN").fill("7171");
    await phone.getByRole("button", { name: "Beitreten" }).click();
    await page.getByRole("button", { name: "Spiel starten" }).click();

    await expect(page.getByTestId("desk-stage")).toBeVisible();
    await expect(page.getByTestId("desk-hand").getByTestId("hand").locator("button")).toHaveCount(7);
    await expect(page.getByTestId("table-seat")).toContainText("Ben");
    await expectNoScroll(page);
    await shot(page, "g7-desk-eins");

    // Startkarte Farbwahl möglich: dann zuerst eine Farbe mit 1
    const status = page.getByTestId("desk-hand").getByTestId("status");
    if (/Farbwahl/.test((await status.textContent()) ?? "")) await page.keyboard.press("1");
    if (!/ist am Zug/.test((await status.textContent()) ?? "")) {
      // Anna ist dran: ziehen (Z) – danach passen (P), falls die gezogene Karte nicht gelegt wird
      await page.keyboard.press("z");
      await expect.poll(() => page.getByTestId("desk-hand").getByTestId("hand").locator("button").count()).toBeGreaterThan(7);
      await page.keyboard.press("p");
      await expect.poll(async () => (await status.textContent()) ?? "").toMatch(/ist am Zug|Leg|Gezogene|ziehen/);
    }
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Private Hand: am Rechner liegt der Tisch für alle, die Karten nur auf dem Begleit-Handy – geht das Handy, kommen sie zurück", async ({ browser }) => {
  // Mau-Mau ist das Referenzspiel: „Am Rechner“ ist ohne Verwaltung eingeschaltet
  const page = await desktop(browser);
  await page.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("spieltisch:lastGame", "maumau"));
  await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill("7272");
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await page.getByTestId("meet-play").click();
  await page.getByTestId("pick-maumau").click();
  const code = (await page.getByTestId("room-code").textContent())!.trim();
  await page.getByTestId("pair-open").click();
  const link = (await page.getByTestId("pair-link").textContent())!;
  await page.keyboard.press("Escape");
  const companion = await newPhone(browser);
  await companion.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(companion.getByTestId("companion-note")).toBeVisible();
  const ben = await newPhone(browser);
  await ben.goto(`/r/${code}`);
  await ben.getByLabel("Dein Name").fill("Ben");
  await ben.getByLabel("PIN").fill("7272");
  await ben.getByRole("button", { name: "Beitreten" }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();

  await expect(page.getByTestId("desk-stage")).toBeVisible();
  await expect(page.getByTestId("desk-hand").getByTestId("hand").locator("button")).toHaveCount(5);
  // Karten aufs Handy: der Rechner zeigt nur noch den Tisch
  await page.getByTestId("desk-private").click();
  await expect(page.getByTestId("desk-hand-private")).toBeVisible();
  await expect(page.getByTestId("hand")).toHaveCount(0);
  await expect(companion.getByTestId("hand").locator("button")).toHaveCount(5);
  await expectNoScroll(page);
  await shot(page, "g8-desk-private");
  await shot(companion, "g8b-desk-private-handy");

  // Begleit-Handy weg: die Karten liegen sofort wieder am Rechner – nichts bleibt hängen
  await companion.context().close();
  await expect(page.getByTestId("desk-hand").getByTestId("hand").locator("button")).toHaveCount(5, { timeout: 15_000 });
  await expect(page.getByTestId("desk-private")).toHaveCount(0);
});

/** Rechner (Anna, Host) und Handy (Ben) im selben Raum, Spiel gewählt und gestartet – „Am Rechner“ ist für das Spiel an */
async function deskGame(browser: Browser, gameId: string, pin: string): Promise<{ page: Page; phone: Page }> {
  const page = await desktop(browser);
  await page.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
  await page.goto("/");
  await page.evaluate((g) => localStorage.setItem("spieltisch:lastGame", g), gameId);
  await page.getByRole("button", { name: /Raum öffnen|Hier selbst mitspielen/ }).first().click();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill(pin);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await page.getByTestId("meet-play").click();
  await page.getByTestId(`pick-${gameId}`).click();
  const code = (await page.getByTestId("room-code").textContent())!.trim();
  const phone = await newPhone(browser);
  await phone.goto(`/r/${code}`);
  await phone.getByLabel("Dein Name").fill("Ben");
  await phone.getByLabel("PIN").fill(pin);
  await phone.getByRole("button", { name: "Beitreten" }).click();
  await expect(page.getByText("Ben", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("desk-stage")).toBeVisible();
  return { page, phone };
}

test("Am Rechner (Stapelbau): Vorrat, Ablagen und Hand unter dem Tisch, Aufbau als Ziele, Tastatur", async ({ browser, request }) => {
  await setConfig(request, { ...ALL_ON, modes: { stapelbau: { desk: "on" } } });
  try {
    const { page } = await deskGame(browser, "stapelbau", "7373");
    const area = page.getByTestId("desk-hand");
    await expect(area.getByTestId("hand").locator("button")).toHaveCount(5);
    await expect(area.getByRole("group", { name: "Auf Aufbaustapel legen" }).locator("button")).toHaveCount(4);
    await expectNoScroll(page);
    await expectNamedControls(page);
    await shot(page, "g8-desk-stapelbau");
    // Anna ist dran: Handkarte 1 wählen (Taste 1), mit Q auf Ablage 1 legen – Zug vorbei, Ben ist dran
    const status = area.getByTestId("status");
    await expect(status).not.toContainText("ist am Zug");
    await page.keyboard.press("1");
    await page.keyboard.press("q");
    await expect(status).toContainText("Ben ist am Zug");
    await expect(area.getByTestId("discard-0").getByRole("img")).toBeVisible();
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Am Rechner (Zehn Phasen): Hand unter dem Tisch, ziehen, markieren und ablegen per Tastatur", async ({ browser, request }) => {
  await setConfig(request, { ...ALL_ON, modes: { zehnphasen: { desk: "on" } } });
  try {
    const { page } = await deskGame(browser, "zehnphasen", "7474");
    const area = page.getByTestId("desk-hand");
    const hand = area.getByTestId("hand").locator("button");
    await expect(hand).toHaveCount(10);
    await expectNoScroll(page);
    await expectNamedControls(page);
    await shot(page, "g9-desk-zehnphasen");
    const status = area.getByTestId("status");
    await expect(status).not.toContainText("ist am Zug");
    // Z zieht vom Stapel, 1 markiert die erste Karte, X legt sie ab – Ben ist dran
    await page.keyboard.press("z");
    await expect(hand).toHaveCount(11);
    await page.keyboard.press("1");
    await page.keyboard.press("x");
    await expect(status).toContainText("Ben ist am Zug");
    await expect(hand).toHaveCount(10);
  } finally {
    await setConfig(request, ALL_ON);
  }
});
