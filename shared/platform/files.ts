/**
 * Dateien der App in R2 (Bucket „spieltisch-dateien“, Ordner „assets/“): Bilder für Karten und Bühne.
 * Hochladen nur über die Verwaltung; ausgeliefert unter /api/asset/<Ordner>/<Name>.
 * (Fotos der Spieler liegen im selben Bucket unter „r/“ – siehe photo.ts.)
 */
import { photoType } from "./photo";

export interface FileFolder { id: string; label: string; hint: string; ext: string[] }

export const FILE_FOLDERS: FileFolder[] = [
  { id: "bilder", label: "Bilder", hint: "Bilder für Karten und Bühne (.png, .jpg, .webp)", ext: ["png", "jpg", "jpeg", "webp"] },
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

/** Inhalt prüfen: echtes Bild (an den ersten Bytes) */
export function fileType(bytes: Uint8Array): string | null {
  return photoType(bytes);
}

export const assetUrl = (path: string) => `/api/asset/${path}`;
