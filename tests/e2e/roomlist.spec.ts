import { expect, test, type Browser, type Page } from "@playwright/test";
import { expectNoScroll, newPhone, shot } from "./util";

async function phoneAs(browser: Browser, name: string): Promise<Page> {
  const page = await newPhone(browser);
  await page.goto("/");
  await page.evaluate((n) => localStorage.setItem("spieltisch:name", n), name);
  return page;
}

/** Raum mit Namen und Sichtbarkeit öffnen, Spiel wählen; gibt den Code zurück */
async function openRoom(page: Page, pin: string, room: { name: string; visibility?: RegExp; game?: string }): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Raum öffnen" }).click();
  await page.getByLabel(/PIN/).fill(pin);
  await page.getByTestId("room-more").click();
  await page.getByLabel("Raumname (optional)").fill(room.name);
  if (room.visibility) await page.getByRole("radio", { name: room.visibility }).click();
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByTestId("meet-play").click();
  await page.getByTestId(`pick-${room.game ?? "uno"}`).click();
  await expect(page.getByTestId("game-card")).toBeVisible();
  return page.url().split("/").pop()!;
}

test("Start: offene Räume anderer, eigene Räume ohne PIN, private bleiben unsichtbar", async ({ browser }) => {
  const anna = await phoneAs(browser, "Anna");
  const code = await openRoom(anna, "4321", { name: "Kniffelrunde" });
  const cem = await phoneAs(browser, "Cem");
  const secret = await openRoom(cem, "1111", { name: "Geheimbund", visibility: /Niemand/ });

  const ben = await phoneAs(browser, "Ben");
  await ben.goto("/");
  const open = ben.getByTestId("open-rooms");
  await expect(open.getByTestId(`room-card-${code}`)).toContainText("Kniffelrunde");
  await expect(open.getByTestId(`room-card-${code}`)).toContainText("Uno · Lobby");
  await expect(ben.getByTestId(`room-card-${secret}`)).toHaveCount(0);
  await expectNoScroll(ben);
  await shot(ben, "08-start-offene-raeume");

  // Antippen: Beitrittsformular mit Namen des Raums, dann PIN
  await open.getByTestId(`room-card-${code}`).click();
  await expect(ben.getByText("Kniffelrunde · Uno · Raum")).toBeVisible();
  await ben.getByLabel("PIN").fill("4321");
  await ben.getByRole("button", { name: "Beitreten" }).click();
  await expect(ben.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible();

  // Zurück auf dem Start: jetzt unter „Deine Räume“ – ein Tipp, und Ben ist ohne PIN wieder drin
  await ben.goto("/");
  await expect(ben.getByTestId("my-rooms").getByTestId(`room-card-${code}`)).toContainText("Kniffelrunde");
  await expect(ben.getByTestId("open-rooms").getByTestId(`room-card-${code}`)).toHaveCount(0);
  await shot(ben, "08b-start-deine-raeume");
  await ben.getByTestId(`room-card-${code}`).click();
  await expect(ben.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible();

  // Raum verlassen: verschwindet aus „Deine Räume“
  await ben.getByRole("button", { name: "Raum verlassen" }).click();
  await ben.getByRole("button", { name: "Verlassen", exact: true }).click();
  await expect(ben).toHaveURL(/\/$/);
  await expect(ben.getByTestId("my-rooms")).toHaveCount(0);
});

test("Laufende Partie: Wer über die Liste dazukommt, schaut zu und spielt ab der nächsten Partie mit", async ({ browser }) => {
  const anna = await phoneAs(browser, "Anna");
  const code = await openRoom(anna, "5555", { name: "Uno-Abend" });
  const ben = await phoneAs(browser, "Ben");
  await ben.goto(`/r/${code}`);
  await ben.getByLabel("PIN").fill("5555");
  await ben.getByRole("button", { name: "Beitreten" }).click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();

  const dora = await phoneAs(browser, "Dora");
  await dora.goto("/");
  await expect(dora.getByTestId(`room-card-${code}`)).toContainText("Uno · läuft");
  await dora.getByTestId(`room-card-${code}`).click();
  await expect(dora.getByTestId("join-spectate")).toContainText("du schaust zu");
  await dora.getByLabel("PIN").fill("5555");
  await dora.getByRole("button", { name: "Beitreten" }).click();
  await expect(dora.getByTestId("bench-wait")).toContainText("Du schaust zu");
  await shot(dora, "08c-zuschauen");
});

test("Kleines Handy mit eigenen und offenen Räumen: nichts scrollt", async ({ browser }) => {
  const anna = await phoneAs(browser, "Anna");
  await openRoom(anna, "7777", { name: "Erster Tisch" });
  const ben = await phoneAs(browser, "Ben");
  await openRoom(ben, "8888", { name: "Zweiter Tisch" });
  await ben.setViewportSize({ width: 360, height: 640 });
  await ben.goto("/");
  await expect(ben.getByTestId("my-rooms")).toBeVisible();
  await expect(ben.getByTestId("open-rooms")).toBeVisible();
  await expectNoScroll(ben);
  const over = await ben.evaluate(() => { const t = document.querySelector('[data-testid^="tab-"]')!; return t.scrollHeight - t.clientHeight; });
  await shot(ben, "08d-start-klein-mit-raeumen");
  expect(over, "Start-Tab scrollt").toBeLessThanOrEqual(1);
});
