import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, openSettings, closeSettings, shot, startLocal } from "./util";

/** Mit der Maus (bzw. dem Finger) ein Zickzack aufs Blatt malen */
async function scribble(page: Page) {
  const box = (await page.getByTestId("paper").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.07), box.y + box.height * (i % 2 ? 0.7 : 0.3), { steps: 3 });
  await page.mouse.up();
}

/** Wer zeichnet gerade? (der mit der Begriffs-Auswahl) */
async function drawerOf(pages: Page[]): Promise<Page> {
  await expect.poll(async () => (await Promise.all(pages.map((p) => p.getByRole("group", { name: "Begriff wählen" }).isVisible()))).some(Boolean)).toBe(true);
  for (const p of pages) if (await p.getByRole("group", { name: "Begriff wählen" }).isVisible()) return p;
  throw new Error("niemand zeichnet");
}

test("Zeichnen & Raten online, laut rufen: Begriff wählen, malen – die anderen sehen es live, Zeichner tippt an, wer es hatte", async ({ browser }) => {
  test.setTimeout(90_000);
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "zeichnen", "Anna", "4321");
  await joinRoom(ben, code, "Ben", "4321");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  const drawer = await drawerOf([anna, ben]);
  const guesser = drawer === anna ? ben : anna;
  await expect(guesser.getByText(/sucht sich einen Begriff aus/)).toBeVisible();
  await expectNoScroll(drawer);
  await shot(drawer, "z1-auswahl");
  const word = (await drawer.getByRole("group", { name: "Begriff wählen" }).getByRole("button").first().textContent())!;
  await drawer.getByRole("group", { name: "Begriff wählen" }).getByRole("button").first().click();
  await expect(drawer.getByTestId("word")).toHaveText(word);
  // Wer rät, sieht nur die Lücken – nie den Begriff
  await expect(guesser.getByTestId("mask")).toBeVisible();
  await expect(guesser.getByText(word, { exact: true })).toHaveCount(0);
  await scribble(drawer);
  await expect.poll(async () => Number(await guesser.getByTestId("paper").getAttribute("data-strokes"))).toBeGreaterThan(0);
  await expectNoScroll(drawer);
  await expectNoScroll(guesser);
  await shot(drawer, "z2-zeichnen");
  await shot(guesser, "z3-raten");
  await drawer.getByTestId("who").click();
  const name = guesser === anna ? "Anna" : "Ben";
  await drawer.getByRole("group", { name: "Wer hat es erraten?" }).getByRole("button", { name }).click();
  await expect(guesser.getByTestId("reveal")).toContainText(word);
  await expect(guesser.getByTestId("solved")).toContainText("Erraten von Du");
  await shot(guesser, "z4-aufloesung");
  await guesser.getByRole("button", { name: "Nächstes Bild" }).click();
  await expect(guesser.getByRole("group", { name: "Begriff wählen" })).toBeVisible();
});

test("Zeichnen & Raten online, ins Handy tippen: falscher Tipp steht da, richtiger löst auf", async ({ browser }) => {
  test.setTimeout(90_000);
  const anna = await newPhone(browser);
  const ben = await newPhone(browser);
  const code = await createRoom(anna, "zeichnen", "Anna", "4322");
  await openSettings(anna);
  await anna.getByRole("radio", { name: /Ins Handy tippen/ }).click();
  await closeSettings(anna);
  await joinRoom(ben, code, "Ben", "4322");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  const drawer = await drawerOf([anna, ben]);
  const guesser = drawer === anna ? ben : anna;
  const word = (await drawer.getByRole("group", { name: "Begriff wählen" }).getByRole("button").first().textContent())!;
  await drawer.getByRole("group", { name: "Begriff wählen" }).getByRole("button").first().click();
  await scribble(drawer);
  await guesser.getByLabel("Dein Tipp").fill("Quatschwort");
  await guesser.getByRole("button", { name: "Tipp abschicken" }).click();
  await expect(drawer.getByTestId("solved")).toContainText("Noch hat es keiner");
  await shot(guesser, "z5-tippen");
  await guesser.getByLabel("Dein Tipp").fill(word.toLowerCase());
  await guesser.getByRole("button", { name: "Tipp abschicken" }).click();
  // nur ein Ratender – damit ist das Bild vorbei
  await expect(drawer.getByTestId("reveal")).toContainText(word);
});

test("Zeichnen & Raten an einem Handy: Sichtschutz für die Auswahl, malen, keiner hatte es", async ({ page }) => {
  await startLocal(page, "zeichnen", ["Anna", "Ben", "Cem"]);
  await expect(page.getByTestId("handoff")).toBeVisible();
  await page.getByTestId("handoff").click();
  await page.getByRole("group", { name: "Begriff wählen" }).getByRole("button").nth(1).click();
  await scribble(page);
  await expectNoScroll(page);
  await page.getByTestId("who").click();
  await page.getByRole("button", { name: "Keiner" }).click();
  await expect(page.getByTestId("solved")).toContainText("Keiner hat's erraten");
});
