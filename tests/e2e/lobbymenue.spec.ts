import { expect, test } from "@playwright/test";
import { createRoom, expectNoScroll, expectSettingsFit, joinRoom, newPhone, openLocal, shot, unfoldSettings } from "./util";

/** Lobby mit klarer Rangfolge und Menü in Gruppen – Host und Gast, ohne Scrollen */
test("Lobby und Menü: Host und Gast sehen klare Gruppen, Gäste keine Host-Aktionen", async ({ browser }) => {
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "alles", "Anna", "4711");
  await joinRoom(ben, code, "Ben", "4711");
  await expect(anna.getByText("Ben", { exact: true })).toBeVisible();

  // Host: oben Spiel und Mitspieler, unten „Spiel starten“; Nebensachen in einer Zeile
  await expect(anna.getByTestId("lobby-more")).toBeVisible();
  await expect(anna.getByTestId("plan-open")).toBeVisible();
  await expect(anna.getByTestId("to-meet")).toBeVisible();
  await expectNoScroll(anna);
  await shot(anna, "ux2-lobby-host");

  // Gast: keine Host-Aktionen (Spiel wechseln, Partyabend planen, Treffpunkt)
  await expect(ben.getByTestId("plan-open")).toHaveCount(0);
  await expect(ben.getByTestId("to-meet")).toHaveCount(0);
  await expect(ben.getByTestId("game-card")).not.toContainText("Wechseln");
  await expectNoScroll(ben);
  await shot(ben, "ux2-lobby-gast");

  // Kleines Handy: weiterhin ohne Scrollen
  await anna.setViewportSize({ width: 320, height: 568 });
  await shot(anna, "ux2-lobby-host-klein");
  await expectNoScroll(anna);
  await anna.setViewportSize({ width: 390, height: 844 });

  // Menü in der Partie: Gruppen „Dieses Spiel“, „Raum“, „Mein Gerät“, unten Beenden
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await anna.getByRole("button", { name: "Menü" }).click();
  for (const t of ["Spielleitung", "Dieses Spiel", "Raum", "Mein Gerät", "Beenden"]) await expect(anna.getByRole("heading", { name: t, exact: true })).toBeVisible();
  await shot(anna, "ux2-menue-host");

  await ben.getByRole("button", { name: "Menü" }).click();
  await expect(ben.getByRole("heading", { name: "Spielleitung", exact: true })).toHaveCount(0);
  await expect(ben.getByText("Partie beenden")).toHaveCount(0);
  await expect(ben.getByText("Raum für alle schließen")).toHaveCount(0);
  for (const t of ["Dieses Spiel", "Raum", "Mein Gerät"]) await expect(ben.getByRole("heading", { name: t, exact: true })).toBeVisible();
  await shot(ben, "ux2-menue-gast");
});

/** Kleines Handy: Lobby mit 3 und 6 Spielern ohne Scrollen; Host-Aktionen bleiben per Antippen erreichbar. Großes Handy: 8 Spieler. */
test("Lobby: viele Mitspieler passen ohne Scrollen, auch auf kleinen Handys", async ({ browser }) => {
  const anna = await newPhone(browser);
  await anna.setViewportSize({ width: 320, height: 568 });
  const code = await createRoom(anna, "alles", "Anna", "4711");
  const names = ["Ben", "Cem", "Dana", "Eli", "Fia", "Gus", "Hanna"];
  const noScroll = async () => {
    await expectNoScroll(anna);
    const inner = await anna.evaluate(() => [...document.querySelectorAll("main, section, [data-testid=players]")].every((e) => e.scrollHeight <= e.clientHeight + 1));
    expect(inner, "ein Bereich scrollt").toBe(true);
  };
  for (const [i, name] of names.entries()) {
    const p = await newPhone(browser);
    await joinRoom(p, code, name, "4711");
    await expect(anna.getByText(name, { exact: true })).toBeVisible();
    const n = i + 2;
    if (n === 3 || n === 6) {
      await noScroll();
      if (n === 6) {
        await shot(anna, "reste-lobby-320-6");
        // Host-Aktionen: Entfernen direkt, Reihenfolge über Antippen des Avatars
        await expect(anna.getByRole("button", { name: "Fia entfernen" })).toBeVisible();
        await anna.getByRole("button", { name: "Avatar von Fia ändern" }).click();
        await expect(anna.getByRole("button", { name: "Weiter vor" })).toBeVisible();
        await anna.getByRole("button", { name: "Fertig" }).click();
        await anna.setViewportSize({ width: 390, height: 844 });
      }
    }
  }
  await noScroll();
  await shot(anna, "reste-lobby-390-8");
});

/** Spiele mit den meisten Einstellungen: das Blatt passt auf 360×640 ohne Scrollen, eingeklappte Bereiche lassen sich öffnen */
test.describe("Einstellungs-Blatt ohne Scrollen auf 360×640", () => {
  test.use({ viewport: { width: 360, height: 640 } });
  for (const id of ["werwolf", "einenacht", "erklaerspiel", "stirnraten", "stadtlandfluss", "quiz", "spion", "werbinich", "maumau", "ludo", "alles"]) {
    test(`Einstellungen ${id}: passt ohne Scrollen, alles erreichbar`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await openLocal(page, id);
      await page.getByTestId("settings-summary").click();
      await expectSettingsFit(page);
      if (["werwolf", "maumau", "ludo"].includes(id)) await shot(page, `einstellungen-${id}-360`);
      // Eingeklapptes wieder aufklappen: dann ist mehr zu sehen (und es darf scrollen)
      const before = await page.getByTestId("settings-body").locator("button, input").count();
      const folded = await page.getByTestId("settings-body").locator("[data-auto-collapsed]").count();
      await unfoldSettings(page);
      if (folded) expect(await page.getByTestId("settings-body").locator("button, input").count()).toBeGreaterThan(before);
      await expect(page.getByTestId("settings-body").locator("[data-auto-collapsed]")).toHaveCount(0);
    });
  }
});

test("Einstellungs-Blatt online beim Gast (360×640): passt ohne Scrollen", async ({ browser }) => {
  const host = await newPhone(browser);
  const code = await createRoom(host, "werwolf", "Anna", "5151");
  const guest = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" }).then((c) => c.newPage());
  await joinRoom(guest, code, "Ben", "5151");
  await guest.getByTestId("settings-summary").click();
  await expectSettingsFit(guest);
  await shot(guest, "einstellungen-werwolf-gast-360");
});
