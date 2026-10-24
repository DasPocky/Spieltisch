import { expect, test, type Page } from "@playwright/test";
import { ADMIN_PW, adminLogin, ALL_ON, closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, setConfig, shot, startLocal } from "./util";

const BLACK = Array.from({ length: 6 }, (_, i) => `Eigene Frage ${i + 1}: ___?`);
const WHITE = Array.from({ length: 40 }, (_, i) => `Eigene Antwort ${i + 1}`);

/** Profil dieses Geräts (ID und Geräteschlüssel) */
const profileOf = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem("spieltisch:profile") ?? "{}") as { id: string; key: string });

/** Im Profil ein Set anlegen – Schamlos: schwarze und weiße Karten je Zeile */
async function newSchamlosSet(p: Page, name: string) {
  await p.goto("/profil");
  await p.getByTestId("sets-open").click();
  await expect(p.getByRole("heading", { name: "Meine Kartensets" })).toBeVisible();
  await p.getByTestId("set-new").click();
  await p.getByTestId("set-kind-schamlos").click();
  await p.getByLabel(/Name des Sets/).fill(name);
  await p.getByTestId("set-lines").fill([...BLACK, BLACK[0]].join("\n"));
  await p.getByRole("radio", { name: /Weiß/ }).click();
  await p.getByTestId("set-lines").fill(WHITE.join("\n"));
  await expect(p.getByTestId("set-check")).toContainText("46 von höchstens 300");
  await expect(p.getByTestId("set-check")).toContainText("1 doppelt");
  await expectNoScroll(p);
  await shot(p, "kartensets-editor");
  await p.getByTestId("set-save").click();
  await expect(p).toHaveURL(/\/profil\/sets\/[a-z0-9]{12}$/);
  return p.url().split("/").pop()!;
}

test("Kartensets: anlegen, vorschlagen, freigeben, im Raum mit „Nur eigene Karten“ spielen", async ({ browser }) => {
  const [anna, ben, cem] = await Promise.all([newPhone(browser), newPhone(browser), newPhone(browser)]);
  const id = await newSchamlosSet(anna, "Unsere Insider");

  // Vorschlagen → wartet; die öffentliche Liste kennt es noch nicht
  await anna.getByTestId("set-submit").click();
  await expect(anna.getByText("Wartet auf Prüfung")).toBeVisible();
  expect((await (await anna.request.get("/api/sets/public?kind=schamlos")).json()).sets.some((s: { id: string }) => s.id === id)).toBe(false);
  await anna.getByRole("button", { name: "Meine Kartensets" }).click();
  await expect(anna.getByTestId("set-row")).toContainText("Unsere Insider");
  await shot(anna, "kartensets-liste");

  // Verwaltung: Warteschlange, Vorschau, Freigeben
  const admin = await newPhone(browser);
  await adminLogin(admin);
  await admin.getByTestId("admin-tile-kartensets").click();
  await admin.getByTestId("admin-set-row").filter({ hasText: "Unsere Insider" }).first().click();
  await expect(admin.getByTestId("admin-set-review")).toContainText(WHITE[0]);
  await expect(admin.getByTestId("admin-set-reject")).toBeDisabled(); // Ablehnen nur mit Grund
  await shot(admin, "kartensets-verwaltung");
  await admin.getByTestId("admin-set-approve").click();
  await expect(admin.getByText("Freigegeben").first()).toBeVisible();
  const pub = (await (await anna.request.get("/api/sets/public?kind=schamlos")).json()).sets.find((s: { id: string }) => s.id === id);
  expect(pub).toMatchObject({ name: "Unsere Insider", owner: "", status: "frei" });
  expect(pub.by).toBeUndefined();

  // Raum: Set wählen, „Nur eigene Karten“ geht, weil genug Karten da sind
  const code = await createRoom(anna, "schamlos", "Anna", "4242");
  await joinRoom(ben, code, "Ben", "4242");
  await joinRoom(cem, code, "Cem", "4242");
  await openSettings(anna);
  await anna.getByTestId("set-pick").click();
  await anna.getByRole("checkbox", { name: "Unsere Insider" }).first().click();
  await shot(anna, "kartensets-lobby-auswahl");
  await anna.getByTestId("set-pick-done").click();
  await expect(anna.getByTestId("set-picker")).toContainText("Unsere Insider");
  await anna.getByRole("checkbox", { name: /Nur eigene Karten/ }).click();
  await shot(anna, "kartensets-lobby-einstellungen");
  await closeSettings(anna);
  await expect(anna.getByTestId("settings-summary")).toContainText("1 eigenes Set (nur eigene)");
  // Gäste sehen die Wahl, können sie aber nicht ändern
  await openSettings(ben);
  await expect(ben.getByTestId("set-picker")).toContainText("Unsere Insider");
  await expect(ben.getByTestId("set-pick")).toHaveCount(0);
  await closeSettings(ben);

  await anna.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of [anna, ben, cem]) await expect(p.getByTestId("black-card")).toContainText("Eigene Frage");
  const hands = [anna, ben, cem].map((p) => p.getByTestId("hand"));
  let checked = 0;
  for (const h of hands) if (await h.count()) { await expect(h.getByRole("button").first()).toContainText("Eigene Antwort"); checked++; }
  expect(checked).toBe(2);
});

test("Kartensets: Rechte und Grenzen am Server", async ({ browser }) => {
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const id = await newSchamlosSet(anna, "Nur für Anna");
  await ben.goto("/");
  const a = await profileOf(anna), b = await profileOf(ben);
  const req = ben.request;

  // Fremdes privates Set: nicht lesbar, nicht änderbar, nicht löschbar – auch nicht mit Annas ID und falschem Schlüssel
  expect((await req.get(`/api/sets/${id}`, { headers: { "x-profile": b.id, "x-profile-key": b.key } })).status()).toBe(404);
  expect((await req.get(`/api/sets/${id}`)).status()).toBe(404);
  const fake = { "x-profile": a.id, "x-profile-key": b.key };
  expect((await req.put(`/api/sets/${id}`, { headers: fake, data: { kind: "schamlos", name: "gekapert", data: { white: ["x"] } } })).status()).toBe(403);
  expect((await req.delete(`/api/sets/${id}`, { headers: fake })).status()).toBe(403);
  expect((await req.post(`/api/sets/${id}/submit`, { headers: fake })).status()).toBe(403);
  expect((await req.get(`/api/sets/${id}`, { headers: { "x-profile": a.id, "x-profile-key": a.key } })).status()).toBe(200);

  // Fremder Bildschlüssel im eigenen Set: abgelehnt (sonst ginge das fremde Bild beim Löschen mit)
  const own = { "x-profile": b.id, "x-profile-key": b.key };
  const foreign = await req.put("/api/sets/bbbbbbbbbbbb", { headers: own, data: { kind: "decknamen", name: "Bilder", data: { words: ["bild:k/0123456789abcdef/abcdefghijklmnopqrst", "Hund"] } } });
  expect(foreign.status()).toBe(400);
  expect((await foreign.json()).error).toMatch(/gehört nicht/);

  // Zu großes Bild: abgelehnt, bevor es ganz gelesen ist; kein Bild: abgelehnt
  expect((await req.post("/api/sets/image", { headers: own, data: Buffer.alloc(200_000, 1) })).status()).toBe(413);
  expect((await req.post("/api/sets/image", { headers: own, data: Buffer.from("kein bild") })).status()).toBe(400);
  // Ungültige Inhalte: verständlicher Grund statt stiller Kürzung
  const bad = await req.put("/api/sets/cccccccccccc", { headers: own, data: { kind: "schamlos", name: "X", data: { black: ["ohne Lücke"] } } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatch(/Lücke/);
});

test("Kartensets am Gerät für alle: Quiz mit eigenen Fragen, auch ohne Server beim Start", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/profil/sets/neu/quiz");
  await page.getByLabel(/Name des Sets/).fill("Familienquiz");
  await page.getByTestId("question-add").click();
  await page.getByLabel("Frage", { exact: true }).fill("Wie heißt unser Hund?");
  for (const [i, v] of ["Bello", "Rex", "Struppi", "Fiffi"].entries()) await page.getByLabel(i === 0 ? "Richtige Antwort" : "Falsch").nth(i === 0 ? 0 : i - 1).fill(v);
  await shot(page, "kartensets-quiz-frage");
  await page.getByTestId("question-save").click();
  await expect(page.getByText("Wie heißt unser Hund?")).toBeVisible();
  await page.getByTestId("set-save").click();
  await expect(page).toHaveURL(/\/profil\/sets\/[a-z0-9]{12}$/);

  await startLocal(page, "quiz", ["Anna", "Ben"], {
    fresh: false,
    start: false,
    settings: async (p) => {
      await p.getByTestId("set-pick").click();
      await p.getByRole("checkbox", { name: "Familienquiz" }).click();
      await p.getByTestId("set-pick-done").click();
      await p.getByRole("checkbox", { name: /Nur eigene Fragen/ }).click();
    },
  });
  // Ab hier ohne Netz: die Inhalte liegen schon auf dem Gerät
  await page.route("**/api/sets/**", (r) => r.abort());
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("question")).toHaveText("Wie heißt unser Hund?");
  await expect(page.getByText("Eigene Frage")).toBeVisible();
});

test("Quiz: alle Kategorien abgewählt – Hinweis, trotzdem Fragen", async ({ page }) => {
  await startLocal(page, "quiz", ["Anna", "Ben"], {
    start: false,
    settings: async (p) => {
      for (const name of [/Allgemeinwissen/, /Erde & Länder/, /Geschichte/, /Natur & Tiere/, /Musik, Kunst/, /Sport & Spiel/, /Essen & Trinken/, /Wissenschaft & Technik/, /Sprache & Wörter/]) {
        await p.getByRole("checkbox", { name }).click();
      }
      await expect(p.getByTestId("quiz-deck-note")).toBeVisible();
    },
  });
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByTestId("question")).toBeVisible();
});

test("Kartensets mit Bildkarten: hochladen, Decknamen nur mit eigenen Wörtern, Bild auf dem Brett", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/profil/sets/neu/decknamen");
  await page.getByLabel(/Name des Sets/).fill("Familienbilder");
  await page.getByTestId("set-lines").fill(Array.from({ length: 24 }, (_, i) => `Wort${i + 1}`).join("\n"));
  await page.getByLabel("Bilder wählen").setInputFiles("tests/fixtures/bildkarte.png");
  await expect(page.getByRole("img", { name: "Bildkarte" })).toBeVisible();
  await expect(page.getByTestId("set-check")).toContainText("25 von höchstens 300");
  await expectNoScroll(page);
  await shot(page, "kartensets-bilder");
  await page.getByTestId("set-save").click();
  await expect(page).toHaveURL(/\/profil\/sets\/[a-z0-9]{12}$/);
  // Das Bild kommt mit sicheren Kopfzeilen vom Server
  const src = await page.getByRole("img", { name: "Bildkarte" }).getAttribute("src");
  const img = await page.request.get(src!);
  expect(img.status()).toBe(200);
  expect(img.headers()["x-content-type-options"]).toBe("nosniff");
  expect(img.headers()["content-type"]).toMatch(/^image\/(jpeg|png|webp)$/);

  await startLocal(page, "decknamen", ["Anna", "Ben", "Cem", "Dora"], {
    fresh: false,
    settings: async (p) => {
      await p.getByTestId("set-pick").click();
      await p.getByRole("checkbox", { name: "Familienbilder" }).click();
      await p.getByTestId("set-pick-done").click();
      await p.getByRole("checkbox", { name: /Nur eigene Wörter/ }).click();
    },
  });
  await page.getByRole("button", { name: "Zufällig verteilen" }).click();
  await page.getByRole("button", { name: "Los geht's" }).click();
  const words = page.getByRole("group", { name: "Wörter" });
  await expect(words.getByRole("button")).toHaveCount(25);
  await expect(words.getByRole("img", { name: "Bildkarte" })).toHaveCount(1);
  await expect(words.getByRole("button", { name: /^Wort\d+$/ })).toHaveCount(24);
  await shot(page, "kartensets-decknamen-bild");
});

test("Kartensets: gewähltes Set inzwischen gelöscht – Host erfährt es beim Start, Spiel läuft mit eingebauten", async ({ browser }) => {
  const anna = await newPhone(browser);
  await anna.goto("/");
  const a = await profileOf(anna);
  const headers = { "x-profile": a.id, "x-profile-key": a.key };
  expect((await anna.request.put("/api/sets/dddddddddddd", { headers, data: { kind: "quiz", name: "Gleich weg", data: { questions: [["Bald gelöscht?", "Ja", "Nein", "Vielleicht", "Nie"]] } } })).ok()).toBe(true);
  await createRoom(anna, "quiz", "Anna", "4242");
  await openSettings(anna);
  await anna.getByTestId("set-pick").click();
  await anna.getByRole("checkbox", { name: "Gleich weg" }).click();
  await anna.getByTestId("set-pick-done").click();
  await closeSettings(anna);
  expect((await anna.request.delete("/api/sets/dddddddddddd", { headers })).ok()).toBe(true);
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByText("Ein gewähltes Kartenset gibt es nicht mehr")).toBeVisible();
  await expect(anna.getByTestId("question")).not.toHaveText("Bald gelöscht?");
});

test("Kartensets: Name des Erstellers nur mit Häkchen öffentlich", async ({ browser }) => {
  const anna = await newPhone(browser);
  await anna.goto("/");
  await anna.evaluate(() => localStorage.setItem("spieltisch:name", "Anna Beispiel"));
  const a = await profileOf(anna);
  const headers = { "x-profile": a.id, "x-profile-key": a.key };
  expect((await anna.request.put(`/api/profile/${a.id}`, { headers, data: { name: "Anna Beispiel" } })).ok()).toBe(true);
  const admin = { "x-admin-password": ADMIN_PW };
  for (const [id, showName] of [["eeeeeeeeeeee", false], ["ffffffffffff", true]] as const) {
    expect((await anna.request.put(`/api/sets/${id}`, { headers, data: { kind: "zeichnen", name: `Begriffe ${id[0]}`, data: { words: ["Leuchtturm", "Gartenzwerg", "Kaktus"] }, showName } })).ok()).toBe(true);
    expect((await anna.request.post(`/api/sets/${id}/submit`, { headers })).ok()).toBe(true);
    const at = (await (await anna.request.get(`/api/admin/sets/${id}`, { headers: admin })).json()).set.updatedAt;
    expect((await anna.request.post(`/api/admin/sets/${id}/review`, { data: { password: ADMIN_PW, ok: true, at } })).ok()).toBe(true);
  }
  // Veraltete Fassung: die Verwaltung muss neu ansehen
  expect((await anna.request.post("/api/admin/sets/eeeeeeeeeeee/review", { data: { password: ADMIN_PW, ok: true, at: 1 } })).status()).toBe(409);
  const pub = (await (await anna.request.get("/api/sets/public?kind=zeichnen")).json()).sets as { id: string; by?: string; owner: string }[];
  expect(pub.find((s) => s.id === "eeeeeeeeeeee")).toMatchObject({ owner: "" });
  expect(pub.find((s) => s.id === "eeeeeeeeeeee")!.by).toBeUndefined();
  expect(pub.find((s) => s.id === "ffffffffffff")).toMatchObject({ owner: "", by: "Anna Beispiel" });
  expect(JSON.stringify(pub)).not.toContain(a.id);
});

test("Verwaltung: eigene Kartensets abschalten – kein Editor, keine Auswahl, Sets bleiben gespeichert", async ({ page, request }) => {
  await page.goto("/");
  const a = await profileOf(page);
  const headers = { "x-profile": a.id, "x-profile-key": a.key };
  expect((await page.request.put("/api/sets/gggggggggggg", { headers, data: { kind: "quiz", name: "Bleibt", data: { questions: [["Bleibt das?", "Ja", "Nein", "Weiß nicht", "Nie"]] } } })).ok()).toBe(true);
  await setConfig(request, { ...ALL_ON, features: { ...ALL_ON.features, sets: false } });
  try {
    expect((await page.request.get("/api/sets", { headers })).status()).toBe(403);
    await page.goto("/profil");
    await expect(page.getByTestId("stats")).toBeVisible();
    await expect(page.getByTestId("sets-card")).toHaveCount(0);
    await page.goto("/profil/sets");
    await expect(page.getByText("Eigene Kartensets sind gerade abgeschaltet.")).toBeVisible();
  } finally {
    await setConfig(request, ALL_ON);
  }
  expect((await page.request.get("/api/sets/gggggggggggg", { headers })).ok()).toBe(true);
});
