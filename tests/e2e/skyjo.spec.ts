import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

async function local(page: Page, names: string[], table = false) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/skyjo/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (table) {
    await openSettings(page);
    await page.getByRole("radio", { name: /Echte Karten/ }).click();
    await closeSettings(page);
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

const myCards = (p: Page) => p.getByRole("group", { name: "Deine Karten" }).getByRole("button");
/** Die k-te eigene Karte umdrehen und warten, bis der Server es bestätigt (ein verlorener Tipp wird wiederholt) */
async function flipOne(p: Page, k?: number) {
  // ohne k: die erste noch verdeckte Karte
  const labels = await myCards(p).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const card = myCards(p).nth(k ?? Math.max(0, labels.indexOf("verdeckte Karte")));
  for (let i = 0; i < 3; i++) {
    if ((await card.getAttribute("aria-label")) !== "verdeckte Karte") return;
    await card.click();
    try { await expect(card).not.toHaveAttribute("aria-label", "verdeckte Karte", { timeout: 3000 }); return; } catch { /* nochmal tippen */ }
  }
  await expect(card).not.toHaveAttribute("aria-label", "verdeckte Karte");
}

test("Skyjo lokal: aufdecken, ziehen, tauschen – passt auf 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await local(page, ["Anna", "Ben", "Cem"]);
  // jeder deckt zwei Karten auf (lokal nacheinander)
  for (let k = 0; k < 6; k++) await myCards(page).and(page.getByLabel("verdeckte Karte")).first().click();
  await expect(page.getByTestId("hint")).toContainText("Ziehe vom Stapel");
  await expectNoScroll(page);
  await page.getByRole("button", { name: /Vom Stapel ziehen/ }).click();
  await expect(page.getByTestId("drawn")).toBeVisible();
  await shot(page, "88-skyjo-320");
  await myCards(page).first().click();
  await expect(page.getByTestId("drawn")).toHaveCount(0);
});

test("Skyjo online: jeder sein Raster, offene Karten für alle", async ({ browser }) => {
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "skyjo", "Anna", "5656");
  await joinRoom(ben, code, "Ben", "5656");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of [anna, ben]) for (let k = 0; k < 2; k++) await flipOne(p, k);
  // wer beginnt, zieht vom Stapel und legt ab, dreht eine um
  // Erst wenn beide Handys den Stand nach dem Aufdecken haben, steht fest, wer beginnt
  await expect.poll(async () => [await anna.getByTestId("hint").textContent(), await ben.getByTestId("hint").textContent()].some((h) => h?.includes("Ziehe"))).toBe(true);
  const starter = (await anna.getByTestId("hint").textContent())!.includes("Ziehe") ? anna : ben;
  const other = starter === anna ? ben : anna;
  await expect(other.getByTestId("hint")).toContainText("Warte");
  await starter.getByRole("button", { name: /Vom Stapel ziehen/ }).click();
  await starter.getByRole("button", { name: "Ablegen & umdrehen" }).click();
  await expect(starter.getByTestId("hint")).toContainText("Dreh eine verdeckte Karte um");
  await flipOne(starter);
  await expect(other.getByTestId("hint")).toContainText("Ziehe");
  await expectNoScroll(other);
  await shot(other, "89-skyjo-online");
});

test("Skyjo mit echten Karten: Punkteblock mit Verdopplung", async ({ page }) => {
  await local(page, ["Anna", "Ben"], true);
  await page.getByLabel("Punkte Anna").fill("20");
  await page.getByLabel("Punkte Ben").fill("15");
  await page.getByLabel("Punkte Ben").blur();
  await page.getByRole("button", { name: "Anna hat beendet" }).click();
  await page.getByRole("button", { name: "Runde 1 abschließen" }).click();
  await expect(page.getByText("40", { exact: true })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "89b-skyjo-table");
});

test("Skyjo Spielhilfe: guter Tausch leuchtet auf der höchsten offenen Karte", async ({ page }) => {
  await local(page, ["Anna", "Ben"]);
  for (let k = 0; k < 4; k++) await myCards(page).and(page.getByLabel("verdeckte Karte")).first().click();
  await page.getByRole("button", { name: /Vom Stapel ziehen/ }).click();
  await expect(page.getByTestId("drawn")).toBeVisible();
  const drawn = Number((await page.getByTestId("drawn").getByRole("button").getAttribute("aria-label"))!.replace("Gezogen: ", ""));
  const open = (await myCards(page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))))
    .filter((l) => l?.startsWith("Karte ")).map((l) => Number(l!.slice(6)));
  const max = Math.max(...open);
  await expect(page.locator("[data-hint]")).toHaveCount(max > drawn ? open.filter((v) => v === max).length : 0);
});
