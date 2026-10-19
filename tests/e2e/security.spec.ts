import { expect, test, type Page } from "@playwright/test";

/**
 * Zugriffsregeln (Negativtests): fremdes Profil, fremde Gruppe, fremde Beitritts-Nonce, Fernseher ohne Chat,
 * Zuschauer ohne Züge, kaputte Nachrichten. Läuft direkt gegen die Schnittstellen, ohne Oberfläche.
 */
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const profileId = () => Array.from({ length: 16 }, () => AB[Math.floor(Math.random() * AB.length)]).join("");
const key = (c: string) => c.repeat(48);

test("Profil: die ID allein reicht nicht – lesen, ändern, Ergebnis, Übertragen und Löschen nur mit Schlüssel", async ({ request }) => {
  const id = profileId();
  const mine = { "x-profile-key": key("a") };
  const theirs = { "x-profile-key": key("b") };
  // Erster Schlüssel übernimmt das (neue) Profil
  expect((await request.put(`/api/profile/${id}`, { headers: mine, data: { name: "Ida" } })).ok()).toBe(true);
  for (const headers of [{}, theirs]) {
    expect((await request.get(`/api/profile/${id}`, { headers })).status()).toBe(403);
    expect((await request.put(`/api/profile/${id}`, { headers, data: { name: "Fremd" } })).status()).toBe(403);
    expect((await request.post(`/api/profile/${id}/result`, { headers, data: { gameId: "fuenfwuerfel", won: true, players: 2 } })).status()).toBe(403);
    expect((await request.post(`/api/profile/${id}/transfer`, { headers })).status()).toBe(403);
    expect((await request.delete(`/api/profile/${id}`, { headers })).status()).toBe(403);
  }
  expect((await (await request.get(`/api/profile/${id}`, { headers: mine })).json()).name).toBe("Ida");

  // Übertragen: das neue Gerät bekommt einen eigenen Schlüssel, der Code gilt einmal
  const { code } = await (await request.post(`/api/profile/${id}/transfer`, { headers: mine })).json();
  const taken = await (await request.post(`/api/transfer/${code}`)).json();
  expect(taken.id).toBe(id);
  expect(taken.key).toMatch(/^[0-9a-f]{48}$/);
  expect((await request.get(`/api/profile/${id}`, { headers: { "x-profile-key": taken.key } })).ok()).toBe(true);
  expect((await request.post(`/api/transfer/${code}`)).status()).toBe(404);
});

test("Gruppe: mit fremder Profil-ID nichts ändern, nur die Vorschau sehen", async ({ request }) => {
  const id = profileId();
  const mine = { "x-profile-key": key("c") };
  const g = await (await request.post("/api/groups", { headers: mine, data: { profile: id, member: "Ida", name: "Sicher" } })).json();
  const code = g.group.code as string;
  const wrong = { "x-profile-key": key("d") };
  expect((await request.put(`/api/groups/${code}`, { headers: wrong, data: { profile: id, name: "Gekapert" } })).status()).toBe(403);
  expect((await request.post(`/api/groups/${code}/result`, { headers: wrong, data: { profile: id, gameId: "fuenfwuerfel", players: [] } })).status()).toBe(403);
  const look = await (await request.get(`/api/groups/${code}`, { headers: { ...wrong, "x-profile": id } })).json();
  expect(look.group).toBeUndefined();
  expect(look.preview).toBeTruthy();
  const own = await (await request.get(`/api/groups/${code}`, { headers: { ...mine, "x-profile": id } })).json();
  expect(own.group.name).toBe("Sicher");
});

/** WebSocket im Browser öffnen, Nachrichten schicken und sammeln */
async function socket(page: Page, code: string, send: (object | string)[], waitMs = 1200): Promise<{ type: string; [k: string]: unknown }[]> {
  return page.evaluate(async ({ code, send, waitMs }) => {
    const ws = new WebSocket(`${location.origin.replace("http", "ws")}/api/rooms/${code}/ws`);
    const got: { type: string }[] = [];
    ws.onmessage = (e) => { try { got.push(JSON.parse(e.data)); } catch { /* pong */ } };
    await new Promise((r) => (ws.onopen = r));
    for (const m of send) { ws.send(typeof m === "string" ? m : JSON.stringify(m)); await new Promise((r) => setTimeout(r, 150)); }
    await new Promise((r) => setTimeout(r, waitMs));
    ws.close();
    return got;
  }, { code, send, waitMs });
}

test("Raum: Nonce ist kein Zugang, Fernseher bekommt keinen Chat, Zuschauer ziehen nicht, Unsinn wird abgelehnt", async ({ page, request }) => {
  const { code } = await (await request.post("/api/rooms", { data: { pin: "4711", game: "maumau" } })).json();
  await page.goto("/");
  // Anna tritt bei (mit Nonce) und schreibt in den Chat
  const anna = await socket(page, code, [{ type: "join", name: "Anna", pin: "4711", nonce: "nonce-anna-1" }, { type: "chat", id: "chat-1", text: "geheim" }]);
  const joined = anna.find((m) => m.type === "joined")!;
  expect(joined.token).toBeTruthy();

  // Mit Annas Nonce, aber falscher PIN: kein Token
  const thief = await socket(page, code, [{ type: "join", name: "X", pin: "0000", nonce: "nonce-anna-1" }]);
  expect(thief.some((m) => m.type === "joined")).toBe(false);
  expect(thief.find((m) => m.type === "error")?.code).toBe("bad_pin");

  // Großer Tisch: Spielstand ja, Chat nein – und Züge vom Tisch zählen nicht
  const table = await socket(page, code, [{ type: "table", pin: "4711" }, { type: "action", action: { type: "start" }, id: "tbl-start" }]);
  expect(table.some((m) => m.type === "state")).toBe(true);
  expect(JSON.stringify(table.filter((m) => m.type === "chat"))).not.toContain("geheim");
  expect(table.some((m) => m.type === "ack")).toBe(false);

  // Kaputte oder falsche Nachrichten: abgelehnt, nichts passiert
  const junk = await socket(page, code, ["{kaputt", { type: "join", name: 5 }, { type: "action", action: "start" }, { type: "gibtsnicht" }]);
  expect(junk.filter((m) => m.type === "error" && m.message === "Ungültige Nachricht.").length).toBe(4);
});

test("Dateien einspielen: ohne passenden Release-Schlüssel nimmt der Server nichts an", async ({ request }) => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  expect((await request.put("/api/release/files/bilder/test.png", { data: png })).status()).toBe(403);
  expect((await request.put("/api/release/files/bilder/test.png", { data: png, headers: { "x-release-key": "falsch" } })).status()).toBe(403);
});

test("KI-Sprüche: ausgeschaltet oder ohne Anbindung gibt es keinen Spruch (der Tisch nimmt feste Texte)", async ({ request }) => {
  const res = await request.post("/api/host/line", { data: { moment: "sieg", mood: "frech", name: "Anna", game: "Mau-Mau" } });
  expect(res.status()).toBe(204);
});
