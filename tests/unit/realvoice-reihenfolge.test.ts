import { describe, expect, it, vi } from "vitest";
import { pieceKey, sentences, VOICE_INDEX } from "@shared/platform/voice";

/** Gerät mit WebAudio nachgestellt: wer gestartet und wer gestoppt wurde */
const started: string[] = [];
const stopped: string[] = [];
const ctx = {
  currentTime: 0,
  decodeAudioData: async (b: ArrayBuffer) => ({ duration: 0.01, label: new TextDecoder().decode(b) }),
  createBufferSource() {
    const src = {
      buffer: null as null | { label: string },
      onended: null as null | (() => void),
      connect() {},
      start() { started.push(src.buffer!.label); setTimeout(() => src.onended?.(), 5); },
      stop() { stopped.push(src.buffer!.label); },
    };
    return src;
  },
};
vi.mock("../../src/platform/sound", () => ({ voiceOut: () => ({ ctx, out: {} }) }));

describe("Echte Stimme", () => {
  it("eine ältere Ansage, die langsamer lädt, überholt die neuere nicht", async () => {
    const { speakReal, stopReal } = await import("../../src/platform/realVoice");
    const key = async (t: string) => pieceKey("neutral", sentences(t)[0]);
    const [a, b] = [await key("Anna ist dran."), await key("Ben ist dran.")];
    let release!: () => void;
    const slow = new Promise<void>((r) => { release = r; });
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith(VOICE_INDEX)) return new Response(JSON.stringify({ keys: [a, b] }));
      if (url.includes(a)) await slow;
      return new Response(url.includes(a) ? "A" : "B");
    });
    // wie speak(): erst abbrechen, dann sprechen
    stopReal();
    const first = speakReal("Anna ist dran.");
    await new Promise((r) => setTimeout(r, 20));
    stopReal();
    const second = speakReal("Ben ist dran.");
    await expect(second).resolves.toBe(true);
    release();
    // Die alte zählt als erledigt (keine Gerätestimme), spielt aber nicht und stoppt die neue nicht
    await expect(first).resolves.toBe(true);
    expect(started).toEqual(["B"]);
    expect(stopped).toEqual([]);
  });
});
