import { expect, test, type Browser, type Page } from "@playwright/test";
import { createRoom, expectInView, expectNoScroll, joinRoom, newPhone, shot } from "./util";

/** Fernseher als Großer Tisch */
async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

async function joinByLink(browser: Browser, code: string, pin: string, name: string): Promise<Page> {
  const phone = await newPhone(browser);
  await phone.goto(`/r/${code}#pin=${pin}`);
  await expect(phone.getByLabel("PIN")).toHaveValue(pin);
  await phone.getByLabel("Dein Name").fill(name);
  await phone.getByRole("button", { name: "Beitreten" }).click();
  return phone;
}

/** Host: Abstimmung mit genau diesen Spielen starten */
async function startVote(host: Page, games: string[]) {
  await host.getByTestId("vote-open").click();
  const sheet = host.getByTestId("vote-games");
  await expect(sheet.locator("[aria-pressed=true]").first()).toBeVisible();
  const on = sheet.locator("[aria-pressed=true]");
  for (let n = await on.count(); n > 0; n--) { await on.first().click(); await expect(on).toHaveCount(n - 1); }
  for (const g of games) await host.getByTestId(`vote-pick-${g}`).click();
  await host.getByTestId("vote-start").click();
  await expect(host.getByTestId("vote")).toBeVisible();
}

test("Abstimmen: Host und zwei Handys stimmen ab, Fernseher zählt live mit, der Gewinner startet", async ({ browser }) => {
  const screen = await newScreen(browser);
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  const anna = await joinByLink(browser, code, pin, "Anna");
  const ben = await joinByLink(browser, code, pin, "Ben");
  const cem = await joinByLink(browser, code, pin, "Cem");
  await expect(screen.getByTestId("table-seat")).toHaveCount(3);
  await anna.getByTestId("meet-play").click();
  await anna.getByTestId("pick-maumau").click();
  await expect(anna.getByTestId("vote-open")).toBeVisible();
  await expectNoScroll(anna);
  await shot(anna, "ux-party-lobby-390");
  // Mitspieler sehen keinen Abstimm-Knopf
  await expect(ben.getByText(/Warte, bis der Host/)).toBeVisible();
  await expect(ben.getByTestId("vote-open")).toHaveCount(0);

  await anna.getByTestId("vote-open").click();
  await expect(anna.getByTestId("vote-start")).toBeEnabled();
  await shot(anna, "ux-party-vote-setup-390");
  await anna.keyboard.press("Escape");
  await expect(anna.getByTestId("vote-games")).toBeHidden();
  await startVote(anna, ["eins", "alles", "maumau"]);
  await expect(ben.getByTestId("vote")).toBeVisible();
  await expect(screen.getByTestId("vote-board")).toBeVisible();

  await ben.getByTestId("vote-eins").click();
  await expect(anna.getByTestId("vote-count-eins")).toHaveText("1");
  await expect(screen.getByTestId("vote-board-eins")).toHaveText("1");
  await anna.getByTestId("vote-alles").click();
  await expect(cem.getByTestId("vote-count-alles")).toHaveText("1");
  await expect(cem.getByTestId("vote")).toContainText("2 von 3 gewählt");
  await expectInView(cem, cem.getByTestId("vote-maumau"));
  await shot(cem, "ux-party-vote-390");
  await cem.setViewportSize({ width: 320, height: 568 });
  await expectInView(cem, cem.getByTestId("vote-maumau"));
  await shot(cem, "ux-party-vote-320");
  await screen.screenshot({ path: "screenshots/ux-party-vote-tv.png" });
  // Letzte Stimme: sofort entschieden, Eins! startet überall
  await cem.getByTestId("vote-eins").click();
  for (const p of [anna, ben, cem]) {
    await expect(p.getByTestId("vote")).toBeHidden();
    await expect(p.getByRole("banner")).toContainText("Eins!");
  }
  await expect(screen.getByTestId("table-view")).toContainText("Eins!");
});

test("Abstimmen: Host wertet vorzeitig aus oder bricht ab, sonst entscheidet nach Ablauf die Zeit", async ({ browser }) => {
  test.setTimeout(90_000);
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const cem = await newPhone(browser);
  const code = await createRoom(anna, "maumau", "Anna", "4747");
  await joinRoom(ben, code, "Ben", "4747");
  await joinRoom(cem, code, "Cem", "4747");
  await anna.setViewportSize({ width: 320, height: 568 });
  await shot(anna, "ux-party-lobby-320");

  // Abbrechen: Lobby bleibt, wie sie war
  await startVote(anna, ["eins", "alles"]);
  await expect(ben.getByTestId("vote")).toBeVisible();
  await expectInView(anna, anna.getByTestId("vote-end"));
  await shot(anna, "ux-party-vote-host-320");
  await anna.getByTestId("vote-cancel").click();
  await expect(ben.getByTestId("vote")).toBeHidden();
  await expect(anna.getByTestId("game-card")).toContainText("Mau-Mau");

  // Host wertet aus, ohne auf Cem zu warten
  await startVote(anna, ["eins", "alles"]);
  await ben.getByTestId("vote-alles").click();
  await expect(anna.getByTestId("vote-count-alles")).toHaveText("1");
  await anna.getByTestId("vote-end").click();
  await expect(cem.getByRole("banner")).toContainText("Alles oder nichts");
  await anna.getByRole("button", { name: "Menü" }).click();
  await anna.getByRole("button", { name: /Partie beenden/ }).click();
  await anna.getByRole("button", { name: "Beenden", exact: true }).click();
  await expect(anna.getByTestId("vote-open")).toBeVisible();

  // Niemand außer Ben stimmt ab: nach 30 Sekunden entscheidet die Zeit (Cem und der Host halten nichts auf)
  await startVote(anna, ["eins", "maumau"]);
  await ben.getByTestId("vote-maumau").click();
  await expect(ben.getByRole("banner")).toContainText("Mau-Mau", { timeout: 40_000 });
  await expect(anna.getByTestId("vote")).toBeHidden();
});

test("Nach der Partie abstimmen, Partyabend mit kurzen Runden", async ({ browser }) => {
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "vier", "Anna", "4848");
  await joinRoom(ben, code, "Ben", "4848");
  // Partyabend planen: Vier in einer Reihe und Eins! mit kurzen Runden
  await anna.getByTestId("plan-open").click();
  await anna.getByTestId("plan-vier").click();
  await anna.getByTestId("plan-eins").click();
  await anna.getByTestId("plan-next").click();
  await anna.getByTestId("plan-short").click();
  await expectInView(anna, anna.getByTestId("plan-start"));
  await shot(anna, "ux-party-plan-short-390");
  await anna.getByTestId("plan-start").click();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  const col = (p: Page, c: number) => p.getByRole("button", { name: `Spalte ${c}`, exact: true });
  for (const [p, c] of [[anna, 1], [ben, 2], [anna, 1], [ben, 2], [anna, 1], [ben, 2], [anna, 1]] as const) {
    await expect(p.getByTestId("duel-0")).toBeVisible();
    await col(p, c).click();
    await p.waitForTimeout(250);
  }
  await expect(anna.getByTestId("winner")).toHaveText("Du gewinnst!");
  await expect(anna.getByTestId("vote-open")).toBeVisible();
  await expectNoScroll(anna);
  await shot(anna, "ux-party-result-390");
  await anna.setViewportSize({ width: 320, height: 568 });
  await expectInView(anna, anna.getByTestId("vote-open"));
  await shot(anna, "ux-party-result-320");
  // Vorschläge: die offenen Spiele des Plans
  await anna.getByTestId("vote-open").click();
  await expect(anna.getByTestId("vote-games").locator("button").first()).toHaveAttribute("data-testid", "vote-pick-eins");
  await anna.keyboard.press("Escape");
  await expect(anna.getByTestId("vote-games")).toBeHidden();
  await startVote(anna, ["eins", "vier"]);
  await anna.getByTestId("vote-vier").click();
  await ben.getByTestId("vote-eins").click();
  // Gleichstand: der Zufall entscheidet, eins der beiden startet
  await expect(ben.getByTestId("vote")).toBeHidden();
  await expect(ben.getByRole("banner")).toContainText(/Eins!|Vier in einer Reihe/);
});
