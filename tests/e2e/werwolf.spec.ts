import { expect, test, type Page } from "@playwright/test";
import { closeSettings, createRoom, expectNoScroll, joinRoom, newPhone, openSettings, shot } from "./util";

const NAMES = ["Anna", "Ben", "Cem", "Dora", "Emil"];

/** Hexe: erst „Nicht heilen“, dann „Niemand vergiften“ – liefert true, wenn sie dran war */
async function witch(page: Page) {
  if (await page.getByTestId("witch-heal").isVisible()) await page.getByRole("button", { name: "Nicht heilen" }).click();
  if (await page.getByTestId("witch-poison").isVisible()) { await page.getByRole("button", { name: "Niemand vergiften" }).click(); return true; }
  return false;
}
/** Manueller Ablauf mit „Weiter“ (Automatik aus) */
async function manual(page: Page) {
  await openSettings(page);
  await page.getByRole("checkbox", { name: /Automatik/ }).click();
  await closeSettings(page);
}
/** Hauptmannwahl am Gerät (Original: am ersten Tag) – die erste Person wird Hauptmann */
async function elect(page: Page) {
  await expect(page.getByTestId("ww-phase")).toHaveText("Wahl");
  await page.getByRole("group").getByRole("button").first().click();
  await page.getByRole("button", { name: /wird Hauptmann/ }).click();
}
/** Am Tag: Abstimmung starten und niemanden verurteilen */
async function nobody(page: Page) {
  const now = page.getByRole("button", { name: "Jetzt abstimmen" });
  if (await now.isVisible()) await now.click();
  await page.getByRole("button", { name: "Niemand" }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "Niemanden verurteilen" }).click();
}

test("Werwolf lokal: Rollen herumreichen, App liest vor, Nacht und Tag", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("spieltisch:werwolf:speech", "0"); });
  await page.goto("/spiel/werwolf/lokal");
  for (const n of NAMES) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await manual(page);
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
    await witch(page);
    const confirm = page.getByRole("button", { name: /fressen|Opfer wählen|Rolle ansehen|Beschützen/ });
    if (await confirm.isVisible()) {
      const label = await confirm.textContent();
      if (label?.includes("Opfer") || label?.includes("Rolle ansehen")) await page.getByRole("group").getByRole("button").first().click();
      await shot(page, `42-ww-local-step-${i}`);
      await confirm.click();
    }
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByTestId("news")).toBeVisible();
  await elect(page);
  await expect(page.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expectNoScroll(page);
  await shot(page, "43-ww-local-day");
  await nobody(page);
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
  // Countdown auf jedem Handy – nichts hängt an einem Einzelnen
  for (const p of phones) await expect(p.getByTestId("timer")).toContainText("Nacht");

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

  // Original: am ersten Tag wählt das Dorf zuerst einen Hauptmann
  for (const p of phones) await expect(p.getByTestId("ww-phase")).toHaveText("Wahl");
  for (const p of phones) {
    if (await p.getByText("Hauptmannwahl", { exact: true }).isVisible()) await p.getByRole("group").getByRole("button").first().click();
  }
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
  await openSettings(lead);
  await lead.getByRole("radio", { name: /Spielleiter/ }).click();
  await closeSettings(lead);
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
    await witch(lead);
    const confirm = lead.getByRole("button", { name: /fressen|Opfer wählen|Rolle ansehen/ });
    if (await confirm.isVisible()) {
      const label = await confirm.textContent();
      if (label?.includes("Opfer") || label?.includes("Rolle ansehen")) await lead.getByRole("group").getByRole("button").first().click();
      if (label?.includes("Opfer")) await shot(lead, "49-ww-leader-wolves");
      await confirm.click();
    }
    await lead.getByRole("button", { name: "Weiter" }).click();
    await lead.waitForTimeout(300);
  }
  await elect(lead);
  await expect(lead.getByTestId("ww-phase")).toHaveText("Tag 1");
  await expect(phones[2].getByTestId("news")).toBeVisible();
  await expectNoScroll(lead);
  await shot(lead, "50-ww-leader-day");
  await shot(phones[2], "51-ww-player-day");
});

/** Einen Nachtschritt am Gerät erledigen – egal welche Rolle dran ist */
async function doStep(page: Page) {
  if (await witch(page)) return;
  for (const name of [/Bleibt beim Dorf/, /Nein, fressen/, /Kein Opfer – weiter/]) {
    const b = page.getByRole("button", { name });
    if (await b.isVisible()) { await b.click(); return; }
  }
  const confirm = page.getByRole("button", { name: /fressen|wählen|ansehen|Beschützen|Schnüffeln|markieren|Vorbild|Zwei Personen/ }).last();
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
  await openSettings(page);
  await page.getByRole("radio", { name: /^2$/ }).click();
  for (const role of [/Wildes Kind/, /Wolfshund/, /Fuchs/, /Rabe/, /Urwolf/, /Heiler/, /Der Alte/]) {
    await page.getByRole("checkbox", { name: role }).click();
  }
  await shot(page, "52-ww-roles-settings");
  await closeSettings(page);
  await manual(page);
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
  await expect(page.getByTestId("ww-phase")).toHaveText(/Tag 1|Wahl|Ende/);
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
  await openSettings(page);
  await page.getByRole("radio", { name: /Spielleiter/ }).click();
  await page.getByRole("radio", { name: /Eigene Karten/ }).click();
  // Hauptmann ist Originalregel und schon an
  await expect(page.getByRole("checkbox", { name: /^Hauptmann/ })).toBeChecked();
  await closeSettings(page);
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
  await openSettings(host);
  await host.getByRole("button", { name: /^Hausregeln/ }).click();
  await host.getByRole("radio", { name: /Stichwahl/ }).click();
  await host.getByRole("checkbox", { name: /^Hexe ein Heil/ }).click();
  await host.getByRole("checkbox", { name: /^Seherin sieht jede/ }).click();
  await closeSettings(host);
  for (let i = 1; i < 5; i++) await joinRoom(phones[i], code, NAMES[i], "8080");
  await host.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of phones) await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  await expect(host.getByTestId("ww-phase")).toHaveText("Nacht 1");
  // Der Host beendet die Nacht (so bleibt nichts hängen, falls jemand nicht reagiert)
  // Überspringen steht erst da, wenn etwas hängt – oder auf „Hängt etwas?“
  await host.getByRole("button", { name: "Menü" }).click();
  await host.getByRole("button", { name: "Hängt etwas?" }).click();
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

test("Werwolf Automatik: ein Handy, niemand muss „Weiter“ tippen", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("spieltisch:werwolf:speech", "0"); });
  await page.goto("/spiel/werwolf/lokal");
  for (const n of NAMES) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  // Übersicht und Vorlagen
  await openSettings(page);
  await expect(page.getByTestId("ww-deck")).toContainText("5 Spieler bekommen");
  await page.getByRole("button", { name: /Klassisch/ }).click();
  await expect(page.getByTestId("ww-deck")).toContainText("Jäger");
  await page.getByRole("button", { name: /Einsteiger/ }).click();
  await expect(page.getByTestId("ww-deck")).not.toContainText("Jäger");
  // Eigene Zeiten: Felder erscheinen nur bei „Eigene“
  await page.getByRole("radio", { name: /^Eigene selbst/ }).click();
  await expect(page.getByTestId("setting-tRole")).toHaveText("20");
  await page.getByRole("button", { name: "Zeit pro Rolle (s) erhöhen" }).click();
  await expect(page.getByTestId("setting-tRole")).toHaveText("25");
  await page.getByRole("radio", { name: /Zügig/ }).click();
  await expect(page.getByTestId("setting-tRole")).toHaveCount(0);
  // Nachtgeräusche an – darf nichts stören
  await page.getByRole("checkbox", { name: /Nachtgeräusche/ }).click();
  await shot(page, "58-ww-setup");
  await closeSettings(page);

  await page.getByRole("button", { name: "Spiel starten" }).click();
  // Geführt: das Handy geht reihum, danach beginnt die Nacht von selbst
  for (const n of NAMES) {
    await expect(page.getByTestId("reveal-next")).toHaveText(n);
    await page.getByRole("button", { name: `Ich bin ${n}` }).click();
    await page.getByRole("button", { name: "Rolle aufdecken" }).click();
    await expect(page.getByTestId("role-goal")).toBeVisible();
    if (n === "Anna") await shot(page, "58b-ww-guided-reveal");
    await page.getByRole("button", { name: /^Verdeckt/ }).click();
  }
  await expect(page.getByText("Alle kennen ihre Rolle")).toBeVisible();
  await expect(page.getByTestId("ww-clock")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Weiter" })).toHaveCount(0);

  // Jede Rolle wählt – bestätigt wird durch Gedrückthalten, weiter geht es von selbst
  let shotDone = false;
  for (let i = 0; i < 400 && (await page.getByTestId("ww-phase").textContent())?.includes("Nacht"); i++) {
    if (await witch(page)) continue;
    const hold = page.getByTestId("hold");
    if (await hold.isVisible() && !(await hold.isEnabled())) await page.getByRole("group").locator("button:not([disabled])").first().click();
    if (await hold.isVisible() && await hold.isEnabled()) {
      if (!shotDone) { await shot(page, "59-ww-auto-night"); shotDone = true; }
      await hold.click({ delay: 900 });
    }
    const seen = page.getByRole("button", { name: "Gesehen" });
    if (await seen.isVisible()) await seen.click();
    await page.waitForTimeout(250);
  }
  await expect(page.getByTestId("ww-phase")).toHaveText(/Tag 1|Ende/);
  if ((await page.getByTestId("ww-phase").textContent())?.includes("Tag")) {
    await expect(page.getByTestId("day-timer")).toBeVisible();
    await expectNoScroll(page);
    await shot(page, "60-ww-auto-day");
    await page.getByRole("button", { name: "Jetzt abstimmen" }).click();
    await expect(page.getByTestId("vote-count")).toBeVisible();
    await nobody(page);
    await expect(page.getByTestId("ww-phase")).toHaveText(/Nacht 2|Ende/);
  }
});
