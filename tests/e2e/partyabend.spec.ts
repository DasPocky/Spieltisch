import { expect, test, type Page } from "@playwright/test";
import { ALL_ON, closeSettings, createRoom, openSettings, setConfig } from "./util";

/** Alles oder nichts mit Ziel 1.000 schnell gewinnen: bis eine Karte mit Würfelpunkten kommt, dann 1.000 eintragen */
async function winAlles(page: Page) {
  await openSettings(page);
  const target = page.getByRole("button", { name: "Spielziel verringern" });
  for (let i = 0; i < 5; i++) await target.click();
  await expect(page.getByTestId("setting-target")).toHaveText("1.000");
  await closeSettings(page);
  await expect(page.getByTestId("settings-summary")).toContainText("Spielziel 1.000");
  await page.getByRole("button", { name: "Spiel starten" }).click();
  const k = page.getByRole("button", { name: "+1.000", exact: true });
  // Karten im Stapel (Kopfzeile) – ändert sich erst, wenn der Server die nächste Karte gezogen hat
  const pile = () => page.getByRole("banner").getByText(/Karten/).textContent();
  for (let i = 0; i < 40 && !(await k.isVisible()); i++) {
    const before = await pile();
    await page.getByRole("button", { name: /Niete|ächster Spieler/i }).first().click();
    await expect.poll(pile).not.toBe(before);
    await page.waitForTimeout(100);
  }
  await k.click();
  // online erst weiter, wenn der Server die Punkte bestätigt hat
  await expect(page.getByTestId("turn-pts")).toHaveText("1.000");
  await page.getByRole("button", { name: /eintragen/ }).click();
  await expect(page.getByText(/mit 1\.000 Punkten/)).toBeVisible();
}

/** WebSocket im Browser: beitreten, Nachrichten schicken, Antworten sammeln */
async function socket(page: Page, code: string, send: object[], waitMs = 900) {
  return page.evaluate(async ({ code, send, waitMs }) => {
    const ws = new WebSocket(`${location.origin.replace("http", "ws")}/api/rooms/${code}/ws`);
    const got: { type: string; message?: string; playerId?: string; token?: string }[] = [];
    ws.onmessage = (e) => { try { got.push(JSON.parse(e.data)); } catch { /* pong */ } };
    await new Promise((r) => (ws.onopen = r));
    for (const m of send) { ws.send(JSON.stringify(m)); await new Promise((r) => setTimeout(r, 200)); }
    await new Promise((r) => setTimeout(r, waitMs));
    ws.close();
    return got;
  }, { code, send, waitMs });
}

test("Partyabend am Server: Plan nur mit freigegebenen Spielen, Start eines gesperrten Spiels abgelehnt", async ({ page, request }) => {
  await setConfig(request, { ...ALL_ON, games: { maumau: "off" } });
  try {
    const { code } = await (await request.post("/api/rooms", { data: { pin: "5151", game: "alles" } })).json();
    await page.goto("/");
    const join = { type: "join", name: "Anna", pin: "5151", nonce: "nonce-party-1" };
    const got = await socket(page, code, [join, { type: "action", id: "plan-1", action: { type: "setPlan", games: ["alles", "maumau"] } }]);
    expect(got.find((m) => m.type === "error")?.message).toMatch(/nicht freigegeben/);
    // Lobby steht auf einem Spiel, das danach abgeschaltet wird: Start abgelehnt
    await setConfig(request, { ...ALL_ON, games: { alles: "off" } });
    const me = got.find((m) => m.type === "joined")!;
    const start = await socket(page, code, [{ type: "join", playerId: me.playerId, token: me.token }, { type: "action", id: "start-1", action: { type: "start" } }]);
    expect(start.find((m) => m.type === "error")?.message).toMatch(/abgeschaltet/);
  } finally {
    await setConfig(request, ALL_ON);
  }
});

test("Gewertete Partie: nach dem Verbuchen lässt sich ihr Ende nicht mehr zurücknehmen", async ({ page }) => {
  await createRoom(page, "alles", "Anna", "5252");
  await winAlles(page);
  // In der Testumgebung wird nach 1,5 s verbucht (sonst 2 Minuten)
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Menü" }).click();
  await page.getByRole("button", { name: "Letzten Zug zurücknehmen" }).click();
  await expect(page.getByText(/schon gewertet/)).toBeVisible();
  await expect(page.getByText(/mit 1\.000 Punkten/)).toBeVisible();
});
