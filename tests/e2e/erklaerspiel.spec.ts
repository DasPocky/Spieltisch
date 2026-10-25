import { expect, test, type Browser, type Page } from "@playwright/test";
import { ALL_ON, captureSpeech, createRoom, expectNoScroll, joinRoom, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Einstellungen per Minus/Plus */
const fewer = async (p: Page, label: string, times: number) => { for (let i = 0; i < times; i++) await p.getByRole("button", { name: `${label} verringern` }).click(); };

/** Richtig/Weiter tippen – das Handy nimmt nur alle paar hundert Millisekunden einen Tipp an (gegen Doppeltipps) */
async function tap(p: Page, id: "hit" | "pass") { await p.getByTestId(id).click(); await p.waitForTimeout(450); }

/** Wer gerade erklärt (Name aus dem Banner) */
async function explainerName(p: Page) { return ((await p.getByTestId("explainer").textContent()) ?? "").split(" erklärt")[0].trim(); }

test("Erklärspiel online mit 4 Handys: erklären, Gegner kontrolliert und nimmt zurück, bis zum Ergebnis – ohne Scrollen", async ({ browser }) => {
  test.setTimeout(180_000);
  const names = ["Anna", "Ben", "Cem", "Dora"];
  const phones: Page[] = [await newPhone(browser)];
  await captureSpeech(phones[0]);
  const code = await createRoom(phones[0], "erklaerspiel", "Anna", "1234");
  for (const n of names.slice(1)) { const p = await newPhone(browser); await joinRoom(p, code, n, "1234"); phones.push(p); }
  const [anna, ben, cem, dora] = phones;
  // Einstellungen: ein Zug je Team, 30 Sekunden
  await anna.getByTestId("settings-summary").click();
  await fewer(anna, "Züge je Team", 2);
  await fewer(anna, "Zeit pro Zug (s)", 2);
  await anna.getByRole("button", { name: "Fertig", exact: true }).click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();

  // Team Rot: Anna erklärt, Cem rät; Ben und Dora sind Gegner
  await expect(anna.getByTestId("explainer")).toContainText("Anna erklärt");
  await expect(anna.getByText("Du erklärst!")).toBeVisible();
  await expect(cem.getByText("Ihr ratet gleich")).toBeVisible();
  await expectNoScroll(anna);
  await shot(anna, "erkl-01-bereit");
  await anna.getByTestId("go").click();
  await expect(anna.getByTestId("word")).toBeVisible();
  const w1 = (await anna.getByTestId("word").textContent())!;
  expect(w1.length).toBeGreaterThan(1);
  // Gegner sehen den Begriff zur Kontrolle, das eigene Team nicht
  await expect(ben.getByTestId("control-word")).toHaveText(w1);
  await expect(cem.getByTestId("control-word")).toHaveCount(0);
  await expect(cem.getByText(w1, { exact: true })).toHaveCount(0);
  await expectNoScroll(anna);
  await expectNoScroll(cem);
  await shot(anna, "erkl-02-erklaerer");
  await shot(cem, "erkl-03-team");
  await shot(ben, "erkl-04-kontrolle");
  await tap(anna, "hit");
  await expect(cem.getByTestId("clock")).toContainText("✓ 1");
  await tap(anna, "pass");
  await tap(anna, "hit");
  await expect(anna.getByTestId("clock")).toContainText("✓ 2");
  await anna.getByRole("button", { name: "Zug beenden" }).click();
  // Bestätigung: Liste für alle, das ratende Team darf nicht bestätigen, der Gegner nimmt einen Treffer zurück
  await expect(ben.getByTestId("review-title")).toHaveText("2 erraten · +2");
  await expect(cem.getByTestId("confirm")).toHaveCount(0);
  await expect(ben.getByTestId("review")).toContainText(w1);
  await ben.getByTestId("review").getByRole("button").first().click();
  await expect(anna.getByTestId("review-title")).toHaveText("1 erraten · +1");
  await expectNoScroll(ben);
  await shot(ben, "erkl-05-bestaetigen");
  await ben.getByTestId("confirm").click();
  await expect(dora.getByTestId("score-0")).toHaveText("1");

  // Team Blau: Ben erklärt – die Zeit läuft ab
  await expect(ben.getByText("Du erklärst!")).toBeVisible();
  await ben.getByTestId("go").click();
  await expect(ben.getByTestId("word")).toBeVisible();
  await tap(ben, "hit");
  await tap(ben, "hit");
  await expect(dora.getByTestId("review-title")).toBeVisible({ timeout: 45_000 });
  await expect(dora.getByTestId("review-title")).toHaveText("2 erraten · +2");
  await anna.getByTestId("confirm").click();
  // Ergebnis: Blau gewinnt 2:1
  for (const p of phones) await expect(p.getByTestId("winner")).toHaveText("Team Blau");
  await expectNoScroll(cem);
  await shot(cem, "erkl-06-ergebnis");
  const said = await spoken(anna);
  expect(said).toContain("Team Rot ist dran. Anna erklärt");
  expect(said).toContain("Zeit ist um!");
  expect(said).toContain("Es gewinnt Team Blau");
  expect(said).not.toContain(w1);
});

test("Erklärspiel an einem Handy für alle: Sichtschutz vor dem Zug, Drei Runden, passt auf 320 px", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await startLocal(page, "erklaerspiel", ["Anna", "Ben", "Cem", "Dora"], {
    settings: async (p) => { await p.getByRole("radio", { name: /Drei Runden/ }).first().click(); await fewer(p, "Begriffe im Topf", 4); },
  });
  await expect(page.getByTestId("handoff")).toBeVisible();
  await expect(page.getByTestId("round")).toContainText("Runde 1 von 3");
  await expectNoScroll(page);
  await shot(page, "erkl-07-sichtschutz-320");
  await page.getByRole("button", { name: "Ich bin Anna – Karten zeigen" }).click();
  await page.getByTestId("go").click();
  await expect(page.getByTestId("word")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "erkl-08-erklaerer-320");
  // Alle zehn Begriffe der ersten Runde erraten – dann endet der Zug von selbst
  for (let i = 0; i < 10; i++) await tap(page, "hit");
  await expect(page.getByTestId("review-title")).toHaveText("10 erraten · +10");
  await expectNoScroll(page);
  await shot(page, "erkl-09-liste-320");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("stage")).toContainText("Ein Wort");
  await expect(page.getByTestId("handoff")).toContainText("Ben");
  await expectNoScroll(page);
});

/** Laptop oder Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Erklärspiel am Großen Tisch: Uhr und Team, aber nie der Begriff", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { erklaerspiel: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const name of ["Anna", "Ben", "Cem", "Dora"]) {
      const p = await newPhone(browser);
      await p.goto(`/r/${code}#pin=${pin}`);
      await expect(p.getByLabel("PIN")).toHaveValue(pin);
      await p.getByLabel("Dein Name").fill(name);
      await p.getByRole("button", { name: "Beitreten" }).click();
      phones.push(p);
    }
    await expect(screen.getByTestId("table-seat")).toHaveCount(4);
    await phones[0].getByTestId("meet-play").click();
    await phones[0].getByTestId("pick-erklaerspiel").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    const who = await explainerName(phones[0]);
    const explainer = phones[["Anna", "Ben", "Cem", "Dora"].indexOf(who)];
    await expect(screen.getByTestId("table-view")).toContainText(`${who} erklärt`);
    await explainer.getByTestId("go").click();
    const word = (await explainer.getByTestId("word").textContent())!;
    await tap(explainer, "hit");
    const word2 = (await explainer.getByTestId("word").textContent())!;
    await expect(screen.getByTestId("table-view")).toContainText("✓ 1");
    await expect(screen.getByTestId("table-view")).not.toContainText(word);
    await expect(screen.getByTestId("table-view")).not.toContainText(word2);
    await shot(screen, "erkl-10-fernseher");
    await explainer.getByRole("button", { name: "Zug beenden" }).click();
    await expect(screen.getByTestId("table-view")).toContainText(word);
    await shot(screen, "erkl-11-fernseher-liste");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
