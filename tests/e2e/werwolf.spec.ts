import { expect, test, type Page } from "@playwright/test";
import { createRoom, expectNoScroll, joinRoom, newPhone, shot } from "./util";

const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil"];

test("Werwolf lokal: Rollen herumreichen, App liest vor, Nacht und Tag", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/werwolf/lokal");
  for (const n of NAMES) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByText("Rollen ansehen")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "40-ww-local-pass");

  for (const n of NAMES) {
    await page.getByRole("button", { name: n, exact: true }).click();
    await page.getByRole("button", { name: "Rolle aufdecken" }).click();
    await expect(page.getByTestId("my-role")).toBeVisible();
    if (n === "Anna") await shot(page, "41-ww-local-role");
    await page.getByRole("button", { name: "Verdeckt – weitergeben" }).click();
  }
  await page.getByRole("button", { name: /Alle kennen ihre Rolle/ }).click();
  await expect(page.getByTestId("ww-phase")).toHaveText("Nacht 1");

  // Nacht durchspielen: immer die erste Wahl treffen
  for (let i = 0; i < 12 && (await page.getByTestId("ww-phase").textContent())?.includes("Nacht"); i++) {
    const confirm = page.getByRole("button", { name: /fressen|Opfer wählen|Rolle ansehen|Bestätigen|Beschützen/ });
    if (await confirm.isVisible()) {
      const label = await confirm.textContent();
      if (label?.includes("Opfer") || label?.includes("Rolle ansehen")) await page.getByRole("group").getByRole("button").first().click();
      await shot(page, `42-ww-local-step-${i}`);
      await confirm.click();
    }
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expect(page.getByTestId("news")).toBeVisible();
  await expectNoScroll(page);
  await shot(page, "43-ww-local-day");
  await page.getByRole("button", { name: "Niemand" }).click();
  await page.getByRole("button", { name: "Niemanden verurteilen" }).click();
  await expect(page.getByTestId("ww-phase")).toHaveText("Nacht 2");
});

async function roleOf(p: Page) {
  const card = p.getByRole("button", { name: /Rolle aufdecken|Deine Rolle/ }).first();
  if ((await card.getAttribute("aria-label"))?.includes("aufdecken")) await card.click();
  return (await p.getByTestId("my-role").first().textContent())!.trim();
}

test("Werwolf online, die App erzählt – fünf Handys", async ({ browser }) => {
  test.setTimeout(120_000);
  const phones = await Promise.all(NAMES.map(() => newPhone(browser)));
  const [host] = phones;
  const code = await createRoom(host, "werwolf", "Anna", "1313");
  for (let i = 1; i < 5; i++) await joinRoom(phones[i], code, NAMES[i], "1313");
  await host.getByRole("button", { name: "Spiel starten" }).click();

  const roles: string[] = [];
  for (const p of phones) {
    roles.push(await roleOf(p));
    await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  }
  expect(roles.filter((r) => r === "Werwolf")).toHaveLength(1);
  expect(roles).toContain("Seherin");
  expect(roles).toContain("Hexe");
  await expect(host.getByTestId("ww-phase")).toHaveText("Nacht 1");

  // Jeder hat nachts etwas zu tippen – Wolf und Seherin handeln, die anderen verdächtigen
  const wolf = phones[roles.indexOf("Werwolf")];
  const seer = phones[roles.indexOf("Seherin")];
  const witch = phones[roles.indexOf("Hexe")];
  await expectNoScroll(wolf);
  await shot(wolf, "44-ww-online-wolf");
  await shot(phones[roles.indexOf("Dorfbewohner")], "45-ww-online-villager-night");
  await wolf.getByRole("group").getByRole("button").first().click();
  await seer.getByRole("group").getByRole("button").first().click();
  await seer.getByRole("button", { name: "Rolle ansehen" }).click();
  await expect(seer.getByText(/ ist .*Gib jetzt noch deinen Verdacht ab/)).toBeVisible();
  for (const [i, p] of phones.entries()) {
    if (["Dorfbewohner"].includes(roles[i])) await p.getByRole("group").getByRole("button").first().click();
  }
  await expect(witch.getByText("Opfer der Werwölfe:")).toBeVisible();
  await shot(witch, "46-ww-online-witch");
  await witch.getByRole("button", { name: "Bestätigen" }).click();

  for (const p of phones) await expect(p.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expect(host.getByTestId("news")).toContainText("Heute Nacht");
  await expectNoScroll(seer);
  await shot(seer, "47-ww-online-day");
  // Eine lebende Person enthält sich, der Host (lebend oder tot) beendet die Abstimmung
  for (const p of phones) {
    const abstain = p.getByRole("button", { name: "Enthaltung" });
    if (await abstain.isVisible()) { await abstain.click(); break; }
  }
  await host.getByRole("button", { name: /Abstimmung beenden/ }).click();
  await expect(host.getByTestId("ww-phase")).toHaveText("Nacht 2");
});

test("Werwolf online mit Spielleiter – sechs Handys", async ({ browser }) => {
  test.setTimeout(120_000);
  const names = ["Leiter", ...NAMES];
  const phones = await Promise.all(names.map(() => newPhone(browser)));
  const [lead] = phones;
  const code = await createRoom(lead, "werwolf", "Leiter", "4242");
  await lead.getByRole("radio", { name: /Spielleiter/ }).click();
  for (let i = 1; i < 6; i++) await joinRoom(phones[i], code, names[i], "4242");
  await lead.getByRole("button", { name: "Spiel starten" }).click();

  await expect(lead.getByText("Rollen sind verteilt")).toBeVisible();
  for (const p of phones.slice(1)) {
    await roleOf(p);
    await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  }
  await shot(lead, "48-ww-leader-reveal");
  await lead.getByRole("button", { name: "Nacht beginnen" }).click();
  await expect(phones[1].getByText(/Augen zu!/)).toBeVisible();

  for (let i = 0; i < 12 && (await lead.getByTestId("ww-phase").textContent())?.includes("Nacht"); i++) {
    const confirm = lead.getByRole("button", { name: /fressen|Opfer wählen|Rolle ansehen|Bestätigen/ });
    if (await confirm.isVisible()) {
      const label = await confirm.textContent();
      if (label?.includes("Opfer") || label?.includes("Rolle ansehen")) await lead.getByRole("group").getByRole("button").first().click();
      if (label?.includes("Opfer")) await shot(lead, "49-ww-leader-wolves");
      await confirm.click();
    }
    await lead.getByRole("button", { name: "Weiter" }).click();
    await lead.waitForTimeout(300);
  }
  await expect(lead.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expect(phones[2].getByTestId("news")).toBeVisible();
  await expectNoScroll(lead);
  await shot(lead, "50-ww-leader-day");
  await shot(phones[2], "51-ww-player-day");
});

/** Einen Nachtschritt am Gerät erledigen – egal welche Rolle dran ist */
async function doStep(page: Page) {
  for (const name of [/Bleibt beim Dorf/, /Nein, fressen/, /Kein Opfer – weiter/]) {
    const b = page.getByRole("button", { name });
    if (await b.isVisible()) { await b.click(); return; }
  }
  const confirm = page.getByRole("button", { name: /fressen|wählen|ansehen|Bestätigen|Beschützen|Schnüffeln|markieren|Vorbild|Zwei Personen/ }).last();
  if (!(await confirm.isVisible())) return;
  const options = page.getByRole("group").locator("button:not([disabled])");
  for (let i = 0; i < 3 && !(await confirm.isEnabled()); i++) await options.nth(i).click();
  await confirm.click();
}

test("Werwolf lokal mit Rollen aus allen Erweiterungen", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/werwolf/lokal");
  const names = ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn", "Gina", "Hugo", "Ida", "Jan", "Kim", "Lea"];
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("radio", { name: /^2$/ }).click();
  for (const role of [/Wildes Kind/, /Wolfshund/, /Fuchs/, /Rabe/, /Urwolf/, /Heiler/, /Der Alte/]) {
    await page.getByRole("checkbox", { name: role }).click();
  }
  await shot(page, "52-ww-roles-settings");
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await page.getByRole("button", { name: /Nacht beginnen/ }).click();
  await expect(page.getByTestId("ww-phase")).toHaveText("Nacht 1");
  for (let i = 0; i < 25 && (await page.getByTestId("ww-phase").textContent())?.includes("Nacht"); i++) {
    await doStep(page);
    if (i === 3) await shot(page, "53-ww-roles-step");
    const next = page.getByRole("button", { name: "Weiter" });
    if (await next.isVisible()) await next.click();
    await page.waitForTimeout(250);
  }
  await expect(page.getByTestId("ww-phase")).toHaveText(/Tag 1|Ende/);
  await expectNoScroll(page);
  await shot(page, "54-ww-roles-day");
});

test("Werwolf lokal mit eigenen Karten und Hauptmann", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/spiel/werwolf/lokal");
  for (const n of ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"]) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("radio", { name: /Spielleiter/ }).click();
  await page.getByRole("radio", { name: /Eigene Karten/ }).click();
  await page.getByRole("checkbox", { name: /Hauptmann/ }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await expect(page.getByText("Eigene Karten zuordnen")).toBeVisible();
  await page.getByRole("button", { name: "Cem", exact: true }).click();
  await page.getByRole("group", { name: "Rolle" }).getByRole("button", { name: /Werwolf$/ }).first().click();
  await page.getByRole("button", { name: "Anna", exact: true }).click();
  await page.getByRole("group", { name: "Rolle" }).getByRole("button", { name: /Seherin/ }).click();
  await expectNoScroll(page);
  await shot(page, "55-ww-own-cards");
  await page.getByRole("button", { name: /Fertig – Nacht beginnen/ }).click();
  for (let i = 0; i < 12 && (await page.getByTestId("ww-phase").textContent())?.includes("Nacht"); i++) {
    await doStep(page);
    const next = page.getByRole("button", { name: "Weiter" });
    if (await next.isVisible()) await next.click();
    await page.waitForTimeout(250);
  }
  await expect(page.getByTestId("ww-phase")).toHaveText("Wahl");
  await page.getByRole("group").getByRole("button", { name: "Dora" }).click();
  await shot(page, "56-ww-captain-election");
  await page.getByRole("button", { name: /wird Hauptmann/ }).click();
  await expect(page.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expect(page.getByLabel("Hauptmann")).toBeVisible();
});

test("Werwolf online: Hauptmannwahl und Stichwahl am Handy", async ({ browser }) => {
  test.setTimeout(120_000);
  const phones = await Promise.all(NAMES.map(() => newPhone(browser)));
  const [host] = phones;
  const code = await createRoom(host, "werwolf", "Anna", "8080");
  await host.getByRole("checkbox", { name: /Hauptmann/ }).click();
  await host.getByRole("radio", { name: /Stichwahl/ }).click();
  await host.getByRole("checkbox", { name: /^Hexe ein Heil/ }).click();
  await host.getByRole("checkbox", { name: /^Seherin sieht jede/ }).click();
  for (let i = 1; i < 5; i++) await joinRoom(phones[i], code, NAMES[i], "8080");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of phones) await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  await expect(host.getByTestId("ww-phase")).toHaveText("Nacht 1");
  // Der Host beendet die Nacht (so bleibt nichts hängen, falls jemand nicht reagiert)
  await host.getByRole("button", { name: "Menü" }).click();
  await host.getByRole("button", { name: /Nacht beenden/ }).click();
  await host.getByRole("button", { name: "Ja, weiter" }).click();
  await host.keyboard.press("Escape");
  await expect(host.getByTestId("ww-phase")).toHaveText("Wahl");
  const alivePhones = [];
  for (const p of phones) if (await p.getByText("Hauptmannwahl", { exact: true }).isVisible()) alivePhones.push(p);
  await shot(alivePhones[0], "57-ww-online-election");
  for (const p of alivePhones) await p.getByRole("group").getByRole("button").first().click();
  await expect(host.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expect(host.getByLabel("Hauptmann")).toBeVisible();
});
