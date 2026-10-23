import { expect, test } from "@playwright/test";
import { createRoom, expectNoScroll, shot } from "./util";

test("Spielauswahl: Suche, passend zur Spielerzahl, nichts gefunden mit Ausweg", async ({ page }) => {
  await createRoom(page, "maumau", "Anna", "7171");
  await page.getByTestId("game-card").click();
  const list = page.getByTestId("pick-list");
  const all = await list.locator("[data-testid^=pick-]").count();
  expect(all).toBeGreaterThan(15);

  // Umlaute egal: „wurfel“ findet die Würfelspiele
  await page.getByTestId("game-search").fill("wurfel");
  await expect(page.getByTestId("pick-fuenfwuerfel")).toBeVisible();
  await expect(page.getByTestId("pick-maumau")).toBeHidden();
  await shot(page, "c2-suche");

  // Nichts gefunden: Ausweg zeigt wieder alles
  await page.getByTestId("game-search").fill("gibtsnicht");
  await expect(page.getByTestId("game-none")).toBeVisible();
  await page.getByRole("button", { name: "Alle Spiele zeigen" }).click();
  await expect(page.getByTestId("game-search")).toHaveValue("");
  await expect(list.locator("[data-testid^=pick-]")).toHaveCount(all);

  // Allein im Raum: „Für 1“ zeigt nur Spiele, die zu einem passen (Partyspiele fallen weg)
  await page.getByTestId("game-fit").click();
  await expect(page.getByTestId("game-fit")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pick-werwolf")).toBeHidden();
  expect(await list.locator("[data-testid^=pick-]").count()).toBeLessThan(all);
  await page.getByTestId("game-search").fill("quiz");
  await page.getByTestId("pick-quiz").click();
  await expect(page.getByRole("heading", { name: "Was spielt ihr?" })).toBeHidden();
  await expect(page.getByTestId("game-card")).toContainText("Quiz");
  // Beim nächsten Öffnen ist die Suche wieder leer
  await page.getByTestId("game-card").click();
  await expect(page.getByTestId("game-search")).toHaveValue("");
});

test("Partyabend in zwei Schritten: wählen, sortieren, zurück ohne Verlust, starten", async ({ page }) => {
  await createRoom(page, "alles", "Anna", "7272");
  await page.getByTestId("plan-open").click();
  await expect(page.getByTestId("plan-next")).toBeDisabled();
  for (const id of ["vier", "maumau", "quiz"]) await page.getByTestId(`plan-${id}`).click();
  await expect(page.getByTestId("plan-vier")).toHaveAttribute("aria-pressed", "true");
  await shot(page, "c2-plan-waehlen");
  await page.getByTestId("plan-next").click();

  const order = page.getByTestId("plan-order");
  await expect(order.locator("li")).toHaveText([/Vier in einer Reihe/, /Mau-Mau/, /Quiz/]);
  await expect(page.getByTestId("plan-duration")).toContainText("3 Spiele · ca.");
  // Quiz nach oben, Vier ganz runter
  await page.getByRole("button", { name: /Quiz.* nach oben/ }).click();
  await page.getByRole("button", { name: /Quiz.* nach oben/ }).click();
  await page.getByRole("button", { name: "Vier in einer Reihe nach unten" }).click();
  await expect(order.locator("li")).toHaveText([/Quiz/, /Mau-Mau/, /Vier in einer Reihe/]);
  // Allein im Raum: Hinweis, wer wie viele Spieler braucht
  await expect(order.locator("li").last()).toContainText("ab 2 Spielern");
  await expectNoScroll(page);
  await shot(page, "c2-plan-reihenfolge");

  // Zurück: Auswahl und Reihenfolge bleiben, eins dazu
  await page.getByTestId("plan-back").click();
  await page.getByTestId("game-search").fill("dame");
  await page.getByTestId("plan-dame").click();
  await page.getByTestId("plan-next").click();
  await expect(order.locator("li")).toHaveText([/Quiz/, /Mau-Mau/, /Vier in einer Reihe/, /Dame/]);
  await page.getByRole("button", { name: "Mau-Mau entfernen" }).click();
  await expect(order.locator("li")).toHaveCount(3);

  await page.getByTestId("plan-start").click();
  await expect(page.getByText("Partyabend · Spiel 1 von 3")).toBeVisible();
  await expect(page.getByTestId("game-card")).toContainText("Quiz");
});

test("Partyabend: Abbrechen verwirft den Entwurf", async ({ page }) => {
  await createRoom(page, "alles", "Anna", "7373");
  await page.getByTestId("plan-open").click();
  await page.getByTestId("plan-vier").click();
  await page.getByTestId("plan-maumau").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(/Partyabend · Spiel/)).toBeHidden();
  await page.getByTestId("plan-open").click();
  await expect(page.getByTestId("plan-vier")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("plan-next")).toBeDisabled();
});

test("Spielauswahl: Spiele merken – oben in „Gemerkt“, bleibt nach Neuladen, wieder entfernen", async ({ page }) => {
  await createRoom(page, "maumau", "Anna", "7474");
  await page.getByTestId("game-card").click();
  const favs = page.getByTestId("pick-favorites");
  await expect(favs).toHaveCount(0);
  await page.getByRole("button", { name: "Werwolf merken" }).click();
  await page.getByTestId("fav-quiz").click();
  await expect(page.getByRole("button", { name: "Werwolf nicht mehr merken" })).toHaveAttribute("aria-pressed", "true");
  // Oben in „Gemerkt“ und nicht doppelt weiter unten
  await expect(page.getByTestId("pick-list").locator("section").first()).toHaveAttribute("aria-label", "Gemerkt");
  await expect(favs.locator("[data-testid^=pick-]")).toHaveCount(2);
  await expect(page.getByTestId("pick-werwolf")).toHaveCount(1);
  // Suche filtert auch die Gemerkten
  await page.getByTestId("game-search").fill("quiz");
  await expect(favs.getByTestId("pick-quiz")).toBeVisible();
  await expect(page.getByTestId("pick-werwolf")).toHaveCount(0);
  await page.getByTestId("game-search").fill("");
  await expectNoScroll(page);
  await shot(page, "c4-favoriten");

  // Nach dem Neuladen noch da – auch im Partyabend-Planer zuerst
  await page.reload();
  await page.getByTestId("game-card").click();
  await expect(favs.locator("[data-testid^=pick-]")).toHaveCount(2);
  await page.getByRole("button", { name: "Werwolf nicht mehr merken" }).click();
  await page.getByTestId("fav-quiz").click();
  await expect(page.getByTestId("fav-quiz")).toHaveAttribute("aria-pressed", "false");
  await expect(favs).toHaveCount(0);
  await expect(page.getByTestId("pick-werwolf")).toHaveCount(1);
  await page.getByRole("button", { name: "Werwolf merken" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("plan-open").click();
  await expect(page.getByTestId("plan-games").locator("button").first()).toHaveAttribute("data-testid", "plan-werwolf");
});
