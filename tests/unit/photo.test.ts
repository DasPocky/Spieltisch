import { describe, expect, it } from "vitest";
import { fromBase64, PHOTO_KEY_RE, photoType } from "@shared/platform/photo";
import { parseClientMessage } from "@shared/platform/parse";

const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("Fotos prüfen", () => {
  it("erkennt echte Bilder an den ersten Bytes", () => {
    expect(photoType(fromBase64(PNG_1PX)!)).toBe("image/png");
    expect(photoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(photoType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    // Text, HTML, zu kurz: kein Bild
    expect(photoType(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(photoType(new TextEncoder().encode("<html><body>x</body></html>"))).toBeNull();
    expect(photoType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
  it("Base64 nur gültig", () => {
    expect(fromBase64("abc")).toBeNull();
    expect(fromBase64("ab$=")).toBeNull();
    expect(fromBase64("aGFsbG8=")).toEqual(new TextEncoder().encode("hallo"));
  });
  it("Nachricht: nur Text in Grenzen oder null", () => {
    expect(parseClientMessage({ type: "photo", data: null })).toEqual({ type: "photo", data: null });
    expect(parseClientMessage({ type: "photo", data: PNG_1PX })).toEqual({ type: "photo", data: PNG_1PX });
    expect(parseClientMessage({ type: "photo", data: "x".repeat(200_000) })).toBeNull();
    expect(parseClientMessage({ type: "photo", data: 5 })).toBeNull();
  });
  it("Speichername ist nicht erratbar und eng geprüft", () => {
    expect(PHOTO_KEY_RE.test(`r/${"a".repeat(64)}/${"Ab3".repeat(6)}Xy`)).toBe(true);
    expect(PHOTO_KEY_RE.test(`r/${"a".repeat(64)}/../x`)).toBe(false);
    expect(PHOTO_KEY_RE.test("r/abc/def")).toBe(false);
  });
});
