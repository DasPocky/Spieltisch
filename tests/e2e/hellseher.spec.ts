import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

async function local(page: Page, names: string[], opts: { table?: boolean; noEven?: boolean; half?: boolean } = {}) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/hellseher/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (opts.table || opts.noEven || opts.half) {
    await openSettings(page);
    if (opts.table) await page.getByRole("radio", { name: /Echte Karten/ }).click();
    if (opts.half) await page.getByRole("radio", { name: /Halbe Partie/ }).click();
    if (opts.noEven) {
      await page.getByRole("button", { name: /Hausregeln/ }).click();
      await page.getByText("Ansagen dürfen nicht aufgehen").click();
    }
    await closeSettings(page);
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

/** Ein Schritt auf diesem Handy: Sichtschutz weg, Trumpf wählen, ansagen oder eine erlaubte Karte spielen. true, wenn etwas getan wurde. */
async function step(p: Page): Promise<boolean> {
  const cover = p.getByRole("button", { name: /Karten zeigen/ });
  if (await cover.isVisible()) { await cover.click(); return true; }
  const trump = p.getByRole("group", { name: "Trumpf wählen" });
  if (await trump.isVisible()) { await trump.getByRole("button").first().click(); return true; }
  const bids = p.getByRole("group", { name: "Ansage" }).locator("button:not([disabled])");
  if (await bids.count()) { await bids.first().click(); return true; }
  const cards = p.getByTestId("hand").locator("button:not([disabled])");
  if (await cards.count()) { await cards.first().click(); return true; }
  return false;
}

test("Hellseher lokal: weitergeben, ansagen, Stiche spielen – passt auf 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await local(page, ["Anna", "Ben", "Cem"]);
  await expect(page.getByTestId("handoff")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "hs-handoff-320");
  let shotBid = false;
  let shotPlay = false;
  // Runde 1 und 2 durchspielen
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < 60 && !(await page.getByTestId("round-summary").isVisible()); i++) {
      if (!shotBid && (await page.getByRole("group", { name: "Ansage" }).isVisible())) { await expectNoScroll(page); await shot(page, "hs-bid-320"); shotBid = true; }
      if (round === 2 && !shotPlay && (await page.getByTestId("trick").isVisible()) && (await page.getByTestId("hand").locator("button:not([disabled])").count())) {
        await expectNoScroll(page); await shot(page, "hs-play-320"); shotPlay = true;
      }
      await step(page);
      await page.waitForTimeout(120);
    }
    await expect(page.getByTestId("round-summary")).toBeVisible();
    await expectNoScroll(page);
    if (round === 2) await shot(page, "hs-summary-320");
    await page.getByRole("button", { name: `Runde ${round + 1} geben` }).click();
  }
  await expect(page.getByTestId("round")).toHaveText("Runde 3/20");
  // Verlauf: Leiste oben und „Spieler & Verlauf“
  await page.getByTestId("infobar").click();
  await expect(page.getByTestId("overview")).toContainText("Ansage");
  await expect(page.getByTestId("history")).toContainText("Ansage/Stiche");
});

test("Hellseher online: drei Handys, jeder sieht nur seine Karten", async ({ browser }) => {
  const [anna, ben, cem] = await Promise.all([newPhone(browser), newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "hellseher", "Anna", "4242");
  await joinRoom(ben, code, "Ben", "4242");
  await joinRoom(cem, code, "Cem", "4242");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of [anna, ben, cem]) await expect(p.getByTestId("hand").getByRole("img")).toHaveCount(1);
  await expectNoScroll(anna);
  await shot(anna, "hs-online");
  // Nur einer kann gerade etwas tun
  const active = async () => {
    let n = 0;
    for (const p of [anna, ben, cem]) {
      if ((await p.getByRole("group", { name: "Ansage" }).isVisible()) || (await p.getByRole("group", { name: "Trumpf wählen" }).isVisible())
        || (await p.getByTestId("hand").locator("button:not([disabled])").count())) n++;
    }
    return n;
  };
  await expect.poll(active).toBe(1);
  for (let i = 0; i < 40 && !(await anna.getByTestId("round-summary").isVisible()); i++) {
    for (const p of [anna, ben, cem]) if (await step(p)) await p.waitForTimeout(250);
  }
  for (const p of [anna, ben, cem]) await expect(p.getByTestId("round-summary")).toBeVisible();
  await shot(ben, "hs-online-summary");
  await ben.getByRole("button", { name: "Runde 2 geben" }).click();
  for (const p of [anna, ben, cem]) await expect(p.getByTestId("hand").getByRole("img")).toHaveCount(2);
});

/** Stepper auf einen Wert bringen (leer → 0 mit −) */
async function setTo(page: Page, label: string, n: number) {
  const val = page.getByTestId(`val-${label}`);
  if ((await val.textContent()) === "–") await page.getByRole("button", { name: `${label} weniger` }).click();
  await expect(val).not.toHaveText("–");
  for (let i = 0; i < 25; i++) {
    const v = Number(await val.textContent());
    if (v === n) return;
    await page.getByRole("button", { name: `${label} ${v < n ? "mehr" : "weniger"}` }).click();
    await expect(val).toHaveText(String(v < n ? v + 1 : v - 1));
  }
}

test("Hellseher mit echten Karten: Block für Ansagen und Stiche, Hinweis wenn es aufgeht", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await local(page, ["Anna", "Ben", "Cem"], { table: true, noEven: true });
  await expect(page.getByTestId("round")).toHaveText("1 Karte · Cem gibt");
  await setTo(page, "Ansage Anna", 1);
  await setTo(page, "Ansage Ben", 0);
  await setTo(page, "Ansage Cem", 0);
  await expect(page.getByTestId("even")).toContainText("nicht erlaubt");
  await expect(page.getByRole("button", { name: "Geber muss anders ansagen" })).toBeDisabled();
  await expectNoScroll(page);
  await shot(page, "hs-table-bids");
  await setTo(page, "Ansage Cem", 1);
  await page.getByRole("button", { name: /Ansagen fertig/ }).click();
  await setTo(page, "Stiche Anna", 1);
  await setTo(page, "Stiche Ben", 0);
  await setTo(page, "Stiche Cem", 1);
  await expect(page.getByRole("button", { name: "Stiche stimmen nicht" })).toBeDisabled();
  await setTo(page, "Stiche Cem", 0);
  await expectNoScroll(page);
  await shot(page, "hs-table-tricks");
  await page.getByRole("button", { name: "Runde 1 werten" }).click();
  await expect(page.getByTestId("round")).toHaveText("2 Karten · Anna gibt");
  await expect(page.getByText("30", { exact: true })).toBeVisible();
  await expect(page.getByText("-10", { exact: true })).toBeVisible();
});

test("Hellseher mit echten Karten bis zum Ergebnis (6 Spieler, halbe Partie)", async ({ page }) => {
  test.setTimeout(180_000);
  const names = ["Anna", "Ben", "Cem", "Dora", "Emil", "Fritz"];
  await local(page, names, { table: true, half: true });
  for (let round = 1; round <= 5; round++) {
    for (const n of names) await setTo(page, `Ansage ${n}`, n === "Anna" ? round : 0);
    await expect(page.getByTestId("even")).toContainText("Ansagen gehen auf");
    if (round === 1) { await expectNoScroll(page); await shot(page, "hs-table-6"); }
    await page.getByRole("button", { name: /Ansagen fertig/ }).click();
    for (const n of names) await setTo(page, `Stiche ${n}`, n === "Anna" ? round : 0);
    await page.getByRole("button", { name: `Runde ${round} werten` }).click();
  }
  await expect(page.getByTestId("winner")).toHaveText("Anna");
  await expectNoScroll(page);
  await shot(page, "hs-result");
});

test("Hellseher Lobby: Modus, Spieldauer und Hausregeln", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/hellseher/lokal");
  await openSettings(page);
  await page.getByRole("button", { name: /Hausregeln/ }).click();
  await expect(page.getByText("Ansagen dürfen nicht aufgehen")).toBeVisible();
  await expect(page.getByText("Verdeckt ansagen")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Echte Karten/ })).toBeVisible();
  await shot(page, "hs-settings");
  // Verdeckt ansagen blendet „nicht aufgehen“ aus (geht ohne festen Letzten nicht)
  await page.getByText("Verdeckt ansagen").click();
  await expect(page.getByText("Ansagen dürfen nicht aufgehen")).toHaveCount(0);
});

test("Hellseher verdeckt an einem Handy: jeder sagt geschützt an", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/hellseher/lokal");
  for (const n of ["Anna", "Ben", "Cem"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await openSettings(page);
  await page.getByRole("button", { name: /Hausregeln/ }).click();
  await page.getByText("Verdeckt ansagen").click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
  // Zauberer als Trumpfkarte: erst wählt der Geber (Cem)
  const trump = page.getByRole("group", { name: "Trumpf wählen" });
  if (await page.getByRole("button", { name: "Ich bin Cem – Karten zeigen" }).isVisible()) {
    await page.getByRole("button", { name: /Karten zeigen/ }).click();
    await trump.getByRole("button").first().click();
  }
  for (const name of ["Anna", "Ben", "Cem"]) {
    await expect(page.getByRole("button", { name: `Ich bin ${name} – Karten zeigen` })).toBeVisible();
    await page.getByRole("button", { name: /Karten zeigen/ }).click();
    // Fremde Ansagen bleiben verborgen – nur ein Häkchen zeigt, wer schon hat
    await expect(page.getByTestId("bidsum")).toHaveText("");
    if (name !== "Anna") await expect(page.locator('[data-testid^="bid-"]').first()).toHaveText("0/✓");
    await page.getByRole("button", { name: "0 ansagen" }).click();
  }
  await expect(page.getByTestId("bidsum")).toHaveText("0 von 1 angesagt");
});
