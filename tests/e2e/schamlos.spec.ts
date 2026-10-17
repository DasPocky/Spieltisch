import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot, startLocal } from "./util";

/** Antwort legen: so viele Karten antippen, wie die schwarze Karte Lücken hat */
async function answer(p: Page) {
  const button = p.getByRole("button", { name: /^Wähle|legen$/ });
  const need = /2 Karten/.test((await button.textContent()) ?? "") ? 2 : 1;
  const hand = p.getByTestId("hand").getByRole("button");
  for (let i = 0; i < need; i++) await hand.nth(i).click();
  await p.getByRole("button", { name: /legen$/ }).click();
}

test("Schamlos online: drei Handys, legen, Zar wählt anonym, Punkt, nächster Zar", async ({ browser }) => {
  const [anna, ben, cem] = await Promise.all([newPhone(browser), newPhone(browser), newPhone(browser)]);
  const code = await createRoom(anna, "schamlos", "Anna", "4242");
  await joinRoom(ben, code, "Ben", "4242");
  await joinRoom(cem, code, "Cem", "4242");
  await anna.getByRole("button", { name: "Spiel starten" }).click();

  const all = [anna, ben, cem];
  await expect(anna.getByTestId("black-card")).toBeVisible();
  let czar: Page | undefined;
  for (const p of all) if ((await p.getByTestId("schamlos-czar").textContent())?.includes("Du bist Zar")) czar = p;
  expect(czar).toBeDefined();
  const players = all.filter((p) => p !== czar);
  await expect(czar!.getByTestId("hand")).toHaveCount(0);
  await expectNoScroll(players[0]);
  await shot(players[0], "95-schamlos-hand");

  await answer(players[0]);
  await expect(players[0].getByTestId("schamlos-wait")).toBeVisible();
  await answer(players[1]);

  // Aufgedeckt: zwei Sätze, nur der Zar darf wählen
  await expect(czar!.getByTestId("schamlos-subs").getByRole("button")).toHaveCount(2);
  await expect(players[0].getByTestId("schamlos-subs").getByRole("button").first()).toBeDisabled();
  await shot(czar!, "96-schamlos-zar");
  await czar!.getByTestId("schamlos-subs").getByRole("button").first().click();
  await expect(anna.getByTestId("schamlos-win")).toContainText("Punkt für");
  await shot(players[1], "97-schamlos-punkt");
  await czar!.getByRole("button", { name: "Nächste Runde" }).click();
  await expect(czar!.getByTestId("hand")).toBeVisible();
});

test("Schamlos an einem Gerät: reihum mit Sichtschutz", async ({ page }) => {
  await startLocal(page, "schamlos", ["Anna", "Ben", "Cem"]);
  await expect(page.getByTestId("black-card")).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("handoff").getByRole("button").click();
    await answer(page);
  }
  await page.getByTestId("handoff").getByRole("button").click();
  await page.getByTestId("schamlos-subs").getByRole("button").first().click();
  await expect(page.getByTestId("schamlos-win")).toBeVisible();
  await expectNoScroll(page);
});
