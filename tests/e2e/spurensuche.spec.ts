import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot, startLocal } from "./util";

/**
 * Ein Schritt am Handy für alle: Sichtschutz weg, würfeln, ziehen (lieber in einen Raum), verdächtigen,
 * widerlegen, Zug beenden. Gibt zurück, was getan wurde.
 */
async function step(p: Page): Promise<string | null> {
  const t = { timeout: 2000 };
  const cover = p.getByRole("button", { name: /Karten zeigen/ });
  if (await cover.isVisible()) { await cover.click(t).catch(() => {}); return "cover"; }
  if (await p.getByTestId("refute").isVisible()) { await p.getByTestId("refute").getByRole("button").first().click(t).catch(() => {}); return "refute"; }
  if (await p.getByTestId("suggest").isVisible()) {
    await p.getByTestId("pick-s-doktor").click(t).catch(() => {});
    await p.getByTestId("pick-w-gift").click(t).catch(() => {});
    await p.getByTestId("suggest-go").click(t).catch(() => {});
    return "suggest";
  }
  if (await p.getByTestId("roll").isVisible()) { await p.getByTestId("roll").click(t).catch(() => {}); return "roll"; }
  const room = p.locator("[data-testid^='room-']:not([data-testid^='room-static'])").first();
  if (await room.count()) { await room.click(t).catch(() => {}); return "room"; }
  const cell = p.locator("[data-testid^='cell-']").last();
  if (await cell.count()) { await cell.click(t).catch(() => {}); return "cell"; }
  if (await p.getByTestId("end").isVisible()) { await p.getByTestId("end").click(t).catch(() => {}); return "end"; }
  return null;
}

test("Spurensuche an einem Handy für alle: Sichtschutz, würfeln, ziehen, verdächtigen, widerlegen, Notizblock – ohne Scrollen", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startLocal(page, "spurensuche", ["Anna", "Ben", "Cem"]);
  await expect(page.getByTestId("handoff")).toBeVisible();
  await expectNoScroll(page);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(page.getByTestId("house")).toBeVisible();
  await expect(page.getByTestId("hand")).toBeVisible();
  await expect(page.getByTestId("roll")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "spurensuche-zug");

  // Würfeln: erreichbare Felder leuchten
  await page.getByTestId("roll").click();
  await expect(page.locator("[data-testid^='cell-'], [data-testid^='room-']:not([data-testid^='room-static'])").first()).toBeVisible();
  await shot(page, "spurensuche-wuerfeln");

  // Notizblock: eigene Karten sind schon gestrichen
  await page.getByTestId("notes-open").click();
  await expect(page.getByTestId("notebook")).toBeVisible();
  await expect(page.getByTestId("notebook").getByText("deine").first()).toBeVisible();
  await shot(page, "spurensuche-notizen");
  await page.keyboard.press("Escape");

  // Weiterspielen, bis ein Verdacht geäußert und widerlegt (oder nicht widerlegt) wurde
  const done = new Set<string>();
  for (let i = 0; i < 400 && !(done.has("suggest") && (done.has("refute") || await page.getByTestId("shown-to-me").isVisible() || await page.getByTestId("no-refute").isVisible())); i++) {
    const what = await step(page);
    if (what) done.add(what);
    if (what === "suggest") { await page.waitForTimeout(300); await expectNoScroll(page); await shot(page, "spurensuche-verdacht"); }
    if (!what) await page.waitForTimeout(150);
  }
  expect(done.has("suggest")).toBe(true);
  await expectNoScroll(page);
  await shot(page, "spurensuche-nach-verdacht");
});

test("Spurensuche: Brett passt auch auf ein kleines Handy (360×640)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startLocal(page, "spurensuche", ["Anna", "Ben", "Cem", "Dora"]);
  await page.getByRole("button", { name: /Karten zeigen/ }).click();
  await expect(page.getByTestId("house")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "spurensuche-klein");
});

test("Spurensuche online mit drei Handys: jeder sieht nur seine Karten, wer dran ist, würfelt und zieht", async ({ browser }) => {
  test.setTimeout(180_000);
  const anna = await newPhone(browser), ben = await newPhone(browser), cem = await newPhone(browser);
  const code = await createRoom(anna, "spurensuche", "Anna", "4747");
  await joinRoom(ben, code, "Ben", "4747");
  await joinRoom(cem, code, "Cem", "4747");
  await expect(anna.getByText("Cem", { exact: true }).first()).toBeVisible();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  const phones = [anna, ben, cem];
  for (const p of phones) {
    await expect(p.getByTestId("house")).toBeVisible();
    await expect(p.getByTestId("hand")).toBeVisible();
  }
  // Je 6 Karten, keine doppelt
  const hands = await Promise.all(phones.map((p) => p.getByTestId("hand").locator("button").allTextContents()));
  expect(hands.every((h) => h.length === 6)).toBe(true);
  expect(new Set(hands.flat()).size).toBe(18);
  // Wer dran ist, hat den Würfeln-Knopf – nur einer
  const rollers = [];
  for (const p of phones) if (await p.getByTestId("roll").isVisible()) rollers.push(p);
  expect(rollers).toHaveLength(1);
  const cur = rollers[0];
  await cur.getByTestId("roll").click();
  const target = cur.locator("[data-testid^='room-']:not([data-testid^='room-static']), [data-testid^='cell-']").first();
  await expect(target).toBeVisible();
  await target.click();
  await expect(cur.getByTestId("status")).not.toContainText("gewürfelt");
  await expectNoScroll(cur);
  await shot(cur, "spurensuche-online");
});

test("Spurensuche am echten Brett: jedes Handy ist der Notizblock – eigene Karten, Verdacht eintragen, App kreuzt an", async ({ browser }) => {
  test.setTimeout(180_000);
  const anna = await newPhone(browser), ben = await newPhone(browser), cem = await newPhone(browser);
  const code = await createRoom(anna, "spurensuche", "Anna", "5858");
  await openSettings(anna);
  await anna.getByRole("radio", { name: /Echtes Brettspiel/ }).click();
  await closeSettings(anna);
  await joinRoom(ben, code, "Ben", "5858");
  await joinRoom(cem, code, "Cem", "5858");
  await expect(anna.getByText("Cem", { exact: true }).first()).toBeVisible();
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of [anna, ben, cem]) await expect(p.getByTestId("sheet")).toBeVisible();
  await expect(anna.getByTestId("house")).toHaveCount(0);
  await expectNoScroll(anna);
  await shot(anna, "spurensuche-notizblock-leer");

  // Meine Karten: drei antippen – sie fallen weg
  await anna.getByTestId("mine-open").click();
  for (const c of ["s:graefin", "w:gift", "r:turm"]) await anna.getByTestId(`mine-${c}`).click();
  await anna.getByTestId("mine-done").click();
  await expect(anna.getByTestId("row-s:graefin")).toHaveClass(/line-through/);

  // Verdacht: ich frage, Ben zeigt mir den Seidenschal
  await anna.getByTestId("entry-open").click();
  for (const c of ["s:doktor", "w:schal", "r:kaminhalle"]) await anna.getByTestId(`e-${c}`).click();
  await anna.locator("[data-testid^='shower-']").first().click();
  await anna.getByTestId("shown-w:schal").click();
  await shot(anna, "spurensuche-verdacht-eintragen");
  await anna.getByTestId("entry-save").click();
  await expect(anna.getByTestId("row-w:schal")).toHaveClass(/line-through/);
  await expectNoScroll(anna);
  await shot(anna, "spurensuche-notizblock");

  // Hand-Eintrag in einer leeren Zelle: ✗, ✓, ?
  const free = anna.locator("[data-testid^='cell-r:weinkeller-']").last();
  await free.click();
  await expect(free).toHaveText("✗");

  // Legende und eigene Notizen
  await expect(anna.getByTestId("legend")).toContainText("hat sie nicht");
  await anna.getByTestId("text-open").click();
  await anna.getByTestId("text-area").fill("Cem fragt dauernd nach dem Weinkeller");
  await anna.getByTestId("text-save").click();
  await expect(anna.getByTestId("text-open")).toContainText("•");
  await anna.getByTestId("text-open").click();
  await expect(anna.getByTestId("text-area")).toHaveValue("Cem fragt dauernd nach dem Weinkeller");
  await shot(anna, "spurensuche-eigene-notiz");
  await anna.getByTestId("text-save").click();

  // Namen wie in der eigenen Schachtel – als Liste
  await anna.getByTestId("names-open").click();
  await anna.getByTestId("names-list").click();
  await anna.getByTestId("names-list-r").fill("Arbeitszimmer\nHalle\nSalon\nBibliothek\nSpeisezimmer\nBillardzimmer\nWintergarten\nMusikzimmer\nKüche");
  await shot(anna, "spurensuche-namen-liste");
  await anna.getByTestId("names-save").click();
  await expect(anna.getByTestId("sheet")).toContainText("Wintergarten");
  // … und die anderen Handys bekommen die Namen der Spielleitung automatisch
  await expect(ben.getByTestId("sheet")).toContainText("Wintergarten");
  await expect(cem.getByTestId("sheet")).toContainText("Billardzimmer");

  // Kleines Handy passt auch
  await ben.setViewportSize({ width: 360, height: 640 });
  await expectNoScroll(ben);
  await shot(ben, "spurensuche-notizblock-klein");

  // Spielleitung: Fall gelöst
  await anna.getByTestId("finish-open").click();
  await anna.locator("[data-testid^='winner-']").first().click();
  await expect(anna.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
});
