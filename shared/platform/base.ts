/**
 * Basispfad der App: leer (Spieltisch an der Wurzel der Adresse) oder z. B. „/spieltisch“ unter endlab.de.
 * Beim Bauen eingesetzt (`APP_BASE`, siehe vite.config.ts) – ohne Angabe und in den Unit-Tests leer.
 * Alle Pfade im Code bleiben „logisch“ (/r/CODE, /api/…); erst hier kommt der Basispfad davor bzw. weg.
 */
declare const __APP_BASE__: string | undefined;
export const BASE: string = typeof __APP_BASE__ === "string" ? __APP_BASE__.replace(/\/+$/, "") : "";

/** Liegt der Pfad schon unter dem Basispfad? */
const under = (p: string, base: string) => !!base && (p === base || p.startsWith(`${base}/`) || p.startsWith(`${base}?`) || p.startsWith(`${base}#`));

/** Logischer Pfad → Adresse (mehrfaches Aufrufen schadet nicht: schon vorangestellt bleibt so) */
export function withBase(path: string, base = BASE): string {
  if (!base || !path.startsWith("/") || path.startsWith("//") || under(path, base)) return path;
  return `${base}${path}`;
}

/** Adresse → logischer Pfad (ohne Basispfad; „/spieltisch“ allein wird „/“) */
export function stripBase(path: string, base = BASE): string {
  if (!under(path, base)) return path;
  const rest = path.slice(base.length);
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** Kurzform für Adressen von Anfragen und Dateien: url("/api/config") */
export const url = (path: string) => withBase(path);
