import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
/** Vorschaubilder in voller Qualität (TABLE_HQ=1) zeichnen ohne Grafikchip langsam – dann länger warten */
const expect = process.env.TABLE_HQ ? baseExpect.configure({ timeout: 30_000 }) : baseExpect;
import { ALL_ON, closeSettings, FAKE_RTC, newPhone, openSettings, setConfig, shot } from "./util";

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  const page = await ctx.newPage();
  // Vorschaubilder in voller Qualität (langsam ohne Grafikchip): TABLE_HQ=1 npx playwright test table …
  if (process.env.TABLE_HQ) await page.addInitScript(() => localStorage.setItem("spieltisch:diceHQ", "1"));
  return page;
}

async function joinByLink(browser: Browser, code: string, pin: string, name: string): Promise<Page> {
  const phone = await newPhone(browser);
  await phone.goto(`/r/${code}#pin=${pin}`);
  // Die PIN kommt aus dem Link und verschwindet gleich wieder aus der Adresse
  await expect(phone.getByLabel("PIN")).toHaveValue(pin);
  await expect(phone).toHaveURL(new RegExp(`/r/${code}$`));
  await phone.getByLabel("Dein Name").fill(name);
  await phone.getByRole("button", { name: "Beitreten" }).click();
  return phone;
}

test("Großer Tisch: Bildschirm baut auf, Handys treten per QR-Link bei, Mau-Mau läuft am Tisch mit", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  await expect(screen.getByTestId("table-lobby")).toContainText(code);
  await expect(screen.getByTestId("table-lobby")).toContainText("Wer zuerst da ist, wählt das Spiel");

  const anna = await joinByLink(browser, code, pin, "Anna");
  const ben = await joinByLink(browser, code, pin, "Ben");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("table-lobby")).toContainText("Anna wählt das Spiel und startet");
  await shot(screen, "90-table-lobby");

  // Wer zuerst kam, ist Host: Spiel wählen und starten
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-lobby")).toBeHidden();
  await expect(screen.getByTestId("table-view")).toContainText("Mau-Mau");
  await expect(screen.getByTestId("table-seat").first()).toContainText(/· 5/);
  // Der Moderator (Leuchtkugel) begrüßt die Runde – reine Anzeige, abschaltbar
  await expect(screen.getByTestId("table-host")).toBeVisible();
  await expect(screen.getByTestId("table-host-line")).not.toBeEmpty();
  await shot(screen, "90b-table-moderator");

  // Wer dran ist, zieht am Handy – der Tisch zählt mit
  const turn = screen.locator('[data-testid="table-seat"][data-turn="true"]');
  await expect(turn).toHaveCount(1);
  const mover = (await turn.textContent())?.includes("Anna") ? anna : ben;
  await mover.getByRole("button", { name: /ziehen/i }).first().click();
  await expect(screen.getByTestId("table-seat").filter({ hasText: /· [67]/ })).toHaveCount(1);
  await shot(screen, "91-table-maumau");
  // Der Tisch zeigt keine fremden Karten – nur die Anzahl
  await expect(screen.getByTestId("hand")).toHaveCount(0);
  // Reaktion vom Handy schwebt über dem Platz am Tisch – Text-Nachrichten bleiben auf den Handys
  await ben.getByTestId("chat-button").click();
  await ben.getByLabel("Nachricht").fill("Nur für uns");
  await ben.getByRole("button", { name: "Senden" }).click();
  await ben.getByRole("button", { name: "Reaktion 👍" }).click();
  await expect(screen.getByTestId("table-react")).toHaveText("👍");
  await expect(screen.getByTestId("table-view")).not.toContainText("Nur für uns");
  await shot(screen, "91b-table-reaktion");
  await ben.keyboard.press("Escape");
  // Moderator ausschalten: Leuchtkugel weg, wieder an: da
  await screen.getByTestId("host-toggle").click();
  await expect(screen.getByTestId("table-host")).toHaveCount(0);
  await screen.getByTestId("host-toggle").click();
  await expect(screen.getByTestId("table-host")).toBeVisible();
});

test("Großer Tisch: falsche PIN wird abgelehnt, die richtige verbindet", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;

  const other = await newScreen(browser);
  await other.goto("/tisch");
  await other.getByLabel("Raumcode").fill(code);
  await other.getByLabel("PIN").fill(pin === "111111" ? "222222" : "111111");
  await other.getByTestId("table-connect").click();
  await expect(other.getByRole("alert")).toContainText("PIN");
  await other.getByLabel("PIN des Raums").fill(pin);
  await other.getByRole("button", { name: "Verbinden" }).click();
  await expect(other.getByTestId("table-lobby")).toContainText(code);
});

test("Großer Tisch ohne 3D: einfacher flacher Tisch mit Karten, Plätzen und Ablage – Partie läuft weiter", async ({ browser }) => {
  const screen = await newScreen(browser);
  // Grafik „Ohne 3D“ (wie im Profil gewählt)
  await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  await expect(screen.getByTestId("table-flat")).toBeAttached();
  await expect(screen.getByTestId("table-3d")).toHaveCount(0);
  const anna = await joinByLink(browser, code, pin, "Anna");
  await joinByLink(browser, code, pin, "Ben");
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-eins").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-view")).toContainText("Eins!");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("table-seat").first()).toContainText(/· \d/);
  await screen.waitForTimeout(600);
  await shot(screen, "93-table-flach");
});

test("Ton am Tisch: Musik läuft, Regler für Effekte, Musik und Publikum, ausschaltbar – ohne Fehler", async ({ browser }) => {
  test.setTimeout(120_000);
  const screen = await newScreen(browser);
  const errors: string[] = [];
  screen.on("pageerror", (e) => errors.push(e.message));
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen.getByTestId("table-lobby")).toBeVisible();
  // Der Klick auf „Tisch aufbauen“ hat den Ton freigeschaltet
  await expect(screen.getByTestId("sound-panel")).toBeVisible();
  await screen.getByTestId("sound-more").click();
  const music = screen.getByRole("slider", { name: "Musik" });
  await music.fill("0");
  await screen.getByRole("slider", { name: "Publikum" }).fill("80");
  await shot(screen, "94-table-ton");
  const prefs = await screen.evaluate(() => JSON.parse(localStorage.getItem("spieltisch:prefs") ?? "{}"));
  expect(prefs.volMusic).toBe(0);
  expect(prefs.volCrowd).toBe(0.8);
  await screen.getByTestId("sound-toggle").click();
  await expect(screen.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(screen.getByRole("slider", { name: "Musik" })).toHaveCount(0);

  // Neu geladen (ohne Klick): Ton wieder an → „Ton einschalten“, bis jemand klickt
  await screen.getByTestId("sound-toggle").click();
  await screen.reload();
  // Nach dem Neuladen baut sich der Tisch erst auf (ohne Grafikchip dauert das)
  await expect(screen.getByTestId("sound-panel")).toBeAttached({ timeout: 20_000 });
  // Gesperrter Ton: „Ton einschalten“ unten links ist am Fernseher der einzige Knopf
  if (await screen.getByTestId("sound-unlock").isVisible()) {
    // kann schon weg sein, wenn der Ton inzwischen läuft
    await screen.getByTestId("sound-unlock").click({ timeout: 3000 }).catch(() => undefined);
    await expect(screen.getByTestId("sound-unlock")).toHaveCount(0);
  }
  await screen.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test("Ohne Handy mitspielen: der Fernseher nimmt Opa auf, zeigt seine Hand nur hinter dem Sichtschutz, Opa zieht am Fernseher", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  const anna = await joinByLink(browser, code, pin, "Anna");
  await expect(screen.getByTestId("table-seat")).toHaveCount(1);

  await screen.getByTestId("couch-add").click();
  await screen.getByLabel("Name für den Platz am Fernseher").fill("Opa");
  await screen.keyboard.press("Enter");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("couch-list")).toContainText("Opa");
  await expect(anna.getByText("Opa")).toBeVisible();
  await shot(screen, "95-couch-lobby");

  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-lobby")).toBeHidden();

  // Ist Anna zuerst dran, zieht sie – dann ist Opa dran
  const turn = screen.locator('[data-testid="table-seat"][data-turn="true"]');
  await expect(turn).toHaveCount(1);
  if ((await turn.textContent())?.includes("Anna")) {
    await anna.getByRole("button", { name: /ziehen/i }).first().click();
    // Gezogene Karte passt nicht oder soll nicht gelegt werden: weiter
    const pass = anna.getByRole("button", { name: /passen|behalten|weiter/i }).first();
    await pass.click({ timeout: 3000 }).catch(() => undefined);
  }
  // Opas Hand öffnet sich verdeckt; erst nach „Karten zeigen“ sind Karten zu sehen
  await expect(screen.getByTestId("couch-hand")).toBeVisible();
  await expect(screen.getByTestId("couch-reveal")).toBeVisible();
  await expect(screen.getByTestId("hand")).toHaveCount(0);
  await shot(screen, "96-couch-verdeckt");
  await screen.keyboard.press("Enter");
  await expect(screen.getByTestId("couch-hand").getByTestId("hand")).toBeVisible();
  await shot(screen, "97-couch-hand");
  await screen.getByTestId("couch-hand").getByRole("button", { name: /ziehen/i }).first().click();
  await expect(screen.getByTestId("table-seat").filter({ hasText: "Opa" })).toContainText(/· [67]/);
  // Verdecken schließt die Hand
  await screen.getByTestId("couch-close").click();
  await expect(screen.getByTestId("couch-hand")).toHaveCount(0);
});

test("Fernbedienung: Pfeiltasten am Fernseher, Handy des Hosts schaltet Ton und Lautstärke am Tisch", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  // Pfeiltasten: von „Tisch aufbauen“ nach rechts ins Formular (das gesperrte „Verbinden“ wird übersprungen)
  await screen.getByTestId("table-new").focus();
  await screen.keyboard.press("ArrowRight");
  await expect(screen.getByLabel("PIN")).toBeFocused();
  // Im Eingabefeld gehören die Pfeiltasten dem Feld
  await screen.keyboard.press("ArrowLeft");
  await expect(screen.getByLabel("PIN")).toBeFocused();
  // Von „Zur Startseite“ (unten) nach oben zu „Tisch aufbauen“ und mit Enter auslösen
  await screen.getByRole("button", { name: "Zur Startseite" }).focus();
  await screen.keyboard.press("ArrowUp");
  await expect(screen.getByTestId("table-new")).toBeFocused();
  await screen.keyboard.press("Enter");
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  await expect(screen.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "true");

  const anna = await joinByLink(browser, code, pin, "Anna");
  await anna.getByRole("button", { name: "Menü" }).click();
  await anna.getByTestId("big-table").click();
  await expect(anna.getByTestId("remote")).toBeVisible();
  await shot(anna, "98-fernbedienung");
  await anna.getByTestId("remote-sound").click();
  await expect(screen.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(screen.getByText("Anna: Ton aus")).toBeVisible();
  await anna.getByTestId("remote-louder").click();
  await expect(screen.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "true");
  const vol = await screen.evaluate(() => JSON.parse(localStorage.getItem("spieltisch:prefs") ?? "{}").volMusic);
  expect(vol).toBeCloseTo(0.55, 2);
  // Moderator und Charakter vom Handy aus – am Fernseher selbst gibt es dafür keine Knöpfe
  await anna.getByTestId("remote-host").click();
  await expect(screen.getByText("Anna: Moderator aus")).toBeVisible();
  await expect(screen.getByTestId("table-host")).toHaveCount(0);
  await anna.getByTestId("remote-host").click();
  await expect(screen.getByTestId("table-host")).toBeVisible();
  await anna.getByTestId("remote-mood").click();
  await expect(screen.getByText("Anna: Moderator Frech")).toBeVisible();
});

test("Fernseher ohne Knöpfe: nur Tisch und QR-Code, das Menü erscheint erst bei Maus oder Taste", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  const anna = await joinByLink(browser, code, pin, "Anna");
  await joinByLink(browser, code, pin, "Ben");
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-lobby")).toBeHidden();
  // Ruhe: Menü ausgeblendet, QR-Code zum Nachkommen oben rechts
  await expect(screen.getByTestId("tv-menu")).toHaveAttribute("data-shown", "false", { timeout: 10_000 });
  await expect(screen.getByLabel("QR-Code zum Mitspielen")).toBeVisible();
  await shot(screen, "91c-tisch-ohne-knoepfe");
  // Maus bewegt: Menü gleitet herein
  await screen.mouse.move(300, 300);
  await screen.mouse.move(320, 310);
  await expect(screen.getByTestId("tv-menu")).toHaveAttribute("data-shown", "true");
  await screen.waitForTimeout(300);
  await shot(screen, "91d-tisch-menue");
});

test("Foto statt Tier: Anna nimmt ein Foto auf, Ben und der Fernseher sehen es, Entfernen bringt das Tier zurück", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  const anna = await joinByLink(browser, code, pin, "Anna");
  const ben = await joinByLink(browser, code, pin, "Ben");

  // Ein Bild (Farbverlauf) im Browser erzeugen und als Datei wählen – das Handy verkleinert es vor dem Hochladen
  const png = await anna.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const g = c.getContext("2d")!; const grd = g.createLinearGradient(0, 0, 800, 600);
    grd.addColorStop(0, "#ff7a59"); grd.addColorStop(1, "#3e9a92"); g.fillStyle = grd; g.fillRect(0, 0, 800, 600);
    g.fillStyle = "#fff"; g.beginPath(); g.arc(400, 300, 150, 0, Math.PI * 2); g.fill();
    const b = await new Promise<Blob>((ok) => c.toBlob((x) => ok(x!), "image/png"));
    return [...new Uint8Array(await b.arrayBuffer())];
  });
  // Im Treffpunkt: Kamera-Knopf auf der eigenen Kachel
  await anna.getByLabel("Foto statt Tier").setInputFiles({ name: "selfie.png", mimeType: "image/png", buffer: Buffer.from(png) });
  // Ben sieht Annas Foto
  const img = ben.locator("img[src^='/api/photo/']").first();
  await expect(img).toBeVisible();
  const src = (await img.getAttribute("src"))!;
  const res = await ben.request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/jpeg");
  expect((await res.body()).length).toBeLessThan(120_000);
  // Der Fernseher auch (am Platz)
  await expect(screen.locator(`[data-testid="table-seat"] img[src="${src}"]`)).toBeVisible();
  await shot(anna, "99-foto");
  await shot(screen, "99-foto-tisch");

  // In der Spiel-Lobby: über den eigenen Avatar
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  await anna.getByRole("button", { name: "Avatar von Anna ändern" }).click();
  await expect(anna.getByTestId("photo-row")).toBeVisible();
  // Kein Bild: freundliche Meldung, nichts hochgeladen
  await anna.getByTestId("photo-input").setInputFiles({ name: "notiz.txt", mimeType: "text/plain", buffer: Buffer.from("hallo") });
  await expect(anna.getByText("Das ist kein Bild.")).toBeVisible();

  // Entfernen: Tier wieder da, Datei weg
  await anna.waitForTimeout(3100);
  await anna.getByRole("button", { name: "Foto entfernen" }).click();
  await expect(ben.locator("img[src^='/api/photo/']")).toHaveCount(0);
  await expect.poll(async () => (await ben.request.get(src)).status()).toBe(404);
  // Unbekannte oder krumme Namen gibt es nicht
  expect((await ben.request.get("/api/photo/r/../../wrangler.jsonc")).status()).toBe(404);
});

test("Bausteine am Tisch: Fünf Würfel-Würfel und Brett von Vier in einer Reihe erscheinen auf dem Filz", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { fuenfwuerfel: { table: "on" }, vier: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");

    // Fünf Würfel: wer dran ist, würfelt – fünf Würfel auf dem Filz, Punkte an den Plätzen
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-fuenfwuerfel").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-dice")).toBeVisible();
    const turn = screen.locator('[data-testid="table-seat"][data-turn="true"]');
    const mover = (await turn.textContent())?.includes("Anna") ? anna : ben;
    await mover.getByRole("button", { name: /Würfeln/ }).click();
    await expect(screen.getByTestId("table-dice").getByRole("img")).toHaveCount(5);
    await expect(screen.getByTestId("table-dice")).toContainText(/noch 2 Würfe/);
    await expect(screen.getByTestId("table-seat").first()).toContainText("0 Pkt.");
    await screen.waitForTimeout(600);
    await shot(screen, "9a-tisch-fuenfwuerfel");

    // Vier in einer Reihe: zurück in die Lobby, Spiel wechseln
    await anna.getByRole("button", { name: "Menü" }).click();
    await anna.getByRole("button", { name: "Spiel wechseln" }).click();
    await anna.getByRole("button", { name: "Spiel wählen" }).click();
    await anna.getByTestId("pick-vier").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-grid")).toBeVisible();
    const t2 = screen.locator('[data-testid="table-seat"][data-turn="true"]');
    const first = (await t2.textContent())?.includes("Anna") ? anna : ben;
    await first.getByRole("button", { name: "Spalte 4", exact: true }).click();
    await expect(screen.getByTestId("table-grid").locator("circle[fill='#d0453b']")).toHaveCount(1);
    await expect(screen.getByTestId("table-seat").filter({ hasText: "Rot" })).toHaveCount(1);
    await shot(screen, "9b-tisch-vier");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Partyabend: Host plant zwei Spiele, nach der Partie ist das nächste dran, der Fernseher zeigt den Zwischenstand", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { vier: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");

    // Plan: erst Vier in einer Reihe, dann Mau-Mau
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-vier").click();
    await anna.getByTestId("plan-open").click();
    await anna.getByTestId("plan-vier").click();
    await anna.getByTestId("plan-maumau").click();
    await shot(anna, "92-partyabend-planen");
    await anna.getByTestId("plan-start").click();
    await expect(screen.getByTestId("table-plan")).toContainText("Vier in einer Reihe → Mau-Mau");
    await expect(anna.getByText("Partyabend · Spiel 1 von 2")).toBeVisible();
    await shot(anna, "92b-partyabend-lobby");

    // Vier in einer Reihe: wer anfängt, spielt Spalte 1 und gewinnt senkrecht
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-grid")).toBeVisible();
    const turn = screen.locator('[data-testid="table-seat"][data-turn="true"]');
    const firstIsAnna = (await turn.textContent())?.includes("Anna");
    const [p1, p2] = firstIsAnna ? [anna, ben] : [ben, anna];
    for (let i = 0; i < 4; i++) {
      await p1.getByRole("button", { name: "Spalte 1", exact: true }).click();
      if (i < 3) {
        await expect(screen.getByTestId("table-grid").locator("circle[fill='#d0453b']")).toHaveCount(i + 1);
        await p2.getByRole("button", { name: "Spalte 2", exact: true }).click();
        await expect(turn).toContainText(firstIsAnna ? "Anna" : "Ben");
      }
    }
    await anna.getByRole("button", { name: "Zur Lobby" }).click();

    // Fernseher: Zwischenstand, Mau-Mau ist als Nächstes gewählt
    const board = screen.getByTestId("party-board");
    await expect(board).toBeVisible();
    await expect(board).toContainText("Mau-Mau");
    await expect(board).toContainText(firstIsAnna ? "Anna" : "Ben");
    await expect(anna.getByText("Partyabend · Spiel 2 von 2")).toBeVisible();
    await shot(screen, "92c-partyabend-tisch");

    // Beenden: Plan weg, Tafel weg
    await anna.getByText("Partyabend · Spiel 2 von 2").click();
    await anna.getByTestId("plan-end").click();
    await expect(board).toHaveCount(0);
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Video am Tisch: Kamera-Bild an Annas Platz (einzeln und ganz abschaltbar), Couch-Kamera bei Ben, Selfie für Opa ohne Handy", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await ctx.addInitScript(FAKE_RTC);
  const screen = await ctx.newPage();
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  const join = async (name: string) => {
    const phone = await newPhone(browser);
    await phone.context().addInitScript(FAKE_RTC);
    await phone.goto(`/r/${code}#pin=${pin}`);
    await phone.getByLabel("Dein Name").fill(name);
    await phone.getByRole("button", { name: "Beitreten" }).click();
    return phone;
  };
  const anna = await join("Anna");
  const ben = await join("Ben");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);

  // Anna kommt mit Video in den Chat: ihr Bild erscheint an ihrem Platz
  // Treffpunkt: Kamera an
  await anna.getByRole("button", { name: "Video an" }).click();
  const annaSeat = screen.getByTestId("table-seat").filter({ hasText: "Anna" });
  await expect(annaSeat.getByTestId("seat-video")).toBeAttached();
  await shot(screen, "93-tisch-video");
  // einzeln aus- und wieder einblenden
  await annaSeat.getByTestId("seat-video-toggle").click();
  await expect(annaSeat.getByTestId("seat-video")).toHaveCount(0);
  await expect(annaSeat).toContainText("Video aus");
  await annaSeat.getByTestId("seat-video-toggle").click();
  await expect(annaSeat.getByTestId("seat-video")).toBeAttached();
  // alle Videos aus
  await screen.getByTestId("table-video-toggle").click();
  await expect(screen.getByTestId("seat-video")).toHaveCount(0);
  await screen.getByTestId("table-video-toggle").click();
  await expect(annaSeat.getByTestId("seat-video")).toBeAttached();

  // Couch-Kamera: Ben (im Chat) sieht die Kachel „Couch“
  await ben.getByRole("button", { name: "Nur Sprache" }).click();
  await screen.getByTestId("couch-cam").click();
  await expect(screen.getByTestId("couch-cam")).toContainText("Kamera aus");
  await expect(ben.getByTestId("meet").getByText("Couch", { exact: true })).toBeVisible();
  await shot(ben, "93d-handy-couch");
  await screen.getByTestId("couch-cam").click();
  await expect(ben.getByTestId("meet").getByText("Couch", { exact: true })).toHaveCount(0);

  // Opa ohne Handy: Foto mit der Kamera am Bildschirm
  await screen.getByTestId("couch-add").click();
  await screen.getByLabel("Name für den Platz am Fernseher").fill("Opa");
  await screen.getByTestId("couch-add-ok").click();
  await expect(screen.getByTestId("table-seat")).toHaveCount(3);
  await screen.getByTestId("couch-photo").click();
  await expect(screen.getByTestId("table-camera-video")).toBeVisible();
  await shot(screen, "93b-tisch-selfie");
  await screen.getByTestId("table-camera-shoot").click();
  await expect(screen.getByTestId("table-camera-count")).toHaveText("3");
  await expect(screen.getByTestId("table-camera")).toHaveCount(0, { timeout: 10_000 });
  await expect(screen.getByTestId("table-seat").filter({ hasText: "Opa" }).locator("img")).toBeVisible({ timeout: 10_000 });
  await shot(screen, "93c-tisch-opa-foto");
});

test("Bühne: Showstudio mit Leinwand und Pulten – Lobby auf der Leinwand, dann Mau-Mau, Spotlicht auf dem, der dran ist", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { maumau: { stage: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-maumau").click();

    await screen.getByTestId("view-stage").click();
    await expect(screen.getByTestId("studio-3d")).toBeAttached();
    await expect(screen.getByTestId("studio-screen").getByTestId("table-lobby")).toBeVisible();
    await expect(screen.getByTestId("table-seat")).toHaveCount(2);
    await screen.waitForTimeout(800);
    await shot(screen, "94-buehne-lobby");

    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("studio-screen").getByTestId("table-flat")).toBeAttached();
    await expect(screen.locator('[data-testid="table-seat"][data-turn="true"]')).toHaveCount(1);
    await expect(screen.getByTestId("table-seat").first()).toContainText(/· 5/);
    await screen.waitForTimeout(1500);
    await shot(screen, "94b-buehne-maumau");

    // zurück zum Tisch – gemerkt je Gerät
    await screen.getByTestId("view-table").click();
    await expect(screen.getByTestId("studio")).toHaveCount(0);
    await expect(screen.getByTestId("table-3d")).toBeAttached();
    void ben;
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Bühne bei Schamlos: schwarze Karte groß auf der Leinwand, Antworten eingesetzt, Punkt hervorgehoben", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { schamlos: { stage: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const all = [await joinByLink(browser, code, pin, "Anna"), await joinByLink(browser, code, pin, "Ben"), await joinByLink(browser, code, pin, "Cem")];
    await all[0].getByTestId("meet-play").click();
    await all[0].getByTestId("pick-schamlos").click();
    await screen.getByTestId("view-stage").click();
    await all[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("studio-prompt")).toBeVisible();

    let czar = all[0];
    for (const p of all) if ((await p.getByTestId("schamlos-czar").textContent())?.includes("Du bist Zar")) czar = p;
    for (const p of all.filter((x) => x !== czar)) {
      const button = p.getByRole("button", { name: /^Wähle|legen$/ });
      const need = /2 Karten/.test((await button.textContent()) ?? "") ? 2 : 1;
      for (let i = 0; i < need; i++) await p.getByTestId("hand").getByRole("button").nth(i).click();
      await p.getByRole("button", { name: /legen$/ }).click();
    }
    await expect(screen.getByTestId("studio-answer")).toHaveCount(2);
    await screen.waitForTimeout(800);
    await shot(screen, "95-buehne-schamlos");
    await czar.getByTestId("schamlos-subs").getByRole("button").first().click();
    await expect(screen.getByTestId("studio-words")).toContainText("Punkt für");
    await screen.waitForTimeout(500);
    await shot(screen, "95b-buehne-schamlos-punkt");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Stapelbau und Himmelskarten am Tisch: Stapel in der Mitte, offene Auslage an jedem Platz", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { stapelbau: { table: "on" }, himmelskarten: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    await joinByLink(browser, code, pin, "Ben");

    // Stapelbau: vier Aufbaustapel und der Nachziehstapel, an jedem Platz Vorrat + vier Ablagen
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-stapelbau").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-pile")).toHaveCount(5);
    await expect(screen.getByTestId("seat-board")).toHaveCount(2);
    await expect(screen.getByTestId("seat-board").first().locator("span")).toHaveCount(5);
    await screen.waitForTimeout(500);
    await shot(screen, "9c-tisch-stapelbau");

    // Himmelskarten: Ziehen und Ablage in der Mitte, 12 Karten je Platz – anfangs verdeckt
    await anna.getByRole("button", { name: "Menü" }).click();
    await anna.getByRole("button", { name: "Spiel wechseln" }).click();
    await anna.getByRole("button", { name: "Spiel wählen" }).click();
    await anna.getByTestId("pick-himmelskarten").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-pile")).toHaveCount(2);
    await expect(screen.getByTestId("seat-board").first().locator("span")).toHaveCount(12);
    await expect(screen.getByTestId("seat-board").first()).toContainText("?");
    await screen.waitForTimeout(500);
    await shot(screen, "9d-tisch-himmelskarten");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Zehn Phasen und Glückssieben am Tisch: Stapel in der Mitte, Phase bzw. offene Reihe an jedem Platz", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { zehnphasen: { table: "on" }, glueckssieben: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones = [await joinByLink(browser, code, pin, "Anna"), await joinByLink(browser, code, pin, "Ben"), await joinByLink(browser, code, pin, "Cem")];
    const anna = phones[0];

    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-zehnphasen").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-pile")).toHaveCount(2);
    await expect(screen.getByTestId("table-seat").first()).toContainText("Phase 1");
    await screen.waitForTimeout(500);
    await shot(screen, "9e-tisch-zehnphasen");

    await anna.getByRole("button", { name: "Menü" }).click();
    await anna.getByRole("button", { name: "Spiel wechseln" }).click();
    await anna.getByRole("button", { name: "Spiel wählen" }).click();
    await anna.getByTestId("pick-glueckssieben").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-pile").first()).toContainText("Ziehen");
    // wer dran ist, zieht eine Karte – sie liegt offen an seinem Platz
    for (let i = 0; i < 15 && !(await screen.getByTestId("seat-board").count()); i++) {
      for (const p of phones) {
        const hit = p.getByRole("button", { name: "Noch eine!", exact: true });
        // Knopf kann zwischen Prüfen und Tippen gesperrt werden (Zug vorbei) – nicht ewig warten
        if (await hit.isEnabled().catch(() => false)) { await hit.click({ timeout: 3000 }).catch(() => {}); break; }
      }
      await screen.waitForTimeout(600);
    }
    await expect(screen.getByTestId("seat-board").first()).toBeAttached();
    await screen.waitForTimeout(500);
    await shot(screen, "9f-tisch-glueckssieben");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Decknamen am Tisch: 25 Wörter in der Mitte, Hinweis darüber, aufgedeckte farbig – keine Schlüsselkarte", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { decknamen: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const names = ["Anna", "Ben", "Cem", "Dora"];
    const phones = [];
    for (const n of names) phones.push(await joinByLink(browser, code, pin, n));
    const [anna, ben, cem, dora] = phones;
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-decknamen").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    const pick = async (p: Page, name: string, team: string, chief: boolean) => {
      await p.getByRole("button", { name: `${name}: Team ${team}` }).click();
      if (chief) await p.getByRole("button", { name: `${name}: Chef` }).click();
    };
    await pick(anna, "Anna", "Rot", true);
    await pick(ben, "Ben", "Rot", false);
    await pick(cem, "Cem", "Blau", true);
    await pick(dora, "Dora", "Blau", false);
    await anna.getByRole("button", { name: "Los geht's" }).click();
    await expect(screen.getByTestId("table-word")).toHaveCount(25);
    // der Tisch kennt die Farben nicht: nichts ist aufgedeckt
    await expect(screen.locator('[data-testid="table-word"][data-open="true"]')).toHaveCount(0);
    await expect(screen.getByTestId("table-words")).toContainText("der Chef überlegt");

    const redStarts = (await anna.getByTestId("score-rot").textContent())!.includes("▶");
    const [chief, agent] = redStarts ? [anna, ben] : [cem, dora];
    await chief.getByLabel("Hinweiswort").fill("Tier");
    await chief.getByRole("button", { name: "Geben" }).click();
    await expect(screen.getByTestId("table-words")).toContainText("Hinweis: TIER 1");
    await agent.getByRole("group", { name: "Wörter" }).getByRole("button").first().click();
    await expect(screen.locator('[data-testid="table-word"][data-open="true"]')).toHaveCount(1);
    await screen.waitForTimeout(500);
    await shot(screen, "9g-tisch-decknamen");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Decknamen am Tisch mit eigenen Bildkarten: das Bild liegt auf dem Tisch statt eines Platzhalters", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { decknamen: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones = [];
    for (const n of ["Anna", "Ben", "Cem", "Dora"]) phones.push(await joinByLink(browser, code, pin, n));
    const anna = phones[0];
    // Annas Set: 24 Wörter und ein Bild (hochgeladen wie im Editor)
    const me = await anna.evaluate(() => JSON.parse(localStorage.getItem("spieltisch:profile") ?? "{}") as { id: string; key: string });
    const headers = { "x-profile": me.id, "x-profile-key": me.key };
    const up = await anna.request.post("/api/sets/image", { headers, data: (await import("node:fs")).readFileSync("tests/fixtures/bildkarte.png") });
    const { value } = await up.json() as { value: string };
    const words = [...Array.from({ length: 24 }, (_, i) => `Wort${i + 1}`), value];
    baseExpect((await anna.request.put("/api/sets/tischbildset", { headers, data: { kind: "decknamen", name: "Tischbilder", data: { words } } })).ok()).toBe(true);
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-decknamen").click();
    await openSettings(anna);
    await anna.getByTestId("set-pick").click();
    await anna.getByRole("checkbox", { name: "Tischbilder" }).click();
    await anna.getByTestId("set-pick-done").click();
    await anna.getByRole("checkbox", { name: /Nur eigene Wörter/ }).click();
    await closeSettings(anna);
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    for (const [i, p] of phones.entries()) await p.getByRole("button", { name: `${["Anna", "Ben", "Cem", "Dora"][i]}: Team ${i < 2 ? "Rot" : "Blau"}` }).click();
    await anna.getByRole("button", { name: "Anna: Chef" }).click();
    await phones[2].getByRole("button", { name: "Cem: Chef" }).click();
    await anna.getByRole("button", { name: "Los geht's" }).click();
    await expect(screen.getByTestId("table-word")).toHaveCount(25);
    await expect(screen.getByTestId("table-words").getByRole("img", { name: "Bildkarte" })).toHaveCount(1);
    await screen.waitForTimeout(1500);
    await shot(screen, "9g-tisch-decknamen-bild");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Alles oder nichts und Mäxchen am Tisch: Karte hinter den Würfeln, Becher mit Ansage, beim Aufdecken liegen die Würfel offen", async ({ browser, request }) => {
  test.setTimeout(150_000);
  await setConfig(request, { ...ALL_ON, modes: { alles: { table: "on" }, maexchen: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");
    const phones = [anna, ben];

    // Alles oder nichts mit App-Würfeln: wer dran ist, würfelt – Karte und Stapel hinten, Würfel davor
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-alles").click();
    await openSettings(anna);
    await anna.getByRole("radio", { name: /App-Würfel/ }).click();
    await closeSettings(anna);
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-dice")).toBeAttached();
    await expect(screen.getByTestId("table-pile").first()).toContainText("Karten");
    for (let i = 0; i < 20 && !(await screen.getByTestId("table-dice").getByRole("img").count()); i++) {
      for (const p of phones) {
        const roll = p.getByRole("button", { name: /Würfeln/ });
        if (await roll.isVisible().catch(() => false)) { await roll.click(); break; }
        const on = p.getByRole("button", { name: /Weiter|eintragen|ächster Spieler/ });
        if (await on.first().isVisible().catch(() => false)) { await on.first().click(); break; }
      }
      await screen.waitForTimeout(500);
    }
    await expect(screen.getByTestId("table-dice").getByRole("img").first()).toBeAttached();
    await expect(screen.getByTestId("table-seat").first()).toContainText("Pkt.");
    await screen.waitForTimeout(900);
    await shot(screen, "9h-tisch-alles");

    // Mäxchen: Becher in der Mitte, Ansage groß – der Tisch sieht den Wurf nicht
    await anna.getByRole("button", { name: "Menü" }).click();
    await anna.getByRole("button", { name: "Spiel wechseln" }).click();
    await anna.getByRole("button", { name: "Spiel wählen" }).click();
    await anna.getByTestId("pick-maexchen").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-dice")).toContainText("würfelt");
    const t = screen.locator('[data-testid="table-seat"][data-turn="true"]');
    const [first, second] = (await t.textContent())?.includes("Anna") ? [anna, ben] : [ben, anna];
    await first.getByRole("button", { name: "Würfeln" }).click();
    await first.getByRole("button", { name: /Becher anheben/ }).click();
    await first.getByRole("radio", { name: "Sechserpasch" }).click();
    await first.getByTestId("announce").click();
    await expect(screen.getByTestId("table-dice")).toContainText("sagt: Sechserpasch");
    await expect(screen.getByTestId("table-cup")).toBeAttached();
    await expect(screen.getByTestId("table-dice").getByRole("img", { name: /Würfel/ })).toHaveCount(0);
    await screen.waitForTimeout(700);
    await shot(screen, "9i-tisch-maexchen-becher");
    await second.getByTestId("reveal-btn").click();
    await expect(screen.getByTestId("table-dice")).toContainText(/stimmt|gelogen/);
    await expect(screen.getByTestId("table-dice").getByRole("img", { name: /Würfel/ })).toHaveCount(2);
    await screen.waitForTimeout(500);
    await shot(screen, "9j-tisch-maexchen-offen");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Dame, Mühle und Ludo am Tisch: Brett in der Mitte, Steine und Figuren darauf, Würfel daneben", async ({ browser, request }) => {
  test.setTimeout(180_000);
  await setConfig(request, { ...ALL_ON, modes: { dame: { table: "on" }, muehle: { table: "on" }, ludo: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");
    const mover = async () => ((await screen.locator('[data-testid="table-seat"][data-turn="true"]').textContent())?.includes("Anna") ? anna : ben);
    const pick = async (id: string, first = false) => {
      if (!first) {
        await anna.getByRole("button", { name: "Menü" }).click();
        await anna.getByRole("button", { name: "Spiel wechseln" }).click();
        await anna.getByRole("button", { name: "Spiel wählen" }).click();
      } else await anna.getByTestId("meet-play").click();
      await anna.getByTestId(`pick-${id}`).click();
      await anna.getByRole("button", { name: "Spiel starten" }).click();
      await expect(screen.getByTestId("table-board")).toBeAttached();
    };

    // Dame: 24 Steine, ein Zug
    await pick("dame", true);
    await expect(screen.getByTestId("table-piece")).toHaveCount(24);
    const d = await mover();
    await d.getByRole("button", { name: /^Feld c3( |$)/ }).click();
    await d.getByRole("button", { name: /^Feld d4( |$)/ }).click();
    await expect(screen.getByTestId("table-news")).toContainText("d4");
    await screen.waitForTimeout(800);
    await shot(screen, "9k-tisch-dame");

    // Mühle: noch keine Steine auf dem Brett, 18 daneben – nach dem Setzen einer weniger daneben, einer drauf
    await pick("muehle");
    await expect(screen.getByTestId("table-piece")).toHaveCount(18);
    const m1 = await mover();
    await m1.getByRole("button", { name: /^Punkt d6( |$)/ }).click();
    await expect(screen.getByTestId("table-seat").filter({ hasText: "8 zu setzen" })).toHaveCount(1);
    const m2 = await mover();
    await m2.getByRole("button", { name: /^Punkt f4( |$)/ }).click();
    await screen.waitForTimeout(800);
    await shot(screen, "9l-tisch-muehle");

    // Ludo: Figuren auf dem Brett, gewürfelt wird am Handy – der Würfel liegt neben dem Brett
    await pick("ludo");
    await expect(screen.getByTestId("table-piece")).toHaveCount(8);
    for (let i = 0; i < 3; i++) {
      const p = await mover();
      const roll = p.getByRole("button", { name: "Würfeln" });
      await expect(roll).toBeEnabled();
      await roll.click();
      await p.waitForTimeout(200);
      const glow = p.locator("[data-glow]");
      if (await glow.count()) await glow.first().click();
      await screen.waitForTimeout(900);
    }
    await shot(screen, "9m-tisch-ludo");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Fischen und Hellseher am Tisch: Teich und Quartette bzw. Trumpf und Stich in der Mitte, Ansagen am Platz", async ({ browser, request }) => {
  test.setTimeout(180_000);
  await setConfig(request, { ...ALL_ON, modes: { fischen: { table: "on" }, hellseher: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");
    const cem = await joinByLink(browser, code, pin, "Cem");
    const phones = [anna, ben, cem];

    // Fischen: wer dran ist, fragt – die Frage steht oben, der Teich liegt in der Mitte
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-fischen").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-pile").first()).toContainText("Teich");
    for (const p of phones) {
      const who = p.getByRole("group", { name: "Mitspieler" }).locator("button:not([disabled])");
      if (await who.count()) {
        await who.first().click();
        await p.getByRole("group", { name: "Wert" }).getByRole("button").first().click();
        await p.getByRole("button", { name: /hast du/ }).click();
        break;
      }
    }
    await expect(screen.getByTestId("table-news")).toContainText("fragt");
    await screen.waitForTimeout(800);
    await shot(screen, "9n-tisch-fischen");

    // Hellseher: Trumpf und Stich in der Mitte, jede Karte mit Namen
    await anna.getByRole("button", { name: "Menü" }).click();
    await anna.getByRole("button", { name: "Spiel wechseln" }).click();
    await anna.getByRole("button", { name: "Spiel wählen" }).click();
    await anna.getByTestId("pick-hellseher").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    for (let i = 0; i < 40 && (await screen.getByTestId("table-pile").count()) < 4; i++) {
      for (const p of phones) {
        const trump = p.getByRole("group", { name: "Trumpf wählen" });
        if (await trump.isVisible().catch(() => false)) { await trump.getByRole("button").first().click(); break; }
        const bids = p.getByRole("group", { name: "Ansage" }).locator("button:not([disabled])");
        if (await bids.count()) { await bids.first().click(); break; }
        const cards = p.getByTestId("hand").locator("button:not([disabled])");
        if (await cards.count()) { await cards.first().click(); break; }
      }
      await screen.waitForTimeout(400);
    }
    await expect(screen.getByTestId("table-seat").first()).toContainText("Ansage");
    await screen.waitForTimeout(800);
    await shot(screen, "9o-tisch-hellseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Werwolf, Eine Nacht und Spion am Tisch: Aufsteller mit Phase, Nachtlicht, Uhr, verdeckte Karten an den Plätzen", async ({ browser, request }) => {
  test.setTimeout(240_000);
  await setConfig(request, { ...ALL_ON, modes: { werwolf: { table: "on" }, einenacht: { table: "on" }, spion: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const n of ["Anna", "Ben", "Cem", "Dora", "Emil"]) phones.push(await joinByLink(browser, code, pin, n));
    const [anna] = phones;
    const pick = async (id: string, first = false) => {
      if (!first) {
        await anna.getByRole("button", { name: "Menü" }).click();
        await anna.getByRole("button", { name: "Spiel wechseln" }).click();
        await anna.getByRole("button", { name: "Spiel wählen" }).click();
      } else await anna.getByTestId("meet-play").click();
      await anna.getByTestId(`pick-${id}`).click();
      await anna.getByRole("button", { name: "Spiel starten" }).click();
    };

    // Werwolf: Karten ansehen, dann Nacht – Licht gedimmt, jede Karte liegt verdeckt am Platz
    await pick("werwolf", true);
    await expect(screen.getByTestId("table-sign")).toContainText("Schaut eure Karte an");
    await expect(screen.getByTestId("seat-board")).toHaveCount(5);
    for (const p of phones) {
      const card = p.getByRole("button", { name: /Rolle aufdecken|Deine Rolle/ }).first();
      if ((await card.getAttribute("aria-label"))?.includes("aufdecken")) await card.click();
      await p.getByRole("button", { name: "Gesehen – bereit" }).click();
    }
    await expect(screen.getByTestId("table-sign")).toContainText("Nacht 1");
    await screen.waitForTimeout(800);
    await shot(screen, "9p-tisch-werwolf-nacht");

    // Eine Nacht: drei Karten in der Mitte, nach der Nacht läuft die Uhr
    await pick("einenacht");
    for (const p of phones) await p.getByRole("button", { name: "Gesehen – bereit" }).click();
    await expect(screen.getByTestId("table-sign")).toContainText("Die Nacht");
    await expect(screen.getByTestId("table-pile")).toHaveCount(3);
    for (const p of phones) {
      const drunk = p.getByRole("group", { name: "Karten in der Mitte" }).getByRole("button", { name: "Karte 1" });
      if (await p.getByText("Tausche mit einer Karte aus der Mitte").isVisible()) await drunk.click();
      else await p.getByRole("button", { name: "Fertig" }).click();
    }
    await expect(screen.getByTestId("table-sign")).toContainText("Wer ist der Werwolf?");
    await expect(screen.getByTestId("table-clock")).toContainText(/\d:\d\d/);
    await screen.waitForTimeout(800);
    await shot(screen, "9q-tisch-einenacht-tag");

    // Spion: Karte ansehen, dann fragt der Erste – Uhr läuft
    await pick("spion");
    for (const p of phones) {
      await p.getByRole("button", { name: "Karte ansehen" }).click();
      await p.getByRole("button", { name: "Gesehen – bereit" }).click();
    }
    await expect(screen.getByTestId("table-sign")).toContainText("fragt");
    await expect(screen.getByTestId("table-clock")).toBeVisible();
    await screen.waitForTimeout(800);
    await shot(screen, "9r-tisch-spion");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Stirnraten am Tisch: Fernseher zeigt wer rät, Uhr und Punkte – nie den Begriff; nach dem Zug die Liste", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { stirnraten: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    await joinByLink(browser, code, pin, "Ben");
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-stirnraten").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    await expect(screen.getByTestId("table-sign")).toContainText("Anna ist dran");
    await anna.getByTestId("categories").getByRole("button", { name: "Tiere", exact: true }).click();
    await anna.getByTestId("go").click();
    await expect(anna.getByTestId("forehead")).toBeVisible({ timeout: 8000 });
    const word = (await anna.getByTestId("forehead-word").textContent())!;
    await expect(screen.getByTestId("table-sign")).toContainText("Anna rät");
    await expect(screen.getByTestId("table-sign")).not.toContainText(word);
    await expect(screen.locator("body")).not.toContainText(word);
    await screen.waitForTimeout(500);
    await shot(screen, "9s-tisch-stirnraten");
    await anna.getByRole("button", { name: "Richtig", exact: true }).click();
    await anna.waitForTimeout(700);
    await anna.getByRole("button", { name: "Zug beenden" }).click();
    await expect(screen.getByTestId("table-word")).toHaveCount(1);
    await expect(screen.getByTestId("table-word")).toContainText(word);
    await expect(screen.locator("main")).toContainText("1 erraten");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Zeichnen & Raten am Tisch: das Blatt groß und live über dem Tisch, Lücken statt Begriff – danach die Auflösung", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { zeichnen: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-zeichnen").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    const pick = (p: typeof anna) => p.getByRole("group", { name: "Begriff wählen" });
    await expect.poll(async () => (await pick(anna).isVisible()) || (await pick(ben).isVisible())).toBe(true);
    const drawer = (await pick(anna).isVisible()) ? anna : ben;
    await expect(screen.getByTestId("table-sign")).toContainText("ist dran");
    const word = (await pick(drawer).getByRole("button").first().textContent())!;
    await pick(drawer).getByRole("button").first().click();
    const box = (await drawer.getByTestId("paper").boundingBox())!;
    await drawer.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await drawer.mouse.down();
    for (let i = 1; i <= 6; i++) await drawer.mouse.move(box.x + box.width * (0.2 + i * 0.1), box.y + box.height * (i % 2 ? 0.3 : 0.7), { steps: 3 });
    await drawer.mouse.up();
    const tv = screen.getByTestId("table-drawing");
    await expect.poll(async () => Number(await tv.getByTestId("paper").getAttribute("data-strokes"))).toBeGreaterThan(0);
    await expect(tv).toContainText("zeichnet");
    await expect(screen.locator("body")).not.toContainText(word);
    await screen.waitForTimeout(500);
    await shot(screen, "9t-tisch-zeichnen");
    await drawer.getByTestId("who").click();
    await drawer.getByRole("button", { name: "Keiner" }).click();
    await expect(tv).toContainText(word);
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Quiz am Tisch: Frage und Antworten groß, wer schon geantwortet hat – nie die Lösung vor dem Auflösen", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { quiz: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const anna = await joinByLink(browser, code, pin, "Anna");
    const ben = await joinByLink(browser, code, pin, "Ben");
    await anna.getByTestId("meet-play").click();
    await anna.getByTestId("pick-quiz").click();
    await anna.getByRole("button", { name: "Spiel starten" }).click();
    const tv = screen.getByTestId("table-quiz");
    await expect(tv.getByTestId("table-question")).toHaveText(new RegExp((await anna.getByTestId("question").textContent())!.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(screen.getByTestId("table-quiz-status")).toContainText("0 von 2");
    await expect(screen.getByTestId("table-quiz-status")).not.toContainText("Lösung");
    // Antwort geben (je nach Art der Frage)
    const answer = async (p: typeof anna) => {
      if (await p.getByRole("group", { name: "Antworten" }).isVisible()) await p.getByRole("group", { name: "Antworten" }).getByRole("button").first().click();
      else if (await p.getByLabel("Deine Schätzung").isVisible()) { await p.getByLabel("Deine Schätzung").fill("10"); await p.getByRole("button", { name: "Schätzen" }).click(); }
      else for (let i = 0; i < 4; i++) await p.getByRole("group", { name: "Begriffe" }).getByRole("button").nth(i).click();
    };
    await answer(anna);
    await expect(screen.getByTestId("table-quiz-status")).toContainText("1 von 2");
    await screen.waitForTimeout(500);
    await shot(screen, "9u-tisch-quiz");
    await answer(ben);
    await expect(screen.getByTestId("table-quiz-status")).toContainText("Lösung");
    await shot(screen, "9v-tisch-quiz-loesung");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
