import { expect, test, type Browser, type Page } from "@playwright/test";
import { ALL_ON, captureSpeech, createRoom, expectNoScroll, joinRoom, newPhone, setConfig, shot, spoken, startLocal } from "./util";

/** Figur von `who`, wie sie auf dem Handy `p` steht */
const figureOf = async (p: Page, who: string) => {
  await p.getByTestId("wbi-tab-figuren").click();
  return (await p.getByTestId("wbi-figure").filter({ hasText: who }).getByTestId("wbi-figure-name").textContent())!.trim();
};

async function bothSizes(p: Page, name: string) {
  await expectNoScroll(p);
  await shot(p, name);
  await p.setViewportSize({ width: 320, height: 568 });
  await expectNoScroll(p);
  await shot(p, `${name}-klein`);
  await p.setViewportSize({ width: 390, height: 844 });
}

test("Wer bin ich online mit drei Handys: fragen, abstimmen, raten, Auflösung", async ({ browser }) => {
  test.setTimeout(150_000);
  const anna = await newPhone(browser);
  await captureSpeech(anna);
  const ben = await newPhone(browser);
  const cem = await newPhone(browser);
  const code = await createRoom(anna, "werbinich", "Anna", "4352");
  await joinRoom(ben, code, "Ben", "4352");
  await joinRoom(cem, code, "Cem", "4352");
  await anna.getByRole("button", { name: "Spiel starten" }).click();

  for (const p of [anna, ben, cem]) await expect(p.getByTestId("wbi-title")).toBeVisible();
  await expect(anna.getByTestId("wbi-title")).toHaveText("Du bist dran");
  // Jeder sieht alle Figuren außer der eigenen
  const fig = { Anna: await figureOf(ben, "Anna"), Ben: await figureOf(cem, "Ben"), Cem: await figureOf(anna, "Cem") };
  expect(await figureOf(cem, "Anna")).toBe(fig.Anna);
  await expect(anna.getByTestId("wbi-figures")).not.toContainText(fig.Anna);
  await expect(anna.locator("[data-self]")).toContainText("das bist du");
  await expect(ben.getByTestId("wbi-figures")).not.toContainText(fig.Ben);
  await expect(cem.getByTestId("wbi-figures")).not.toContainText(fig.Cem);
  await bothSizes(ben, "wbi-1-figuren");

  // Anna fragt, Ben und Cem sagen Ja → Anna darf weiterfragen
  await anna.getByTestId("wbi-tab-notizen").click();
  await anna.getByTestId("wbi-text").fill("Bin ich ein Mensch?");
  await anna.getByTestId("wbi-ask-send").click();
  await expect(ben.getByTestId("wbi-vote")).toBeVisible();
  await expect(ben.getByTestId("wbi-status")).toContainText("Bin ich ein Mensch?");
  await ben.getByTestId("wbi-vote-ja").click();
  await expect(cem.getByTestId("wbi-vote-ja")).toContainText("1");
  await bothSizes(cem, "wbi-2-abstimmung");
  await cem.getByTestId("wbi-vote-ja").click();
  await expect(anna.getByTestId("wbi-last")).toContainText("Bin ich ein Mensch? – Ja");
  await expect(anna.getByTestId("wbi-notes")).toContainText("Bin ich ein Mensch?");
  await expect(anna.getByTestId("wbi-title")).toHaveText("Du bist dran");

  // Anna rät richtig
  await anna.getByTestId("wbi-guess-open").click();
  await anna.getByTestId("wbi-text").fill(fig.Anna.toLowerCase());
  await bothSizes(anna, "wbi-3-raten");
  await anna.getByTestId("wbi-guess-send").click();
  await expect(ben.getByTestId("wbi-title")).toHaveText("Du bist dran");
  // Anna hatte den Notizblock offen – zur Figurenliste wechseln (springt je nach Zeitpunkt nicht von selbst um)
  const figTab = anna.getByTestId("wbi-tab-figuren");
  if (await figTab.isVisible()) await figTab.click();
  await expect(anna.locator("[data-self]")).toContainText(fig.Anna);

  // Ben fragt, Nein → Cem
  await ben.getByTestId("wbi-ask-send").click();
  await anna.getByTestId("wbi-vote-nein").click();
  await cem.getByTestId("wbi-vote-nein").click();
  await expect(cem.getByTestId("wbi-title")).toHaveText("Du bist dran");
  // Cem rät falsch → die anderen prüfen → Ben
  await cem.getByTestId("wbi-guess-open").click();
  await cem.getByTestId("wbi-text").fill("Quatschfigur");
  await cem.getByTestId("wbi-guess-send").click();
  await expect(anna.getByTestId("wbi-check")).toContainText(`gesucht: ${fig.Cem}`);
  await expectNoScroll(anna);
  await shot(anna, "wbi-4-pruefen");
  await anna.getByTestId("wbi-vote-nein").click();
  await expect(ben.getByTestId("wbi-title")).toHaveText("Du bist dran");
  // Ben und Cem raten richtig
  await ben.getByTestId("wbi-guess-open").click();
  await ben.getByTestId("wbi-text").fill(fig.Ben);
  await ben.getByTestId("wbi-guess-send").click();
  await expect(cem.getByTestId("wbi-title")).toHaveText("Du bist dran");
  await cem.getByTestId("wbi-guess-open").click();
  await cem.getByTestId("wbi-text").fill(fig.Cem);
  await cem.getByTestId("wbi-guess-send").click();

  for (const p of [anna, ben, cem]) await expect(p.getByTestId("wbi-reveal-row")).toHaveCount(3);
  await expect(cem.getByTestId("wbi-reveal")).toContainText(fig.Cem);
  await bothSizes(cem, "wbi-5-aufloesung");
  await anna.getByTestId("wbi-podium").click();
  await expect(anna.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
  await expect(anna.getByTestId("winner")).toHaveText("Anna");
  await expectNoScroll(anna);
  await shot(anna, "wbi-6-ergebnis");
  const said = await spoken(anna);
  expect(said).toContain("Willkommen bei Wer bin ich!");
  expect(said).toContain("Anna fragt: Bin ich ein Mensch?");
  expect(said).toContain("Die Antwort ist: Ja. Anna darf weiterfragen.");
  expect(said).toContain(`Richtig! Anna war ${fig.Anna}.`);
  expect(said).toContain("Leider falsch, Cem.");
  expect(said).toContain(`Cem war ${fig.Cem}`);
  expect(said).toContain("Anna gewinnt mit 3 Punkten.");
});

async function newScreen(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  return ctx.newPage();
}

test("Wer bin ich am Großen Tisch: wer fragt und Abstimmung live, nie eine Figur", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await setConfig(request, { ...ALL_ON, modes: { werbinich: { table: "on" } } });
  try {
    const screen = await newScreen(browser);
    await screen.addInitScript(() => localStorage.setItem("spieltisch:quality", "flach"));
    await screen.goto("/tisch");
    await screen.getByTestId("table-new").click();
    await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
    const code = screen.url().split("/").pop()!;
    const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
    const phones: Page[] = [];
    for (const name of ["Anna", "Ben", "Cem"]) {
      const p = await newPhone(browser);
      await p.goto(`/r/${code}#pin=${pin}`);
      await expect(p.getByLabel("PIN")).toHaveValue(pin);
      await p.getByLabel("Dein Name").fill(name);
      await p.getByRole("button", { name: "Beitreten" }).click();
      phones.push(p);
    }
    await expect(screen.getByTestId("table-seat")).toHaveCount(3);
    await phones[0].getByTestId("meet-play").click();
    await phones[0].getByTestId("pick-werbinich").click();
    await phones[0].getByRole("button", { name: "Spiel starten" }).click();
    await expect(phones[0].getByTestId("wbi-title")).toBeVisible();
    const figs = [await figureOf(phones[1], "Anna"), await figureOf(phones[0], "Ben"), await figureOf(phones[0], "Cem")];
    const view = screen.getByTestId("table-view");
    await expect(view).toContainText("Anna ist dran");
    await phones[0].getByTestId("wbi-text").fill("Kann ich fliegen?");
    await phones[0].getByTestId("wbi-ask-send").click();
    await phones[1].getByTestId("wbi-vote-nein").click();
    await expect(view).toContainText("Anna: Kann ich fliegen?");
    await expect(view).toContainText("Nein 1");
    for (const f of figs) await expect(view).not.toContainText(f);
    await shot(screen, "wbi-7-fernseher");
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Wer bin ich mit einem Handy für alle: Figur nur beim Halten, Gruppe antwortet", async ({ page }) => {
  await startLocal(page, "werbinich", ["Anna", "Ben", "Cem"]);
  await expect(page.getByTestId("wbi-title")).toHaveText("Anna ist dran");
  await expect(page.getByTestId("wbi-peek-figure")).toHaveCount(0);
  await page.getByTestId("wbi-peek").dispatchEvent("pointerdown");
  await expect(page.getByTestId("wbi-peek-figure")).toBeVisible();
  await page.getByTestId("wbi-peek").dispatchEvent("pointerup");
  await expect(page.getByTestId("wbi-peek-figure")).toHaveCount(0);
  await page.getByTestId("wbi-text").fill("Bin ich ein Tier?");
  await page.getByTestId("wbi-ask-send").click();
  await expect(page.getByTestId("wbi-vote")).toBeVisible();
  await bothSizes(page, "wbi-8-ein-handy");
  await page.getByTestId("wbi-vote-nein").click();
  await expect(page.getByTestId("wbi-title")).toHaveText("Ben ist dran");
});
