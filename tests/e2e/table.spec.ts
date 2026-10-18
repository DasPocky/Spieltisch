import { expect, test, type Browser, type Page } from "@playwright/test";
import { newPhone, shot } from "./util";

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
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

  // Wer dran ist, zieht am Handy – der Tisch zählt mit
  const turn = screen.locator('[data-testid="table-seat"][data-turn="true"]');
  await expect(turn).toHaveCount(1);
  const mover = (await turn.textContent())?.includes("Anna") ? anna : ben;
  await mover.getByRole("button", { name: /ziehen/i }).first().click();
  await expect(screen.getByTestId("table-seat").filter({ hasText: /· [67]/ })).toHaveCount(1);
  await shot(screen, "91-table-maumau");
  // Der Tisch zeigt keine fremden Karten – nur die Anzahl
  await expect(screen.getByTestId("hand")).toHaveCount(0);
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
  await anna.getByTestId("pick-uno").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(screen.getByTestId("table-view")).toContainText("Uno");
  await expect(screen.getByTestId("table-seat")).toHaveCount(2);
  await expect(screen.getByTestId("table-seat").first()).toContainText(/· \d/);
  await screen.waitForTimeout(600);
  await shot(screen, "93-table-flach");
});

test("Ton am Tisch: Musik läuft, Regler für Effekte, Musik und Publikum, ausschaltbar – ohne Fehler", async ({ browser }) => {
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
  await expect(screen.getByTestId("sound-unlock").or(screen.getByTestId("sound-panel"))).toBeVisible();
  if (await screen.getByTestId("sound-unlock").isVisible()) {
    await screen.getByTestId("sound-unlock").click();
    await expect(screen.getByTestId("sound-panel")).toBeVisible();
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
