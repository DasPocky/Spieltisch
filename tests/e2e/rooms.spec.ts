import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN_PW, expectNoScroll, newPhone, shot } from "./util";

/** Raum über „Raum öffnen“ mit eingeklappten Extras anlegen; gibt den Code zurück */
async function openRoom(page: Page, name: string, pin: string, extras?: (p: Page) => Promise<void>): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Raum öffnen" }).click();
  await page.getByLabel("Dein Name").fill(name);
  await page.getByLabel(/PIN/).fill(pin);
  if (extras) {
    await page.getByTestId("room-more").click();
    await extras(page);
  }
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  const code = page.url().split("/").pop()!;
  // Raum beginnt im Treffpunkt: Spiel wählen
  await page.getByTestId("meet-play").click();
  await page.getByTestId("pick-eins").click();
  return code;
}

async function knock(browser: Browser, code: string, name: string, pin: string): Promise<Page> {
  const page = await newPhone(browser);
  await page.goto(`/r/${code}`);
  await page.getByLabel("Dein Name").fill(name);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Beitreten" }).click();
  return page;
}

test("Anklopfen: Host lässt ein, sagt „Moment“ oder lehnt ab", async ({ browser }) => {
  const anna = await newPhone(browser);
  const code = await openRoom(anna, "Anna", "2468", async (p) => {
    await p.getByLabel("Raumname (optional)").fill("Donnerstagsrunde");
    await p.getByRole("radio", { name: /Anklopfen/ }).click();
    await shot(p, "07-raum-mehr");
  });

  // Ben: PIN stimmt, wartet vor der Tür
  const ben = await knock(browser, code, "Ben", "2468");
  await expect(ben.getByRole("heading", { name: "Du klopfst an …" })).toBeVisible();
  await shot(ben, "07b-anklopfen");
  await expect(anna.getByTestId("knock-bar")).toContainText("Ben klopft an");
  await expectNoScroll(anna);
  await shot(anna, "07c-anklopfen-host");
  await anna.getByTestId("knock-bar").getByRole("button", { name: "Einlassen" }).click();
  await expect(ben.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible();
  await expect(anna.getByTestId("knock-bar")).toHaveCount(0);

  // Cem: Anna sagt „Moment“ – dann entscheidet nur sie, Ben sieht keine Knöpfe
  const cem = await knock(browser, code, "Cem", "2468");
  await expect(anna.getByTestId("knock-bar")).toContainText("Cem klopft an");
  await anna.getByRole("button", { name: "Moment" }).click();
  await expect(ben.getByTestId("knock-bar")).toContainText("Anna entscheidet gleich");
  await expect(ben.getByTestId("knock-bar").getByRole("button")).toHaveCount(0);
  await anna.getByTestId("knock-bar").getByRole("button", { name: "Ablehnen" }).click();
  await expect(cem.getByRole("alert")).toContainText("nicht hereingelassen");
  // Gleich nochmal anklopfen geht erst nach einer Minute
  await cem.getByLabel("PIN").fill("2468");
  await cem.getByRole("button", { name: "Beitreten" }).click();
  await expect(cem.getByRole("alert")).toContainText("in einer Minute");

  // Host ist weg: Ben darf entscheiden
  await anna.context().close();
  const dora = await knock(browser, code, "Dora", "2468");
  await expect(ben.getByTestId("knock-bar")).toContainText("Host ist offline", { timeout: 40_000 });
  await ben.getByTestId("knock-bar").getByRole("button", { name: "Einlassen" }).click();
  await expect(dora.getByText(/Warte, bis der Host|Host übernehmen/).first()).toBeVisible();
});

test("Raum & Zugang im Menü: Host ändert, alle sehen es", async ({ browser }) => {
  const anna = await newPhone(browser);
  const code = await openRoom(anna, "Anna", "1357");
  const ben = await knock(browser, code, "Ben", "1357");
  await expect(ben.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible();
  await anna.getByRole("button", { name: "Menü" }).click();
  await anna.getByTestId("room-settings").getByRole("button").first().click();
  await expect(anna.getByTestId("room-settings")).toContainText("Alle · PIN · 1 Stunde");
  await anna.getByLabel("Raumname (optional)").fill("Spieleabend");
  await anna.getByRole("radio", { name: /Niemand/ }).click();
  await anna.getByRole("radio", { name: /1 Tag/ }).click();
  await shot(anna, "07d-raum-zugang");
  await anna.getByRole("button", { name: "Übernehmen" }).click();
  await ben.getByRole("button", { name: "Menü" }).click();
  await expect(ben.getByTestId("room-settings")).toContainText("Niemand · PIN · 1 Tag");
  await ben.getByTestId("room-settings").getByRole("button").first().click();
  await expect(ben.getByLabel("Raumname (optional)")).toHaveValue("Spieleabend");
  await expect(ben.getByLabel("Raumname (optional)")).toBeDisabled();
});

test("Dauerraum vom Admin: erster Gast wird Host, Raum bleibt nach dem Verlassen", async ({ browser, request }) => {
  const res = await request.post("/api/admin/rooms/create", { data: { password: ADMIN_PW, pin: "9999", room: { name: "Stammtisch", admission: "knock" } } });
  expect(res.status()).toBe(201);
  const { code } = await res.json();
  // Niemand da, der öffnen könnte: die PIN reicht, wer zuerst kommt, ist Host
  const eva = await knock(browser, code, "Eva", "9999");
  await expect(eva.getByTestId("meet-play")).toHaveText("Spiel wählen");
  await eva.getByRole("button", { name: "Menü" }).click();
  await eva.getByTestId("room-settings").getByRole("button").first().click();
  await expect(eva.getByTestId("room-settings")).toContainText("Dauerraum");
  await eva.context().close();
  expect((await (await request.get(`/api/rooms/${code}`)).json()).exists).toBe(true);
});

test("Anklopfen mit Funkloch: kurz weg ist kein Drama – weder beim Gast noch beim Host", async ({ browser }) => {
  const anna = await newPhone(browser);
  const code = await openRoom(anna, "Anna", "3141", async (p) => { await p.getByRole("radio", { name: /Anklopfen/ }).click(); });
  const ben = await knock(browser, code, "Ben", "3141");
  await expect(anna.getByTestId("knock-bar")).toContainText("Ben klopft an");

  // Ben hat ein Funkloch – Anna lässt ihn trotzdem ein, nach dem Wiederverbinden ist er drin
  await ben.context().setOffline(true);
  await anna.waitForTimeout(1500);
  await expect(anna.getByTestId("knock-bar")).toContainText("Ben klopft an");
  await anna.getByTestId("knock-bar").getByRole("button", { name: "Einlassen" }).click();
  await anna.waitForTimeout(1500);
  await ben.context().setOffline(false);
  await expect(ben.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible({ timeout: 25_000 });
  await expect(anna.getByText("Ben", { exact: true })).toBeVisible();

  // Anna hat ein kurzes Funkloch, während Cem anklopft: Ben übernimmt nicht sofort
  const cem = await knock(browser, code, "Cem", "3141");
  await expect(ben.getByTestId("knock-bar")).toContainText("Cem klopft an");
  await anna.context().setOffline(true);
  await ben.waitForTimeout(5000);
  await expect(ben.getByTestId("knock-bar").getByRole("button", { name: "Einlassen" })).toHaveCount(0);
  await anna.context().setOffline(false);
  await expect(anna.getByTestId("knock-bar")).toContainText("Cem klopft an", { timeout: 25_000 });
  await anna.getByTestId("knock-bar").getByRole("button", { name: "Einlassen" }).click();
  await expect(cem.getByText("Warte, bis der Host das Spiel startet …")).toBeVisible({ timeout: 15_000 });
});
