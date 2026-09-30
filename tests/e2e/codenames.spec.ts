import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

async function localPlayers(page: Page, names: string[], mode?: RegExp) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/codenames/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (mode) await page.getByRole("radio", { name: mode }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

test("Codenamen lokal: Teams, Hinweis, raten – auch auf 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await localPlayers(page, ["Anna", "Ben", "Cem", "Dora"]);
  await expect(page.getByTestId("not-ready")).toContainText("Chef");
  await page.getByRole("button", { name: "Zufällig verteilen" }).click();
  await expectNoScroll(page);
  await shot(page, "83-cn-teams");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page.getByRole("group", { name: "Wörter" }).getByRole("button")).toHaveCount(25);
  await expectNoScroll(page);
  await page.getByLabel("Hinweiswort").fill("Quatsch");
  await page.getByRole("button", { name: "Zahl erhöhen" }).click();
  await page.getByRole("button", { name: "Geben" }).click();
  await expect(page.getByTestId("clue")).toContainText("Quatsch");
  await page.getByRole("group", { name: "Wörter" }).getByRole("button").first().click();
  await expect(page.getByRole("group", { name: "Wörter" }).getByRole("button", { name: /\(/ })).toHaveCount(1);
  await shot(page, "84-cn-play-320");
});

test("Codenamen online: Chef sieht Farben, Agent nicht", async ({ browser }) => {
  const phones = await Promise.all([0, 1, 2, 3].map(() => newPhone(browser)));
  const [anna, ben, cem, dora] = phones;
  const code = await createRoom(anna, "codenames", "Anna", "4242");
  for (const [p, n] of [[ben, "Ben"], [cem, "Cem"], [dora, "Dora"]] as const) await joinRoom(p, code, n, "4242");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  // jeder teilt sich selbst ein
  const pick = async (p: Page, name: string, team: string, chief: boolean) => {
    await p.getByRole("button", { name: `${name}: Team ${team}` }).click();
    if (chief) await p.getByRole("button", { name: `${name}: Chef` }).click();
  };
  await pick(anna, "Anna", "Rot", true);
  await pick(ben, "Ben", "Rot", false);
  await pick(cem, "Cem", "Blau", true);
  await pick(dora, "Dora", "Blau", false);
  await anna.getByRole("button", { name: "Los geht's" }).click();
  await expect(ben.getByRole("group", { name: "Wörter" }).getByRole("button")).toHaveCount(25);

  // wer beginnt? Dessen Chef gibt den Hinweis, dessen Agent rät
  const redStarts = (await anna.getByTestId("score-rot").textContent())!.includes("▶");
  const [chief, agent] = redStarts ? [anna, ben] : [cem, dora];
  await chief.getByLabel("Hinweiswort").fill("Reise");
  await chief.getByRole("button", { name: "Geben" }).click();
  await expect(agent.getByTestId("clue")).toContainText("Reise");
  await shot(chief, "85-cn-chief");
  await shot(agent, "86-cn-agent");
  await agent.getByRole("group", { name: "Wörter" }).getByRole("button").nth(3).click();
  await expect(chief.getByRole("group", { name: "Wörter" }).getByRole("button", { name: /\(/ })).toHaveCount(1);
  await expectNoScroll(agent);
});

test("Codenamen als Brettspiel-Hilfe: Schlüsselkarte", async ({ page }) => {
  await localPlayers(page, ["Anna", "Ben"], /Brettspiel-Hilfe/);
  await page.getByRole("button", { name: "Anna: Team Rot" }).click();
  await page.getByRole("button", { name: "Anna: Chef" }).click();
  await page.getByRole("button", { name: "Ben: Team Blau" }).click();
  await page.getByRole("button", { name: "Ben: Chef" }).click();
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page.getByText("Die Schlüsselkarte sehen nur die Chefs.")).toBeVisible();
  await page.getByRole("button", { name: "Schlüsselkarte zeigen" }).click();
  await expect(page.getByRole("group", { name: "Schlüsselkarte" }).getByRole("button")).toHaveCount(25);
  await page.getByRole("group", { name: "Schlüsselkarte" }).getByRole("button", { name: /Passant/ }).first().click();
  await expect(page.getByRole("group", { name: "Schlüsselkarte" }).getByRole("button", { name: /aufgedeckt/ })).toHaveCount(1);
  await expectNoScroll(page);
  await shot(page, "87-cn-key");
});
