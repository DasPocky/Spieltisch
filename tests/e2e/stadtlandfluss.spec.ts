import { expect, test, type Browser, type Page } from "@playwright/test";
import { ALL_ON, captureSpeech, closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, setConfig, shot, spoken } from "./util";

const letterOf = async (p: Page) => (await p.getByTestId("slf-letter").first().textContent())!.trim();

test("Stadt-Land-Fluss online mit drei Handys: schreiben, Stopp, ablehnen, Ergebnis", async ({ browser }) => {
  test.setTimeout(150_000);
  const anna = await newPhone(browser);
  await captureSpeech(anna);
  const ben = await newPhone(browser);
  const cem = await newPhone(browser);
  const code = await createRoom(anna, "stadtlandfluss", "Anna", "4352");
  await joinRoom(ben, code, "Ben", "4352");
  await joinRoom(cem, code, "Cem", "4352");
  // Eine Runde, 5 s nach dem Stopp
  await openSettings(anna);
  for (let i = 0; i < 4; i++) await anna.getByRole("button", { name: "Runden verringern" }).click();
  await expect(anna.getByTestId("setting-rounds")).toHaveText("1");
  await anna.getByRole("radio", { name: /^5 s/ }).click();
  await expectNoScroll(anna);
  await shot(anna, "slf-0-einstellungen");
  await closeSettings(anna);
  await anna.getByRole("button", { name: "Spiel starten" }).click();

  for (const p of [anna, ben, cem]) await expect(p.getByTestId("slf-in-0")).toBeVisible();
  const L = await letterOf(anna);
  expect(await letterOf(ben)).toBe(L);
  // Anna füllt alles, Ben nur zwei Felder (das erste wie Anna, mit Tippfehler-freier Großschreibung), Cem nur das erste
  for (let i = 0; i < 6; i++) await anna.getByTestId(`slf-in-${i}`).fill(`${L}anna${i}xy`);
  await ben.getByTestId("slf-in-0").fill(`${L.toLowerCase()}anna0xy`);
  await ben.getByTestId("slf-in-1").fill(`${L}ben1`);
  await cem.getByTestId("slf-in-0").fill(`${L}cem0`);
  await expect(ben.getByTestId("slf-done")).toHaveText("Abgeben (noch nicht alles)");
  await expect(anna.getByTestId("slf-done")).toHaveText("Stopp!");
  await expectNoScroll(anna);
  await shot(anna, "slf-1-eingabe");
  await anna.setViewportSize({ width: 320, height: 568 });
  await expectNoScroll(anna);
  await shot(anna, "slf-1b-eingabe-klein");
  await anna.setViewportSize({ width: 390, height: 844 });
  // Ben gibt nichts zu sehen: fremde Antworten sind geheim
  await expect(ben.getByText(`${L}cem0`)).toHaveCount(0);
  await anna.getByTestId("slf-done").click();
  await expect(ben.getByTestId("slf-title")).toHaveText("Schnell, fertig schreiben!");
  await expect(ben.getByTestId("clock")).toBeVisible();
  await expectNoScroll(ben);
  await shot(ben, "slf-2-stopp");

  // Countdown läuft ab → Auswertung „Stadt“
  for (const p of [anna, ben, cem]) await expect(p.getByTestId("slf-title")).toHaveText("Stadt", { timeout: 20_000 });
  await expect(anna.getByTestId("slf-row")).toHaveCount(3);
  await expect(cem.getByTestId("slf-review")).toContainText(`${L}anna0xy`);
  await expect(cem.getByTestId("slf-review")).toContainText(`${L}cem0`);
  // Ben und Cem lehnen Annas Antwort ab (2 von 2)
  const annaRow = (p: Page) => p.getByTestId("slf-row").first();
  await ben.getByRole("button", { name: "Antwort von Anna ablehnen" }).click();
  await cem.getByRole("button", { name: "Antwort von Anna ablehnen" }).click();
  await expect(annaRow(anna)).toContainText("abgelehnt");
  // Ben hat wie Anna geschrieben – Annas ist raus, also ist Ben allein mit seiner (10), Cem 10
  await expect(anna.getByTestId("slf-row").nth(1).getByTestId("slf-pts")).toHaveText("+10");
  await expect(annaRow(anna).getByTestId("slf-pts")).toHaveText("+0");
  await expect(anna.getByRole("button", { name: "Antwort von Anna ablehnen" })).toHaveCount(0);
  await expect(ben.getByText("Der Host geht weiter")).toBeVisible();
  await expectNoScroll(cem);
  await shot(cem, "slf-3-auswertung");
  await cem.setViewportSize({ width: 320, height: 568 });
  await expectNoScroll(cem);
  await shot(cem, "slf-3b-auswertung-klein");

  // Anna geht durch die Kategorien
  await anna.getByTestId("slf-next").click();
  await expect(anna.getByTestId("slf-title")).toHaveText("Land");
  // Land: Anna und Ben verschieden → je 10
  await expect(annaRow(anna).getByTestId("slf-pts")).toHaveText("+10");
  await expect(anna.getByTestId("slf-row").nth(1).getByTestId("slf-pts")).toHaveText("+10");
  // je Klick abwarten, bis die nächste Kategorie da ist – schnelle Klicks gehen sonst verloren
  for (let i = 1; i < 6; i++) {
    const before = await anna.getByTestId("slf-title").textContent();
    await anna.getByTestId("slf-next").click();
    if (i < 5) await expect(anna.getByTestId("slf-title")).not.toHaveText(before ?? "");
  }
  await expect(anna.getByTestId("slf-score")).toBeVisible();
  await expect(cem.getByTestId("slf-score")).toContainText("10");
  await expectNoScroll(anna);
  await shot(anna, "slf-4-wertung");
  await anna.getByTestId("slf-next").click();
  await expect(anna.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
  await expectNoScroll(anna);
  await shot(anna, "slf-5-ergebnis");
  // Anna: 10 + 4×20 (Fluss … Tier) = 90, Ben 20, Cem 10
  await expect(anna.locator("body")).toContainText("90");
  const said = await spoken(anna);
  expect(said).toContain(`Der Buchstabe ist: ${L}!`);
  expect(said).toContain("Stopp! Anna ist fertig.");
  expect(said).toContain(`Stadt mit ${L}. Anna: ${L}anna0xy.`);
  expect(said).toContain("Das Spiel ist aus! Anna gewinnt mit 90 Punkten.");
});

async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Stadt-Land-Fluss am Großen Tisch: Buchstabe groß, keine Antworten vor der Auswertung", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { stadtlandfluss: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const name of ["Anna", "Ben"]) {
      const p = await newPhone(browser);
      await p.goto(`/r/${code}#pin=${pin}`);
      await expect(p.getByLabel("PIN")).toHaveValue(pin);
      await p.getByLabel("Dein Name").fill(name);
      await p.getByRole("button", { name: "Beitreten" }).click();
      phones.push(p);
    }
    await expect(screen.getByTestId("table-seat")).toHaveCount(2);
    await phones[0].getByTestId("meet-play").click();
    await phones[0].getByTestId("pick-stadtlandfluss").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(phones[0].getByTestId("slf-in-0")).toBeVisible();
    const L = await letterOf(phones[0]);
    const view = screen.getByTestId("table-view");
    await expect(view).toContainText("Stadt-Land-Fluss");
    await expect(view).toContainText("0/2 fertig");
    await phones[0].getByTestId("slf-in-0").fill(`${L}geheim`);
    await phones[0].waitForTimeout(1500);
    await expect(view).not.toContainText(`${L}geheim`);
    await phones[1].getByTestId("slf-done").click();
    await expect(view).toContainText("1/2 fertig");
    await shot(screen, "slf-6-fernseher-schreiben");
    await phones[0].getByTestId("slf-done").click();
    await expect(view).toContainText(`Stadt mit ${L}`);
    await expect(view).toContainText(`${L}geheim`);
    await shot(screen, "slf-7-fernseher-auswertung");
  } finally {
    await setConfig(request, ALL_ON);
  }
});
