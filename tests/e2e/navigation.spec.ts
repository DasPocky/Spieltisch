import { expect, test, type Page } from "@playwright/test";
import { expectInView, expectNoScroll, shot } from "./util";

/** Raum über das Wahlblatt veranstalten: Name und PIN, dann öffnen */
async function host(page: Page, kind: "game" | "party" | "meet", pin: string) {
  await page.getByTestId("host-open").click();
  await expect(page.getByRole("heading", { name: "Raum veranstalten" })).toBeVisible();
  await page.getByTestId(`host-${kind}`).click();
  await page.getByLabel("Dein Name").fill("Anna");
  await page.getByLabel(/PIN/).fill(pin);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
}

test("Startseite: drei klare Einstiege – Raum veranstalten, Mitspielen, Fernseher – als Buttons, ohne Scrollen", async ({ page }) => {
  await page.goto("/");
  const actions = page.getByTestId("home-actions");
  for (const name of ["Raum veranstalten", "Mitspielen", /Auf dem Fernseher zeigen/]) await expect(actions.getByRole("button", { name })).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "c1-start");
  // Kleines Handy: alles da, nichts abgeschnitten
  await page.setViewportSize({ width: 320, height: 568 });
  await expectNoScroll(page);
  await expectInView(page, page.getByTestId("tv-open"));
  await shot(page, "c1-start-klein");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByTestId("host-open").click();
  for (const id of ["host-game", "host-party", "host-meet"]) await expect(page.getByTestId(id)).toBeVisible();
  await shot(page, "c1-veranstalten");
  await page.keyboard.press("Escape");

  await page.getByTestId("tv-open").click();
  await expect(page.getByTestId("tv-address")).toContainText("/tisch");
  await shot(page, "c1-fernseher");
  await page.getByTestId("tv-here").click();
  await expect(page).toHaveURL(/\/tisch$/);
  await expect(page.getByRole("heading", { name: "Neuen Raum mit Fernseher" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bestehenden Raum zeigen" })).toBeVisible();
});

test("Raum veranstalten als Partyabend: die Planung öffnet sich gleich, Treffpunkt und Partyabend sind Buttons", async ({ page }) => {
  await page.goto("/");
  await host(page, "party", "6161");
  await expect(page.getByRole("heading", { name: /Partyabend/ })).toBeVisible();
  await shot(page, "c1-partyabend-planen");
  await page.keyboard.press("Escape");
  // In der Lobby: Partyabend und Treffpunkt als sichtbare Buttons statt Textlinks
  await expect(page.getByTestId("plan-open")).toHaveAttribute("data-slot", "button");
  await expect(page.getByTestId("to-meet")).toHaveAttribute("data-slot", "button");
  await expectNoScroll(page);
  await shot(page, "c1-lobby");
});

test("Raum veranstalten mit einem Spiel: die Spielauswahl kommt gleich", async ({ page }) => {
  await page.goto("/");
  await host(page, "game", "6262");
  await expect(page.getByRole("heading", { name: "Was spielt ihr?" })).toBeVisible();
});

test("Profil: die Verwaltung ist ein sichtbarer Eintrag, kein blasser Text", async ({ page }) => {
  await page.goto("/profil");
  const admin = page.getByTestId("admin-link");
  await admin.scrollIntoViewIfNeeded();
  await expect(admin).toContainText("Verwaltung");
  const box = await admin.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await shot(page, "c1-profil-verwaltung");
});
