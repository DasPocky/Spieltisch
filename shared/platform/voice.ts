/**
 * Echte Stimme: Ansagen werden aus Bausteinen zusammengesetzt – feste Satzteile, Namen und Zahlen.
 * Jeder Baustein ist eine eigene Audiodatei in R2 (`assets/stimme/<Schlüssel>.mp3`), erzeugt von der
 * GitHub-Aktion „Stimme“ (scripts/stimme/). Fehlt ein Baustein, meldet das Gerät ihn (`/api/voice/missing`),
 * spricht den Satz mit der Gerätestimme, und die Aktion liefert ihn binnen einer Stunde nach.
 *
 * Ganze Sätze haben Vorrang: Kam ein Satz (auch mit Namen) einmal vor, wird er am Stück erzeugt und klingt
 * natürlicher; bis dahin hilft die Zerlegung in Bausteine.
 *
 * Der Schlüssel hängt an Stimmen-Fassung, Stimmung und Text – Python (Aktion) und TypeScript (Gerät, Worker)
 * rechnen gleich: sha256("<fassung>|<stimmung>|<text mit einfachen Leerzeichen>") → die ersten 16 Hex-Zeichen.
 */

/** Fassung der Stimme – erhöhen, wenn sich Modell oder Klang ändern (alles wird dann neu erzeugt) */
export const VOICE_VERSION = 2;

/** Stimmungen der Stimme (Sprecher im Modell) – neutral für Namen, Zahlen und normale Ansagen */
export const MOODS = ["neutral", "froh", "wuetend", "ueberrascht", "fluester", "beschwipst", "muede"] as const;
export type VoiceMood = (typeof MOODS)[number];
export const isMood = (x: unknown): x is VoiceMood => typeof x === "string" && (MOODS as readonly string[]).includes(x);

/** Längster Baustein – Ansagen sind kurz; schützt die Warteliste vor Missbrauch */
export const MAX_PIECE = 160;
/** Ordner in R2 (unter assets/) */
export const VOICE_FOLDER = "stimme";
export const VOICE_INDEX = `${VOICE_FOLDER}/index.json`;

export const normalize = (text: string) => text.trim().replace(/\s+/g, " ");

export interface Piece { kind: "text" | "name" | "num"; text: string; mood: VoiceMood; /** Satzende danach (längere Pause) */ end?: boolean }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Satz in Bausteine zerlegen: Namen und Zahlen stehen einzeln (immer neutral), dazwischen die festen Teile
 * in der Stimmung des Satzes. Satzzeichen bleiben am Teil davor, damit die Betonung stimmt.
 */
export function pieces(text: string, names: string[], mood: VoiceMood = "neutral"): Piece[] {
  const clean = normalize(text);
  if (!clean) return [];
  const list = [...new Set(names.map(normalize).filter((n) => n.length > 0 && n.length <= 40))].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${[...list.map((n) => `(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`), "\\d+"].join("|")})`, "u");
  const out: Piece[] = [];
  for (const part of clean.split(pattern)) {
    if (part === undefined) continue;
    if (/^\d+$/.test(part)) { out.push({ kind: "num", text: part, mood: "neutral" }); continue; }
    if (list.includes(part)) { out.push({ kind: "name", text: part, mood: "neutral" }); continue; }
    const t = normalize(part);
    if (!t) continue;
    // Reine Satzzeichen hängen am Baustein davor (z. B. „Anna“ + „.“)
    if (!/[\p{L}\p{N}]/u.test(t)) {
      const prev = out[out.length - 1];
      if (prev?.kind === "text") prev.text += t;
      else if (prev && /[.!?…]/.test(t)) prev.end = true;
      continue;
    }
    // Satzende direkt nach Name oder Zahl („… war Anna. Weiter!“): längere Pause dort
    if (/^[^\p{L}\p{N}]*[.!?…]/u.test(t) && out.length && out[out.length - 1].kind !== "text") out[out.length - 1].end = true;
    // Lange Stücke an Satzgrenzen teilen – jeder Satz ein eigener Baustein
    for (const s of t.match(/[^.!?…]+[.!?…]*/g) ?? [t]) {
      // Satzzeichen am Anfang (z. B. „, du bist dran“ nach einem Namen) spricht man nicht
      const p = normalize(s).replace(/^[^\p{L}\p{N}]+/u, "");
      if (p) out.push({ kind: "text", text: p.slice(0, MAX_PIECE), mood });
    }
  }
  return out;
}

/** Sätze eines Texts (Satzzeichen bleiben dran) */
export const sentences = (text: string) => (normalize(text).match(/[^.!?…]+[.!?…]*/g) ?? []).map(normalize).filter(Boolean);

/** Schlüssel eines Bausteins (16 Hex-Zeichen) */
export async function pieceKey(mood: VoiceMood, text: string): Promise<string> {
  const data = new TextEncoder().encode(`${VOICE_VERSION}|${mood}|${normalize(text)}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...hash.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gemeldeter fehlender Baustein prüfen: Stimmung bekannt, Text kurz und nur „normale“ Zeichen */
export function validPiece(x: unknown): { mood: VoiceMood; text: string } | null {
  if (!x || typeof x !== "object") return null;
  const { mood, text } = x as { mood?: unknown; text?: unknown };
  if (!isMood(mood) || typeof text !== "string") return null;
  const t = normalize(text);
  if (!t || t.length > MAX_PIECE) return null;
  // Buchstaben, Ziffern, übliche Satzzeichen – keine Steuerzeichen, kein Markup
  if (!/^[\p{L}\p{N} .,!?…:;'’"„“()\-–]+$/u.test(t)) return null;
  return { mood, text: t };
}
