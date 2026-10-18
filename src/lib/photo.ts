import { PHOTO_MAX_BYTES, PHOTO_SIZE } from "@shared/platform/photo";

/**
 * Foto fürs Hochladen vorbereiten: mittig quadratisch zuschneiden, auf PHOTO_SIZE verkleinern, als JPEG speichern
 * (geht auf allen Handys). Ergebnis als Base64 – meist 10–30 KB. Wirft mit verständlicher Meldung.
 */
export async function shrinkPhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Das ist kein Bild.");
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { throw new Error("Das Bild ließ sich nicht öffnen."); }
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  const g = canvas.getContext("2d")!;
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bmp.close();
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", q));
    if (blob && blob.size <= PHOTO_MAX_BYTES) return toBase64(new Uint8Array(await blob.arrayBuffer()));
  }
  throw new Error("Das Bild ist zu groß.");
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
