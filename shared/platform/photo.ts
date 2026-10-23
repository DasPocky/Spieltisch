/**
 * Fotos der Spieler (Selfie statt Tier) – liegen in R2, nicht im Raum. Das Handy verkleinert vorher auf ein kleines
 * Quadrat; der Server prüft Größe und Inhalt (echte JPEG-, PNG- oder WebP-Datei) und speichert unter einem nicht
 * erratbaren Namen. Wer im Raum ist, sieht den Namen im Spielstand; endet der Raum, werden seine Fotos gelöscht.
 */
import { url } from "./base";

/** Höchstgröße einer Datei – ein verkleinertes Quadrat hat meist 10–30 KB */
export const PHOTO_MAX_BYTES = 120_000;
/** Kantenlänge, auf die das Handy verkleinert */
export const PHOTO_SIZE = 256;
/** So lang darf das Foto als Base64 in einer Nachricht sein */
export const PHOTO_MAX_B64 = Math.ceil(PHOTO_MAX_BYTES / 3) * 4;
/** Speichername: r/<Raum-Objekt>/<Zufall> */
export const PHOTO_KEY_RE = /^r\/[0-9a-f]{64}\/[A-Za-z0-9]{20}$/;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** Bildtyp an den ersten Bytes erkennen (nicht an der Endung oder Angabe des Geräts) */
export function photoType(b: Uint8Array): PhotoType | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  return null;
}

/** Base64 → Bytes; null bei ungültiger Eingabe */
export function fromBase64(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) return null;
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}

/** Adresse, unter der das Foto ausgeliefert wird */
export const photoUrl = (key: string) => url(`/api/photo/${key}`);
