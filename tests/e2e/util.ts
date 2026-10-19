import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

/** Admin-Passwort der Testumgebung (scripts/test-env.mjs) */
export const ADMIN_PW = "test-admin";
/** Alles eingeschaltet – so erwarten es die Spiel-Tests */
export const ALL_ON = { site: "on", games: {}, message: "", features: { online: true, call: true, groups: true, profiles: true, local: true, offline: false } };

/** Freigaben setzen (und optional den Zugangscode) */
export async function setConfig(request: APIRequestContext, config: object, code?: string | null) {
  const res = await request.post("/api/admin", { data: { password: ADMIN_PW, config, code } });
  expect(res.ok()).toBe(true);
}

/** Am Handy in der Verwaltung anmelden */
export async function adminLogin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin-Passwort").fill(ADMIN_PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByTestId("admin-tile-live")).toBeVisible();
}

/** Eigener Ordner – Playwright leert test-results bei jedem Lauf */
export const SHOTS = "screenshots";

export async function shot(page: Page, name: string) {
  // Kurze Animationen (Karten gleiten, Texte blenden) erst ausklingen lassen
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Die Seite darf auf dem Handy nicht scrollen. */
export async function expectNoScroll(page: Page) {
  const { scroll, height, scrollW, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight, height: window.innerHeight,
    scrollW: document.documentElement.scrollWidth, width: window.innerWidth,
  }));
  expect(scroll, "Seite ist höher als der Bildschirm").toBeLessThanOrEqual(height + 1);
  expect(scrollW, "Seite ist breiter als der Bildschirm").toBeLessThanOrEqual(width + 1);
}

/** Element liegt vollständig im sichtbaren Bereich (nichts abgeschnitten) */
export async function expectInView(page: Page, locator: import("@playwright/test").Locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, "Element nicht sichtbar").not.toBeNull();
  expect(box!.y + box!.height, "Element unten abgeschnitten").toBeLessThanOrEqual(vp.height + 1);
  expect(box!.x + box!.width, "Element rechts abgeschnitten").toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y, "Element oben abgeschnitten").toBeGreaterThanOrEqual(-1);
}

/** Lokale Lobby für ein Spiel öffnen (alter Link /spiel/<id>/lokal leitet dorthin weiter) */
export async function openLocal(page: Page, gameId: string) {
  await page.goto(`/spiel/${gameId}/lokal`);
  await expect(page).toHaveURL(/\/lokal$/);
  await expect(page.getByTestId("game-card")).toContainText("Gespielt wird");
}

/** Lokale Partie vorbereiten: Spieler eintragen, optional Einstellungen ändern und starten.
 * `fresh` leert vorher den Speicher (kein Profil, keine Vorlieben). */
export async function startLocal(page: Page, gameId: string, names: string[], opts: { fresh?: boolean; settings?: (p: Page) => Promise<void>; start?: boolean } = {}) {
  if (opts.fresh !== false) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  }
  await openLocal(page, gameId);
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  if (opts.settings) {
    await openSettings(page);
    await opts.settings(page);
    await closeSettings(page);
  }
  if (opts.start !== false) await page.getByRole("button", { name: "Spiel starten" }).click();
}

/** Einstellung „Echte Karten“ bzw. andere Auswahl per Name */
export const pick = (...names: RegExp[]) => async (p: Page) => { for (const n of names) await p.getByRole("radio", { name: n }).click(); };

/** Lokales Tutto mit Spielern starten */
export async function startLocalTutto(page: Page, names: string[]) {
  await openLocal(page, "tutto");
  for (const n of names) {
    await page.getByLabel("Name des Spielers").fill(n);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
  }
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

export async function newPhone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
  return ctx.newPage();
}

/** Online-Raum wie ein Mensch erstellen: Startseite → „Raum öffnen“ → Name + PIN → im Treffpunkt das Spiel wählen. Gibt den Code zurück. */
export async function createRoom(host: Page, gameId: string, name: string, pin: string): Promise<string> {
  await host.goto("/");
  // Als zuletzt gespieltes Spiel vormerken – so entsteht der Raum gleich mit diesem Spiel (wie beim Wiederkommen)
  await host.evaluate((id) => localStorage.setItem("spieltisch:lastGame", id), gameId);
  await host.getByRole("button", { name: "Raum öffnen" }).click();
  await host.getByLabel("Dein Name").fill(name);
  await host.getByLabel(/PIN/).fill(pin);
  await host.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(host).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  await host.getByTestId("meet-play").click();
  await host.getByTestId(`pick-${gameId}`).click();
  await expect(host.getByRole("heading", { name: "Was spielt ihr?" })).toBeHidden();
  return (await host.getByTestId("room-code").textContent())!.trim();
}

/** Lobby: Einstellungen öffnen (stehen als Zusammenfassung auf der Seite) */
export async function openSettings(page: Page) {
  await page.getByTestId("settings-summary").click();
  await expect(page.getByRole("heading", { name: /^Einstellungen/ })).toBeVisible();
}

/** Einstellungen wieder zu – danach ist „Spiel starten“ erreichbar */
export async function closeSettings(page: Page) {
  await page.getByRole("button", { name: "Fertig", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

export async function joinRoom(page: Page, code: string, name: string, pin: string) {
  await page.goto(`/r/${code}`);
  await page.getByLabel("Dein Name").fill(name);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Beitreten" }).click();
  await expect(page.getByText(/Warte, bis der Host/)).toBeVisible();
}

/** Sprachausgabe mitschreiben statt abspielen – vor dem ersten goto aufrufen. Auslesen mit `spoken()`. */
export async function captureSpeech(page: Page) {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    const fake = {
      speak: (u: SpeechSynthesisUtterance) => { said.push(u.text); setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 10); },
      cancel: () => {}, getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {}, speaking: false, pending: false, paused: false,
    };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  });
}

export const spoken = async (page: Page) => (await page.evaluate(() => (window as unknown as { __said?: string[] }).__said ?? [])).join(" ");

/** Die Ansagen kommen in dieser Reihenfolge vor */
export function expectInOrder(text: string, parts: string[]) {
  let at = -1;
  for (const p of parts) { const i = text.indexOf(p, at + 1); expect(i, `Ansage „${p}“ fehlt oder kommt zu früh`).toBeGreaterThan(at); at = i; }
}

/**
 * Sprachchat Ende-zu-Ende mit Fake-SFU (REALTIME_FAKE=1 im Dev-Server). Im Browser ersetzen wir Kamera/Mikro
 * und die WebRTC-Verbindung durch Attrappen, die das SDP des Fake-SFU verstehen und Spuren melden.
 */
export const FAKE_RTC = () => {
  const fakeStream = (video: boolean) => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    osc.connect(dest); osc.start();
    const s = new MediaStream(dest.stream.getAudioTracks());
    if (video) {
      const c = document.createElement("canvas"); c.width = 64; c.height = 48;
      const g = c.getContext("2d")!; g.fillStyle = "#3a7"; g.fillRect(0, 0, 64, 48);
      s.addTrack(c.captureStream(5).getVideoTracks()[0]);
    }
    return s;
  };
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async (c: MediaStreamConstraints) => fakeStream(!!c.video) } });
  class FakePC {
    ontrack: ((e: { transceiver: { mid: string }; track: MediaStreamTrack }) => void) | null = null;
    localDescription: RTCSessionDescriptionInit | null = null;
    n = 0;
    addTransceiver(track: MediaStreamTrack) { return { mid: String(this.n++), sender: { track } }; }
    async createOffer() { return { type: "offer", sdp: "fake-offer" }; }
    async createAnswer() { return { type: "answer", sdp: "fake-answer" }; }
    async setLocalDescription(d: RTCSessionDescriptionInit) { this.localDescription = d; }
    async setRemoteDescription(d: RTCSessionDescriptionInit) {
      const mids = /mids=([\w,]+)/.exec(d.sdp ?? "")?.[1]?.split(",") ?? [];
      for (const mid of mids) setTimeout(() => this.ontrack?.({ transceiver: { mid }, track: fakeStream(false).getAudioTracks()[0] }), 10);
    }
    close() {}
  }
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakePC;
};
