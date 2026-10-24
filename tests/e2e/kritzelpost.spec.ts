import { expect, test, type Page } from "@playwright/test";
import { captureSpeech, createRoom, expectNoScroll, joinRoom, newPhone, shot, spoken } from "./util";

/** Ein Zickzack aufs Blatt malen */
async function scribble(page: Page) {
  const box = (await page.getByTestId("paper").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.07), box.y + box.height * (i % 2 ? 0.7 : 0.3), { steps: 3 });
  await page.mouse.up();
}

test("Kritzelpost online mit drei Handys: Satz, Zeichnung, Beschreibung – nur der Vorgänger ist zu sehen, dann das Album", async ({ browser }) => {
  test.setTimeout(150_000);
  const anna = await newPhone(browser);
  await captureSpeech(anna);
  const ben = await newPhone(browser);
  const cem = await newPhone(browser);
  const phones = [anna, ben, cem];
  const code = await createRoom(anna, "kritzelpost", "Anna", "4351");
  await joinRoom(ben, code, "Ben", "4351");
  await joinRoom(cem, code, "Cem", "4351");
  await anna.getByRole("button", { name: "Spiel starten" }).click();

  // Schritt 1: jeder schreibt einen Satz
  const sentence = (i: number) => ["Ein Pinguin fährt Bus", "Die Katze backt Kuchen", "Ein Wal fliegt Drachen"][i];
  for (const [i, p] of phones.entries()) {
    await expect(p.getByTestId("kp-title")).toHaveText("Schreib einen Satz");
    await p.getByTestId("kp-text").fill(sentence(i));
  }
  await expectNoScroll(ben);
  await shot(ben, "kp-1-satz");
  await anna.getByTestId("kp-done").click();
  await expect(anna.getByTestId("kp-wait")).toContainText("1/3 fertig");
  await shot(anna, "kp-2-warten");
  await ben.getByTestId("kp-done").click();
  await cem.getByTestId("kp-done").click();

  // Schritt 2: jeder zeichnet den Satz seines Vorgängers – nie den eigenen
  const seen: string[] = [];
  for (const [i, p] of phones.entries()) {
    await expect(p.getByTestId("kp-title")).toHaveText("Zeichne diesen Satz");
    const task = (await p.getByTestId("kp-task").textContent())!;
    expect(task).not.toContain(sentence(i));
    seen.push(task);
    await scribble(p);
    await expect.poll(async () => Number(await p.getByTestId("paper").getAttribute("data-strokes"))).toBeGreaterThan(0);
  }
  expect(new Set(seen).size).toBe(3);
  await expectNoScroll(cem);
  await shot(cem, "kp-3-zeichnen");
  await cem.setViewportSize({ width: 320, height: 568 });
  await expectNoScroll(cem);
  await shot(cem, "kp-3b-zeichnen-klein");
  await cem.setViewportSize({ width: 390, height: 844 });
  for (const p of phones) await p.getByTestId("kp-done").click();

  // Schritt 3: beschreiben – man sieht die Zeichnung, aber keinen Satz
  for (const [i, p] of phones.entries()) {
    await expect(p.getByTestId("kp-title")).toHaveText("Was ist das? Beschreib es");
    await expect.poll(async () => Number(await p.getByTestId("paper").getAttribute("data-strokes"))).toBeGreaterThan(0);
    for (let j = 0; j < 3; j++) await expect(p.getByText(sentence(j))).toHaveCount(0);
    await p.getByTestId("kp-text").fill(`Beschreibung ${i + 1}`);
  }
  await expectNoScroll(anna);
  await shot(anna, "kp-4-beschreiben");
  for (const p of phones) await p.getByTestId("kp-done").click();

  // Album: Anna blättert, die anderen schauen zu
  await expect(anna.getByTestId("kp-album")).toContainText("Kette von Anna");
  await expect(ben.getByText("Der Host blättert")).toBeVisible();
  await expect(ben.getByTestId("kp-page-text")).toHaveText(`„${sentence(0)}“`);
  await shot(anna, "kp-5-album-satz");
  await anna.getByTestId("kp-next").click();
  await expect(ben.getByTestId("paper")).toBeVisible();
  await expectNoScroll(ben);
  await shot(ben, "kp-6-album-bild");
  await anna.getByTestId("kp-next").click();
  await expect(anna.getByTestId("kp-next")).toContainText("Nächste Kette");
  // Blättern bis zum Ende: nach jedem Tipp warten, bis sich die Seite sichtbar ändert (kein Klick geht verloren, keiner zu viel)
  const next = anna.getByTestId("kp-next");
  const album = anna.getByTestId("kp-album");
  for (let k = 0; k < 12 && !(await next.innerText()).includes("Album beenden"); k++) {
    const where = await album.innerText();
    await expect(async () => {
      if ((await album.innerText()) === where) await next.click();
      await expect(album).not.toHaveText(where, { timeout: 3000 });
    }).toPass({ timeout: 20_000 });
  }
  await expect(next).toContainText("Album beenden");
  await anna.getByTestId("kp-next").click();
  await expect(anna.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
  await expectNoScroll(anna);
  await shot(anna, "kp-7-ende");
  // Spielleiter las vor
  const said = await spoken(anna);
  expect(said).toContain("Jetzt kommt das Album!");
  expect(said).toContain(`Anna schrieb: ${sentence(0)}`);
});
