import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectInView, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

const NAMES = ["Anna", "Ben", "Cem", "Dora"];

async function localGame(page: Page, names: string[], rounds = 2) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/spion/lokal");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await openSettings(page);
  for (let i = 5; i > rounds; i--) await page.getByRole("button", { name: "Runden verringern" }).click();
  await shot(page, "spion-01-settings");
  await closeSettings(page);
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

/** Karten reihum ansehen; gibt Spion und Ort zurück */
async function passAround(page: Page, names: string[], shots = false) {
  let spy = "";
  let place = "";
  for (const [i, n] of names.entries()) {
    await expect(page.getByTestId("handoff")).toContainText(n);
    if (shots && i === 0) { await expectNoScroll(page); await shot(page, "spion-02-handoff"); }
    await page.getByRole("button", { name: `Ich bin ${n}` }).click();
    await page.getByRole("button", { name: "Karte ansehen" }).click();
    const text = (await page.getByTestId("card-text").textContent())!;
    if (text.includes("Spion")) spy = n; else place = text;
    if (shots && i === 0) await shot(page, "spion-03-card");
    await page.getByRole("button", { name: /^Gesehen/ }).click();
  }
  return { spy, place };
}

test("Spion lokal: Karten reihum, fragen, abstimmen, Spion rät, Ergebnis", async ({ page }) => {
  await localGame(page, NAMES.slice(0, 3));
  const { spy, place } = await passAround(page, NAMES.slice(0, 3), true);
  expect(spy).not.toBe("");
  expect(place).not.toBe("");
  await expect(page.getByTestId("asker")).toContainText("Anna fragt");
  await expect(page.getByTestId("clock")).toContainText(/[0-9]:[0-9]{2}/);
  await page.getByRole("group", { name: "… und fragt:" }).getByRole("button", { name: "Ben" }).click();
  await expect(page.getByTestId("asker")).toContainText("Ben fragt");
  // Zurückfragen geht nicht
  await expect(page.getByRole("group", { name: "… und fragt:" }).getByRole("button", { name: "Anna" })).toBeDisabled();
  await expectNoScroll(page);
  await shot(page, "spion-04-local-talk");

  // Abstimmung: Anna startet, alle zeigen auf Cem
  await page.getByRole("button", { name: "Abstimmen" }).click();
  await page.getByRole("button", { name: "Anna", exact: true }).click();
  await expect(page.getByTestId("clock")).toContainText("angehalten");
  await page.getByRole("button", { name: "Cem", exact: true }).click();
  await expectNoScroll(page);
  await shot(page, "spion-05-local-vote");
  await page.getByRole("button", { name: "Cem verurteilen" }).click();
  await expect(page.getByTestId("reveal-spy")).toHaveText(spy);
  await expect(page.getByTestId("reveal-place")).toHaveText(place);
  await expect(page.getByTestId("round-winner")).toHaveText(spy === "Cem" ? "Spion enttarnt!" : "Der Spion gewinnt");
  await expectNoScroll(page);
  await shot(page, "spion-06-local-reveal");

  // Runde 2: der Spion enttarnt sich und rät richtig
  await page.getByRole("button", { name: "Runde 2 von 2 starten" }).click();
  const r2 = await passAround(page, NAMES.slice(0, 3));
  await page.getByRole("button", { name: "Spion rät" }).click();
  await page.getByRole("button", { name: r2.spy, exact: true }).click();
  await page.getByRole("group", { name: "Orte" }).getByRole("button", { name: r2.place, exact: true }).click();
  await expectNoScroll(page);
  await shot(page, "spion-07-local-guess");
  await page.getByRole("button", { name: `Tipp: ${r2.place}` }).click();
  await expect(page.getByTestId("winner")).toBeVisible();
  await expect(page.getByTestId("ranking")).toContainText(r2.spy);
  await expectNoScroll(page);
  await shot(page, "spion-08-result");
});

test("Spion lokal auf kleinem Handy (320×568) mit 8 Spielern", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const names = ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn", "Gina", "Hugo"];
  await localGame(page, names);
  await expect(page.getByTestId("handoff")).toBeVisible();
  await expectNoScroll(page);
  await passAround(page, names);
  await expect(page.getByTestId("asker")).toBeVisible();
  await expectNoScroll(page);
  await expectInView(page, page.getByRole("button", { name: "Spion rät" }));
  await shot(page, "spion-09-small-talk");
  await page.getByRole("button", { name: "Abstimmen" }).click();
  await page.getByRole("button", { name: "Hugo", exact: true }).click();
  await expectNoScroll(page);
  await expectInView(page, page.getByRole("button", { name: "Wen trifft es?" }));
  await shot(page, "spion-10-small-vote");
});

test("Spion online mit drei Handys: eigene Karte, Fragen, Abstimmung", async ({ browser }) => {
  const phones = await Promise.all(NAMES.slice(0, 3).map(() => newPhone(browser)));
  const [host, ben, cem] = phones;
  const code = await createRoom(host, "spion", "Anna", "5151");
  await joinRoom(ben, code, "Ben", "5151");
  await joinRoom(cem, code, "Cem", "5151");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  const texts: string[] = [];
  for (const p of phones) {
    await p.getByRole("button", { name: "Karte ansehen" }).click();
    texts.push((await p.getByTestId("card-text").textContent())!);
  }
  // Genau einer ist Spion, die anderen sehen denselben Ort
  const spyIdx = texts.findIndex((t) => t.includes("Spion"));
  expect(spyIdx).toBeGreaterThanOrEqual(0);
  expect(new Set(texts.filter((_, i) => i !== spyIdx)).size).toBe(1);
  await shot(phones[spyIdx], "spion-11-online-spy-card");
  for (const p of phones) await p.getByRole("button", { name: "Gesehen – bereit" }).click();

  await expect(ben.getByTestId("asker")).toContainText("Anna fragt");
  await expect(host.getByTestId("clock")).toBeVisible();
  // Anna fragt Ben
  await host.getByRole("group", { name: "Wen fragst du?" }).getByRole("button", { name: "Ben" }).click();
  await expect(cem.getByTestId("asker")).toContainText("Ben fragt");
  // Orte durchstreichen – nur auf dem eigenen Handy
  const first = cem.getByRole("group", { name: "Orte" }).getByRole("button").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(ben.getByRole("group", { name: "Orte" }).getByRole("button").first()).toHaveAttribute("aria-pressed", "false");
  for (const p of phones) await expectNoScroll(p);
  await shot(cem, "spion-12-online-talk");
  await shot(ben, "spion-13-online-asker");
  // Spion sieht „Ort raten“, die anderen nicht
  await expect(phones[spyIdx].getByRole("button", { name: "Ort raten" })).toBeVisible();
  await expect(phones[(spyIdx + 1) % 3].getByRole("button", { name: "Ort raten" })).toHaveCount(0);

  // Ben startet eine Abstimmung, alle stimmen für den Spion
  await ben.getByRole("button", { name: "Abstimmen" }).click();
  const spyName = NAMES[spyIdx];
  for (const [i, p] of phones.entries()) {
    const target = i === spyIdx ? NAMES[(i + 1) % 3] : spyName;
    await p.getByRole("button", { name: target, exact: true }).click();
    if (i === 0) { await expectNoScroll(p); await shot(p, "spion-14-online-vote"); }
  }
  await expect(host.getByTestId("round-winner")).toHaveText("Spion enttarnt!");
  await expect(cem.getByTestId("reveal-spy")).toHaveText(spyName);
  await expect(ben.getByTestId("points")).toContainText(spyIdx === 1 ? "+1" : "+2"); // Ankläger Ben: 2 – ist er selbst Spion, gibt es keinen Bonus
  await shot(cem, "spion-15-online-reveal");
  await expectNoScroll(cem);
});
