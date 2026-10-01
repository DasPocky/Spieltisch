import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, newPhone, shot } from "./util";

/**
 * Wackeliges Netz nachstellen: Ab `cut()` verschwinden alle Nachrichten der aktuellen Verbindung spurlos –
 * ohne sauberes Schließen, genau wie bei einem Handy im Funkloch. Neue Verbindungen laufen wieder normal.
 */
async function flakySocket(page: Page) {
  let conn = 0;
  let dead = -1;
  let deaf = -1;
  await page.routeWebSocket(/\/api\/rooms\/[A-Z0-9]+\/ws$/, (ws) => {
    const me = ++conn;
    const server = ws.connectToServer();
    ws.onMessage((m) => { if (me !== dead) server.send(m); });
    server.onMessage((m) => { if (me !== dead && me !== deaf) ws.send(m); });
  });
  return {
    cut: () => { dead = conn; },
    /** Nur die Antworten gehen verloren – der Zug selbst kommt beim Server an */
    deafen: () => { deaf = conn; },
    connections: () => conn,
  };
}

test("Funkloch: tote Verbindung wird erkannt, der Zug kommt genau einmal an", async ({ browser }) => {
  test.setTimeout(90_000);
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const net = await flakySocket(anna);
  const code = await createRoom(anna, "uno", "Anna", "5555");
  await joinRoom(ben, code, "Ben", "5555");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(7);
  // Anna ist dran (Host beginnt) – die Verbindung stirbt still, dann zieht sie
  await expect(anna.getByRole("button", { name: /ziehen/i }).first()).toBeEnabled();
  const before = net.connections();
  net.cut();
  await anna.getByRole("button", { name: /ziehen/i }).first().click();
  // Anna sieht, dass es hakt …
  await expect(anna.getByRole("status")).toContainText(/gesendet|wackelt/, { timeout: 8000 });
  await shot(anna, "85-network-flaky");
  // … das Handy verbindet sich von selbst neu und reicht den Zug nach: genau eine Karte mehr
  await expect.poll(() => net.connections(), { timeout: 20_000 }).toBeGreaterThan(before);
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(8, { timeout: 20_000 });
  await expect(ben.getByLabel("8 Karten")).toBeVisible();
  await anna.waitForTimeout(1500);
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(8);
  await expect(anna.getByRole("status")).toHaveCount(0);
});

test("Doppelt getippt ohne Netz: Aktion wird nur einmal ausgeführt", async ({ browser }) => {
  test.setTimeout(90_000);
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const net = await flakySocket(anna);
  const code = await createRoom(anna, "uno", "Anna", "6666");
  await joinRoom(ben, code, "Ben", "6666");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(7);
  net.cut();
  const draw = anna.getByRole("button", { name: /ziehen/i }).first();
  await draw.click();
  await draw.click({ force: true });
  await draw.click({ force: true });
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(8, { timeout: 25_000 });
  await anna.waitForTimeout(1500);
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(8);
});

test("Antwort geht verloren: der nachgereichte Zug wird nicht doppelt ausgeführt", async ({ browser }) => {
  test.setTimeout(90_000);
  const [anna, ben] = await Promise.all([newPhone(browser), newPhone(browser)]);
  const net = await flakySocket(anna);
  const code = await createRoom(anna, "uno", "Anna", "4444");
  await joinRoom(ben, code, "Ben", "4444");
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(7);
  net.deafen();
  await anna.getByRole("button", { name: /ziehen/i }).first().click();
  // Ben sieht den Zug sofort, Anna erst nach dem Wiederverbinden
  await expect(ben.getByLabel("8 Karten")).toBeVisible();
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(8, { timeout: 25_000 });
  await anna.waitForTimeout(1500);
  await expect(anna.getByTestId("hand").getByRole("img")).toHaveCount(8);
  await expect(ben.getByLabel("8 Karten")).toBeVisible();
});
