import { beforeEach, describe, expect, it, vi } from "vitest";
import { pieceKey } from "@shared/platform/voice";

// Echte Stimme am Gerät: Meldungen fehlender Bausteine und Zwischenspeicher dürfen nichts dauerhaft verschlucken
vi.mock("../../src/platform/sound", () => ({
  voiceOut: () => ({
    out: {},
    ctx: {
      currentTime: 0,
      decodeAudioData: async () => ({ duration: 0.01 }),
      createBufferSource: () => {
        const src: { onended?: () => void; buffer: unknown; connect(): void; start(): void; stop(): void } = {
          buffer: null, connect() {}, stop() {},
          start() { setTimeout(() => src.onended?.(), 0); },
        };
        return src;
      },
    },
  }),
}));

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;
let handler: Handler;
const posts: string[][] = [];
let shift = 0;
const later = (ms: number) => { shift += ms; };
const realNow = Date.now.bind(Date);
beforeEach(() => {
  vi.resetModules();
  shift = 0;
  vi.spyOn(Date, "now").mockImplementation(() => realNow() + shift);
  posts.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/voice/missing") posts.push((JSON.parse(String(init?.body)) as { items: { text: string }[] }).items.map((i) => i.text));
    return handler(url, init);
  }));
});
const load = () => import("../../src/platform/realVoice");
const index = (keys: string[]) => new Response(JSON.stringify({ keys }), { status: 200 });

describe("Echte Stimme am Gerät", () => {
  it("Fehlgeschlagene Meldung wird beim nächsten Mal wiederholt", async () => {
    let online = false;
    handler = (url) => {
      if (url.endsWith("index.json")) return index([]);
      if (url === "/api/voice/missing") return online ? new Response("{}") : Promise.reject(new Error("offline"));
      return new Response(null, { status: 404 });
    };
    const { speakReal } = await load();
    expect(await speakReal("Hallo Welt.")).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    online = true;
    // Gleich danach noch nicht (kein Dauerfeuer), nach einer Minute wieder
    expect(await speakReal("Hallo Welt.")).toBe(false);
    expect(posts.length).toBe(1);
    later(61_000);
    expect(await speakReal("Hallo Welt.")).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(posts).toEqual([["Hallo Welt."], ["Hallo Welt."]]);
    // Erfolgreich gemeldet: nicht nach einer Minute, erst nach einer Stunde wieder
    later(61_000);
    expect(await speakReal("Hallo Welt.")).toBe(false);
    expect(posts.length).toBe(2);
    later(60 * 60_000);
    expect(await speakReal("Hallo Welt.")).toBe(false);
    expect(posts.length).toBe(3);
  });

  it("Ein fehlgeschlagener Abruf eines Bausteins bleibt nicht im Speicher hängen", async () => {
    const key = await pieceKey("neutral", "Hallo Welt.");
    let uploaded = false;
    handler = (url) => {
      if (url.endsWith("index.json")) return index([key]);
      if (url.endsWith(`${key}.mp3`)) return uploaded ? new Response(new ArrayBuffer(8)) : new Response(null, { status: 404 });
      return new Response("{}");
    };
    const { speakReal } = await load();
    expect(await speakReal("Hallo Welt.")).toBe(false);
    uploaded = true;
    expect(await speakReal("Hallo Welt.")).toBe(true);
  });

  it("Ohne Verzeichnis (Abruf gescheitert) wird nichts als fehlend gemeldet und bald neu gefragt", async () => {
    const key = await pieceKey("neutral", "Hallo Welt.");
    let up = false;
    handler = (url) => {
      if (url.endsWith("index.json")) return up ? index([key]) : Promise.reject(new Error("offline"));
      if (url.endsWith(".mp3")) return new Response(new ArrayBuffer(8));
      return new Response("{}");
    };
    const { speakReal } = await load();
    expect(await speakReal("Hallo Welt.")).toBe(false);
    expect(posts).toEqual([]);
    up = true;
    later(61_000);
    expect(await speakReal("Hallo Welt.")).toBe(true);
  });
});
