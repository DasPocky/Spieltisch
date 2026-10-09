import { expect, test, type Browser, type Page } from "@playwright/test";
import { createRoom, joinRoom, shot } from "./util";

/**
 * Sprachchat Ende-zu-Ende mit Fake-SFU (REALTIME_FAKE=1 im Dev-Server). Im Browser ersetzen wir Kamera/Mikro
 * und die WebRTC-Verbindung durch Attrappen, die das SDP des Fake-SFU verstehen und Spuren melden.
 */
const FAKE_RTC = () => {
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

async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE" });
  await ctx.addInitScript(FAKE_RTC);
  return ctx.newPage();
}

test("Sprachchat: beitreten, hören, stumm, nachts still, verlassen", async ({ browser }) => {
  const [anna, ben, cem] = await Promise.all([phone(browser), phone(browser), phone(browser)]);
  const code = await createRoom(anna, "einenacht", "Anna", "3131");
  await joinRoom(ben, code, "Ben", "3131");
  await joinRoom(cem, code, "Cem", "3131");

  // Anna tritt nur mit Sprache bei
  await anna.getByRole("button", { name: "Audio & Video", exact: true }).click();
  await anna.getByRole("button", { name: "Nur Sprache" }).click();
  await expect(anna.getByTestId("call-strip")).toBeVisible();
  // Ben sieht, dass schon jemand drin ist, und kommt mit Video dazu
  await expect(ben.getByRole("button", { name: "Audio & Video", exact: true })).toContainText("1");
  await ben.getByRole("button", { name: "Audio & Video", exact: true }).click();
  await ben.getByRole("button", { name: "Mit Video" }).click();
  const strip = (p: Page) => p.getByRole("group", { name: "Im Sprachchat" });
  await expect(strip(anna).getByRole("button")).toHaveCount(2);
  await expect(strip(ben).getByRole("button")).toHaveCount(2);
  // Anna hat Bens Ton abgeholt
  await expect.poll(() => anna.locator("audio").count()).toBeGreaterThan(0);
  await expect(ben.getByRole("button", { name: "Kamera aus" })).toBeVisible();

  // Anna schaltet stumm – Ben sieht das
  await anna.getByRole("button", { name: "Mikro aus" }).click();
  await expect(strip(ben).getByRole("button", { name: "Anna (stumm)" })).toBeVisible();
  await anna.getByRole("button", { name: "Mikro an" }).click();
  await expect(strip(ben).getByRole("button", { name: "Anna", exact: true })).toBeVisible();
  await shot(ben, "81-call-strip");

  // Spiel starten – in der Nacht sind die Mikros aus
  await anna.getByRole("button", { name: "Spiel starten" }).click();
  for (const p of [anna, ben, cem]) await p.getByRole("button", { name: "Gesehen – bereit" }).click();
  await expect(anna.getByTestId("call-strip").getByText("still", { exact: true })).toBeVisible();
  await expect(strip(ben).getByRole("button", { name: "Anna (stumm)" })).toBeVisible();
  await shot(anna, "82-call-night");

  // Anna legt auf
  await anna.getByRole("button", { name: "Chat verlassen" }).click();
  await expect(strip(ben).getByRole("button")).toHaveCount(1);
  await expect(anna.getByTestId("call-strip")).toHaveCount(0);
});

test("Sprachchat: nur Mitspieler, nur eigene Sitzungen", async ({ browser, request }) => {
  const anna = await phone(browser);
  const code = await createRoom(anna, "tutto", "Anna", "3232");
  const creds = await anna.evaluate((c) => JSON.parse(localStorage.getItem(`spieltisch:room:${c}`)!), code);
  const call = (data: object) => request.post(`/api/rooms/${code}/call`, { data });
  expect((await call({ playerId: creds.playerId, token: "falsch", op: "new" })).status()).toBe(403);
  const ok = await call({ ...creds, op: "new" });
  expect(ok.status()).toBe(200);
  const { sessionId } = await ok.json();
  // fremde Sitzung abholen: verboten
  const pull = await call({ ...creds, op: "tracks", session: sessionId, payload: { tracks: [{ location: "remote", sessionId: "fremdesession123", trackName: "a-x" }] } });
  expect(pull.status()).toBe(403);
  // Sitzung eines anderen benutzen: verboten
  expect((await call({ ...creds, op: "renegotiate", session: "fremdesession123", payload: {} })).status()).toBe(403);
});
