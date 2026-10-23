/**
 * Dateien der App in R2 (Bucket „spieltisch-dateien“, Ordner „assets/“): Bilder für Karten und Bühne.
 * Hochladen nur über die Verwaltung; ausgeliefert unter /api/asset/<Ordner>/<Name>.
 * (Fotos der Spieler liegen im selben Bucket unter „r/“ – siehe photo.ts.)
 */
import { url } from "./base";
import { photoType } from "./photo";

export interface FileFolder { id: string; label: string; hint: string; ext: string[] }

export const FILE_FOLDERS: FileFolder[] = [
  { id: "bilder", label: "Bilder", hint: "Bilder für Karten und Bühne (.png, .jpg, .webp)", ext: ["png", "jpg", "jpeg", "webp"] },
  { id: "stimme", label: "Stimme", hint: "Bausteine der echten Stimme (.mp3) und ihr Verzeichnis (index.json) – kommen von der GitHub-Aktion „Stimme“", ext: ["mp3", "json"] },
];

/** Größte Datei */
export const FILE_MAX_BYTES = 25 * 1024 * 1024;
/** Präfix im Bucket */
export const ASSET_PREFIX = "assets/";

/** Ordner/Name – nur Kleinbuchstaben, Ziffern, Punkt, Strich; Endung passend zum Ordner */
export function assetPath(raw: string): { folder: FileFolder; path: string } | null {
  const m = raw.match(/^([a-z]+)\/([a-z0-9][a-z0-9._-]{0,60})$/);
  if (!m || m[2].includes("..")) return null;
  const folder = FILE_FOLDERS.find((f) => f.id === m[1]);
  const ext = m[2].split(".").pop() ?? "";
  if (!folder || !folder.ext.includes(ext)) return null;
  return { folder, path: `${m[1]}/${m[2]}` };
}

/** Inhalt prüfen (an den ersten Bytes): Bild, MP3 bzw. JSON – passend zur Endung */
export function fileType(bytes: Uint8Array, path = ""): string | null {
  const ext = path.split(".").pop() ?? "";
  if (ext === "mp3") {
    const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    const frame = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    return bytes.length > 64 && (id3 || frame) ? "audio/mpeg" : null;
  }
  if (ext === "json") {
    try { const v: unknown = JSON.parse(new TextDecoder().decode(bytes)); return v && typeof v === "object" ? "application/json" : null; } catch { return null; }
  }
  return photoType(bytes);
}

export const assetUrl = (path: string) => url(`/api/asset/${path}`);
