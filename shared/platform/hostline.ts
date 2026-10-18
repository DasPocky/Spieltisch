/**
 * KI-Sprüche des Moderators (Cloudflare Workers AI): Anfrage prüfen, Auftrag bauen, Antwort säubern.
 * Alles, was nicht passt, wird verworfen – dann spricht der Moderator seine festen Texte.
 */
export type HostMoment = "hallo" | "zar" | "punkt" | "sieg";
export type HostMood = "charmant" | "frech" | "boese";
export interface HostLineRequest { moment: HostMoment; mood: HostMood; name: string; game: string }

const MOMENTS: readonly HostMoment[] = ["hallo", "zar", "punkt", "sieg"];
const MOODS: readonly HostMood[] = ["charmant", "frech", "boese"];
/** Höchstens so viele KI-Sprüche am Tag (alle Räume zusammen) – Rückfall danach: feste Texte */
export const AI_DAILY = 400;
export const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} .,!?'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Anfrage vom Tisch prüfen – null bei Unsinn */
export function parseHostLine(raw: Record<string, unknown> | null): HostLineRequest | null {
  if (!raw) return null;
  const moment = MOMENTS.find((m) => m === raw.moment);
  const mood = MOODS.find((m) => m === raw.mood);
  if (!moment || !mood) return null;
  const name = clean(raw.name, 40);
  if (moment !== "hallo" && !name) return null;
  return { moment, mood, name, game: clean(raw.game, 30) };
}

const SITUATION: Record<HostMoment, string> = {
  hallo: "Die Partie beginnt gerade. Begrüße die Runde.",
  zar: "Eine neue Runde beginnt, {name} ist diesmal Kartenzar und wählt die lustigste Antwort.",
  punkt: "{name} hat gerade den Rundenpunkt gewonnen.",
  sieg: "{name} hat die ganze Partie gewonnen.",
};
const TONE: Record<HostMood, string> = {
  charmant: "Du bist herzlich, warm und charmant.",
  frech: "Du bist frech und neckisch, aber gutmütig.",
  boese: "Du bist spitz und sarkastisch, aber nie verletzend und nie beleidigend.",
};

/** Auftrag an das Sprachmodell */
export function hostPrompt(r: HostLineRequest): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: `Du bist der Moderator eines Spieleabends am Fernseher. ${TONE[r.mood]} Antworte mit genau einem kurzen Satz auf Deutsch, höchstens 16 Wörter. Keine Anführungszeichen, keine Emojis, keine Hashtags. Keine Bemerkungen über Aussehen, Herkunft, Geschlecht, Religion oder Gesundheit. Keine Schimpfwörter.` },
    { role: "user", content: `${r.game ? `Spiel: ${r.game}. ` : ""}${SITUATION[r.moment].replaceAll("{name}", r.name)}${r.name ? ` Nenne den Namen ${r.name} im Satz.` : ""}` },
  ];
}

/** Grobe Liste, was nie gesagt werden soll (Rückfall auf feste Texte) */
const BAD = /(idiot|depp|dumm|blöd|arsch|schei|fick|hure|nazi|behindert|fett|hässlich|http|www\.|@)/i;

/** Antwort säubern; null, wenn sie nicht passt (zu lang, ohne Namen, unerwünschte Wörter) */
export function cleanHostLine(text: unknown, r: HostLineRequest): string | null {
  if (typeof text !== "string") return null;
  let t = text.replace(/[\r\n]+/g, " ").replace(/["„“”«»*#]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
  // Nur den ersten Satz behalten
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  if (m) t = m[0];
  if (t.length < 8 || t.length > 160) return null;
  if (BAD.test(t)) return null;
  if (r.name && !t.toLowerCase().includes(r.name.toLowerCase())) return null;
  return t;
}
