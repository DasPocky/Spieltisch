import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, newPhone } from "./util";
const D = "screenshots/ww";
const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil"];
const snap = async (p: Page, n: string) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${n}.png` }); };

test("Werwolf online: das Host-Handy erzählt alles wie ein Spielleiter", async ({ browser }) => {
  test.setTimeout(240_000);
  const phones = await Promise.all(NAMES.map(() => newPhone(browser)));
  const [host] = phones;
  // Sprachausgabe mitschreiben statt abspielen
  await host.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    const fake = { speak: (u: SpeechSynthesisUtterance) => { said.push(u.text); setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 10); }, cancel: () => {}, getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {}, speaking: false, pending: false, paused: false };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  });
  const code = await createRoom(host, "werwolf", "Anna", "1313");
  for (let i = 1; i < 5; i++) await joinRoom(phones[i], code, NAMES[i], "1313");
  await snap(host, "00-lobby");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  const roles: string[] = [];
  for (const p of phones) {
    const card = p.getByRole("button", { name: /Rolle aufdecken|Deine Rolle/ }).first();
    await expect(card).toBeVisible();
    if ((await card.getAttribute("aria-label"))?.includes("aufdecken")) await card.click();
    roles.push((await p.getByTestId("my-role").first().textContent())!.trim());
    await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  }
  const by = (r: string) => phones[roles.findIndex((x) => x.includes(r))];
  const villager = by("Dorfbewohner");
  await snap(villager, "01-dorf-augen-zu");
  await snap(by("Seherin"), "02-seherin-dran");
  await by("Seherin").getByRole("group").getByRole("button").first().click();
  await by("Seherin").getByRole("button", { name: "Rolle ansehen" }).click();
  await snap(by("Seherin"), "03-seherin-ergebnis");
  await snap(by("Werwolf"), "04-wolf-dran");
  // Wolf frisst jemanden, der nicht der Wolf selbst ist
  await by("Werwolf").getByRole("group").getByRole("button").first().click();
  await snap(by("Hexe"), "05-hexe-dran");
  await by("Hexe").getByRole("button", { name: "Bestätigen" }).click();
  await expect(host.getByTestId("ww-phase")).toHaveText(/Wahl|Tag/);
  await snap(villager, "06-morgen");
  for (const p of phones) if (await p.getByText("Hauptmannwahl", { exact: true }).isVisible()) await p.getByRole("group").getByRole("button").first().click();
  await expect(host.getByTestId("ww-phase")).toHaveText(/Tag 1/);
  await snap(villager, "07-tag");
  for (const p of phones) { const g = p.getByRole("group").getByRole("button").first(); if (await g.isVisible()) await g.click(); }
  await host.getByRole("button", { name: /Abstimmung beenden/ }).click({ timeout: 3000 }).catch(() => {});
  await host.waitForTimeout(1500);
  await snap(villager, "08-nach-abstimmung");
  const said = await host.evaluate(() => (window as unknown as { __said: string[] }).__said);
  const all = said.join(" ");
  // Reihenfolge wie am Tisch
  const order = ["Willkommen in Düsterwald", "Alle schließen die Augen", "Die Seherin erwacht", "Die Seherin schläft wieder ein", "Die Werwölfe erwachen",
    "Die Hexe erwacht", "Die Hexe schläft wieder ein", "Es wird Tag", "Hauptmann", "Minuten", "Das Dorf hat"];
  let at = -1;
  for (const o of order) { const i = all.indexOf(o, at + 1); expect(i, o).toBeGreaterThan(at); at = i; }
});
