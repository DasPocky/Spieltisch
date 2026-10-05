import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

/** Lokales Spiel mit Namen anlegen, Einstellungs-Radio wählen und starten */
async function local(page: Page, gameId: string, names: string[], radios: RegExp[]) {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/spiel/${gameId}/lokal`);
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await openSettings(page);
  for (const r of radios) await page.getByRole("radio", { name: r }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

test("Flip 7 mit echten Karten: Karten antippen, die App rechnet", async ({ page }) => {
  await local(page, "flip7", ["Anna", "Ben", "Cem"], [/Echte Karten/]);
  await page.getByRole("button", { name: "Karten von Anna wählen" }).click();
  for (const c of ["5", "12", "×2", "+4"]) await page.getByTestId("hand-pick").getByRole("button", { name: c, exact: true }).click();
  await expect(page.getByTestId("hand-points")).toHaveText("38");
  await shot(page, "75b-flip7-hand");
  await page.getByRole("button", { name: "Eintragen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Karten von Anna wählen" })).toHaveText("38 P.");
  for (const n of ["Ben", "Cem"]) {
    await page.getByRole("button", { name: `Karten von ${n} wählen` }).click();
    await page.getByRole("button", { name: "Raus – 0" }).click();
  }
  await page.getByRole("button", { name: "Runde 1 abschließen" }).click();
  await expect(page.getByTestId("pad-info")).toHaveText("Runde 2 · bis 200");
});

test("Flip 7 mit echten Karten: Punkteblock bis zum Ziel", async ({ page }) => {
  await local(page, "flip7", ["Anna", "Ben", "Cem"], [/Echte Karten/, /Punkte eintippen/]);
  await expect(page.getByTestId("pad-info")).toHaveText("Runde 1 · bis 200");
  for (const [n, p] of [["Anna", "120"], ["Ben", "35"], ["Cem", "0"]]) await page.getByLabel(`Punkte ${n}`).fill(p);
  await page.getByLabel("Punkte Cem").blur();
  await expectNoScroll(page);
  await shot(page, "75-flip7-table");
  await page.getByRole("button", { name: "Runde 1 abschließen" }).click();
  await expect(page.getByTestId("pad-info")).toHaveText("Runde 2 · bis 200");
  for (const [n, p] of [["Anna", "90"], ["Ben", "10"], ["Cem", "20"]]) await page.getByLabel(`Punkte ${n}`).fill(p);
  await page.getByLabel("Punkte Cem").blur();
  await page.getByRole("button", { name: "Runde 2 abschließen" }).click();
  await expect(page.getByText("mit 210 Punkten")).toBeVisible();
});

test("Mau-Mau mit echten Karten: Siege zählen, Hausregeln ausgeblendet", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/maumau/lokal");
  for (const n of ["Anna", "Ben"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await openSettings(page);
  await page.getByRole("button", { name: /Hausregeln/ }).click();
  await expect(page.getByText("Siebenen stapeln")).toBeVisible();
  await page.getByRole("radio", { name: /Echte Karten/ }).click();
  await expect(page.getByText("Siebenen stapeln")).toHaveCount(0);
  await page.getByRole("radio", { name: "3 Siege" }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await page.getByRole("button", { name: "Ben hat die Runde gewonnen" }).click();
  await expectNoScroll(page);
  await shot(page, "76-maumau-table");
  await page.getByRole("button", { name: "Ben hat die Runde gewonnen" }).click();
  await page.getByRole("button", { name: "Ben hat die Runde gewonnen" }).click();
  await expect(page.getByText("hat 3 Runden gewonnen")).toBeVisible();
});

test("Tutto mit echten Karten: gezogene Karte antippen", async ({ page }) => {
  await local(page, "tutto", ["Anna", "Ben"], [/Echte Karten/]);
  await page.getByRole("button", { name: "Karte ziehen" }).first().click();
  await expect(page.getByRole("dialog", { name: "Gezogene Karte wählen" })).toBeVisible();
  await shot(page, "77-tutto-realcards-picker");
  await page.getByRole("button", { name: "Bonus 300" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoScroll(page);
  await shot(page, "78-tutto-realcards");
});

test("Tutto Plus/Minus: nach dem Tutto nur eintragen, kein Weiterzocken", async ({ page }) => {
  await local(page, "tutto", ["Anna", "Ben"], [/Echte Karten/]);
  await page.getByRole("button", { name: "Karte ziehen" }).first().click();
  await page.getByRole("button", { name: "Plus/Minus" }).click();
  await page.getByRole("button", { name: /Tutto geschafft/ }).click();
  await expect(page.getByTestId("tutto-banner")).toContainText("Zug ist vorbei");
  await expect(page.getByRole("button", { name: /Weiterzocken/ })).toHaveCount(0);
  await page.getByRole("button", { name: /\+1\.000 eintragen/ }).click();
  await expect(page.getByTestId("current-player")).toHaveText("Ben");
});

test("Eine Nacht mit eigenen Karten: Host-Handy erzählt, andere sehen nur Augen zu", async ({ browser }) => {
  test.setTimeout(180_000);
  const [anna, ben, cem] = await Promise.all([newPhone(browser), newPhone(browser), newPhone(browser)]);
  await anna.addInitScript(() => { try { localStorage.setItem("spieltisch:werwolf:speech", "0"); } catch { /* about:blank */ } });
  const code = await createRoom(anna, "einenacht", "Anna", "4242");
  await joinRoom(ben, code, "Ben", "4242");
  await joinRoom(cem, code, "Cem", "4242");
  await openSettings(anna);
  await anna.getByRole("radio", { name: /Eigene Karten/ }).click();
  await closeSettings(anna);
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("own-roles")).toContainText("Werwolf");
  await anna.getByRole("button", { name: "Nacht beginnen" }).click();
  await expect(ben.getByText("Augen zu")).toBeVisible();
  await expect(ben.getByRole("button", { name: "Weiter" })).toHaveCount(0);
  await expectNoScroll(anna);
  await shot(anna, "79-einenacht-own-night");
  // Automatik läuft – der Host kann Schritte auch überspringen
  for (let i = 0; i < 200 && !(await anna.getByText("Aufdecken und eintragen").isVisible()); i++) {
    const skip = anna.getByRole("button", { name: "Schritt überspringen" });
    // Der Knopf kann genau beim Tippen verschwinden (Schritt endet von selbst) – dann einfach weiter
    if (await skip.isVisible()) await skip.click({ timeout: 1500 }).catch(() => {});
    await anna.waitForTimeout(250);
  }
  await expect(ben.getByText("Diskutiert!")).toBeVisible();
  await anna.getByRole("button", { name: "Werwölfe", exact: true }).click();
  await anna.getByRole("button", { name: /Cem/ }).click();
  await shot(anna, "80-einenacht-own-day");
  await anna.getByRole("button", { name: "Ergebnis eintragen" }).click();
  await expect(ben.getByTestId("own-winners")).toHaveText("Gewonnen: Cem");
});
