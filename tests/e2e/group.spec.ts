import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectInView, expectNoScroll, joinRoom, newPhone, openSettings } from "./util";

/** Screenshots zum Ansehen (nicht Teil der Doku-Bilder) */
const DIR = process.env.GROUP_SHOTS ?? "test-results/groups";
const snap = async (page: Page, name: string) => { await page.waitForTimeout(400); await page.screenshot({ path: `${DIR}/${name}.png` }); };

/** Tutto mit Ziel 1.000 schnell zu Ende spielen: bis eine Karte mit Würfelpunkten kommt, dann 1.000 eintragen */
async function finishTutto(page: Page) {
  await openSettings(page);
  const target = page.getByRole("button", { name: "Spielziel verringern" });
  for (let i = 0; i < 5; i++) await target.click();
  await expect(page.getByTestId("setting-target")).toHaveText("1.000");
  await closeSettings(page);
  await expect(page.getByTestId("settings-summary")).toContainText("Spielziel 1.000");
  await page.getByRole("button", { name: "Spiel starten" }).click();
  const k = page.getByRole("button", { name: "+1.000", exact: true });
  const pile = () => page.getByRole("banner").getByText(/Karten/).textContent();
  for (let i = 0; i < 40 && !(await k.isVisible()); i++) {
    const before = await pile();
    await page.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
    await expect.poll(pile).not.toBe(before);
    await page.waitForTimeout(100);
  }
  await k.click();
  await expect(page.getByTestId("turn-pts")).toHaveText("1.000");
  await page.getByRole("button", { name: /eintragen/ }).click();
  await expect(page.getByText(/mit 1\.000 Punkten/)).toBeVisible();
}

/** Spalten der Bestenliste: Name → [Siege, Partien] */
async function board(page: Page): Promise<Record<string, [number, number]>> {
  const rows = page.getByTestId("leaderboard").locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const out: Record<string, [number, number]> = {};
  for (const r of await rows.all()) {
    const cells = await r.locator("td").allTextContents();
    const name = (await r.locator("td").nth(1).locator(".truncate").textContent())!.replace(" (du)", "").trim();
    out[name] = [Number(cells[2]), Number(cells[3])];
  }
  return out;
}

test("Gruppe: erstellen, per Link beitreten, Avatare, lokale und Online-Partie zählen, Profil umziehen", async ({ browser }) => {
  test.setTimeout(150_000);
  const anna = await newPhone(browser);

  // Profil mit Name und Avatar
  await anna.goto("/profil");
  await anna.getByLabel("Dein Name").fill("Anna");
  await anna.getByRole("button", { name: "Speichern" }).click();
  await anna.getByRole("button", { name: "Avatar ändern" }).first().click();
  await anna.getByRole("radio", { name: "Emoji 🦊" }).click();
  await anna.getByRole("radio", { name: "Farbe 2" }).click();
  await expect(anna.getByTestId("my-avatar")).toContainText("🦊");
  await anna.getByRole("button", { name: "Fertig" }).click();

  // Startseite ohne Gruppe: kleiner Einstieg, kein Scrollen
  await anna.goto("/");
  await expect(anna.getByTestId("group-card")).toHaveText(/Gruppe erstellen oder beitreten/);
  await expectNoScroll(anna);
  await anna.getByTestId("group-card").click();
  await expect(anna).toHaveURL(/\/gruppe$/);
  await anna.getByLabel("Name der Gruppe").fill("Spieleabend");
  await snap(anna, "groups-new");
  await anna.getByRole("button", { name: "Gruppe erstellen" }).click();
  await expect(anna).toHaveURL(/\/g\/[A-Z0-9]{6}$/);
  await expect(anna.getByTestId("group-name")).toHaveText("Spieleabend");
  const code = (await anna.getByTestId("group-code").textContent())!.trim();
  await anna.getByRole("button", { name: "QR-Code" }).click();
  await expect(anna.getByTestId("qr").locator("path")).toBeVisible();

  // Zweites Handy über den Einladungslink
  const ben = await newPhone(browser);
  await ben.goto(`/g/${code}`);
  await expect(ben.getByRole("heading", { name: "Spieleabend" })).toBeVisible();
  await expect(ben.getByText("1 Mitglied · Code")).toBeVisible();
  await ben.getByLabel("Dein Name").fill("Ben");
  await snap(ben, "invite");
  await ben.getByRole("button", { name: "Beitreten" }).click();
  await expect(ben.getByTestId("members")).toContainText("Anna");
  await expect(ben.getByTestId("members")).toContainText("Ben (du)");
  // Annas Avatar ist bei Ben zu sehen
  await expect(ben.getByTestId("members")).toContainText("🦊");

  // Umbenennen darf jedes Mitglied
  await ben.getByRole("button", { name: "Gruppe umbenennen" }).click();
  await ben.getByLabel("Name der Gruppe").fill("Spieleabend Mo");
  await ben.getByRole("button", { name: "Namen speichern" }).click();
  await expect(ben.getByTestId("group-name")).toHaveText("Spieleabend Mo");

  // Lokal: Mitglieder per Tipp dazu, Ergebnis landet in der Bestenliste
  await anna.goto("/spiel/tutto/lokal");
  const picks = anna.getByTestId("group-picks");
  await expect(picks).toContainText("Spieleabend Mo");
  await picks.getByRole("button", { name: "Anna hinzufügen" }).click();
  await picks.getByRole("button", { name: "Ben hinzufügen" }).click();
  await expect(picks).toBeHidden();
  await expect(anna.locator("ol").getByText("🦊")).toBeVisible();
  await snap(anna, "lobby-local");
  await finishTutto(anna);
  await anna.goto(`/g/${code}`);
  await expect.poll(async () => Object.values(await board(anna)).reduce((n, [w, p]) => n + w * 10 + p, 0)).toBe(12);
  const local = await board(anna);
  expect(local.Anna[1]).toBe(1);
  expect(local.Ben[1]).toBe(1);
  await expect(anna.getByRole("radio", { name: "Tutto" })).toBeVisible();
  await snap(anna, "group");

  // Online: Lobby zeigt „An Gruppe senden“ und wer aus der Gruppe da ist
  const room = await createRoom(anna, "tutto", "Anna", "1357");
  await expect(anna.getByTestId("group-share")).toContainText("1 von 2 dabei");
  await expect(anna.getByRole("button", { name: "An Gruppe senden" })).toBeVisible();
  await joinRoom(ben, room, "Ben", "1357");
  await expect(anna.getByTestId("group-share")).toContainText("2 von 2 dabei");
  // Avatare in der Spielerliste
  await expect(anna.locator("ol").getByText("🦊")).toBeVisible();
  await snap(anna, "lobby-online");
  await ben.close();

  // Online allein gewinnen (Ben raus) – zählt für die Gruppe
  const solo = await createRoom(anna, "tutto", "Anna", "2468");
  expect(solo).toMatch(/^[A-Z0-9]{5}$/);
  await finishTutto(anna);
  await anna.goto(`/g/${code}`);
  await expect.poll(async () => (await board(anna)).Anna[1]).toBe(2);

  // Startseite mit Gruppe: Name und Beste, passt ohne Scrollen
  await anna.goto("/");
  await expect(anna.getByTestId("group-card")).toContainText("Spieleabend Mo");
  await expect(anna.getByTestId("group-card")).toContainText("Anna");
  await expectNoScroll(anna);
  await snap(anna, "home");
  await anna.setViewportSize({ width: 320, height: 568 });
  await anna.reload();
  await expect(anna.getByTestId("group-card")).toBeVisible();
  await expectNoScroll(anna);
  await expectInView(anna, anna.getByTestId("group-card"));
  await snap(anna, "home-small");
  await anna.setViewportSize({ width: 390, height: 844 });

  // Profil aufs neue Handy: Einmal-Code mit QR
  await anna.goto("/profil");
  await anna.getByRole("button", { name: "Code zum Übertragen anzeigen" }).click();
  const transfer = (await anna.getByTestId("transfer-code").textContent())!.trim();
  await expect(anna.getByTestId("transfer").getByTestId("qr").locator("path")).toBeVisible();
  await snap(anna, "profile");
  const neu = await newPhone(browser);
  await neu.goto(`/profil/uebernehmen/${transfer.replace("-", "")}`);
  await neu.getByRole("button", { name: "Profil übernehmen" }).click();
  await expect(neu).toHaveURL(/\/profil$/);
  await expect(neu.getByLabel("Dein Name")).toHaveValue("Anna");
  await expect(neu.getByTestId("my-avatar")).toContainText("🦊");
  await expect(neu.getByTestId("groups-card")).toContainText("Spieleabend Mo");
  await expect(neu.getByTestId("stats")).toContainText("Tutto");
  // Der Code gilt nur einmal
  const again = await newPhone(browser);
  await again.goto(`/profil/uebernehmen/${transfer.replace("-", "")}`);
  await again.getByRole("button", { name: "Profil übernehmen" }).click();
  await expect(again.getByRole("alert")).toContainText("abgelaufen oder schon benutzt");

  // Neues Handy ist gleich in der Gruppe
  await neu.goto("/");
  await expect(neu.getByTestId("group-card")).toContainText("Spieleabend Mo");

  // Dunkel
  await neu.evaluate(() => localStorage.setItem("spieltisch:theme", "dark"));
  await neu.goto(`/g/${code}`);
  await expect(neu.getByTestId("group-name")).toBeVisible();
  await snap(neu, "group-dark");
  await neu.goto("/");
  await snap(neu, "home-dark");

  // Austreten
  await neu.goto(`/g/${code}`);
  await neu.getByRole("button", { name: "Gruppe verlassen" }).click();
  await neu.getByRole("button", { name: "Verlassen", exact: true }).click();
  await expect(neu).toHaveURL(/\/$/);
  await expect(neu.getByTestId("group-card")).toHaveText(/Gruppe erstellen oder beitreten/);
});
