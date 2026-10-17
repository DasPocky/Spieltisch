/** Kleine Helfer für Anfragen und Antworten: JSON, Body lesen, Ratenbremse, Hashes, Codes */
import { randomCode } from "../shared/platform/group";
import { ROOM_CODE_LENGTH } from "../shared/platform/protocol";

export async function hashPin(salt: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Raumcode aus 32 Zeichen – 256 ist durch 32 teilbar, also keine Modulo-Verzerrung. */
export const makeCode = (): string => randomCode(ROOM_CODE_LENGTH);
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
/** Vergleich in konstanter Zeit – über die Hashes, damit die Länge nichts verrät */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hashPin("cmp", a), hashPin("cmp", b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
/**
 * Anfragen je Adresse begrenzen – pro Worker-Instanz (schnell, kostenlos). Für sicherheitsrelevante Wege
 * kommt zusätzlich die globale Bremse von Cloudflare dazu (`limited`).
 */
export const hits = new Map<string, number[]>();
export function allowed(bucket: string, ip: string, max: number, ms = 10 * 60 * 1000): boolean {
  return note(hits, `${bucket}:${ip}`, max, ms, true);
}

/** Zähler in einer Liste von Zeitpunkten; volle Liste: die ältesten Einträge fliegen raus (nicht alle auf einmal) */
function note(map: Map<string, number[]>, key: string, max: number, ms: number, add: boolean): boolean {
  const now = Date.now();
  const recent = (map.get(key) ?? []).filter((t) => now - t < ms);
  if (recent.length >= max) return false;
  if (add) recent.push(now);
  map.delete(key);
  map.set(key, recent);
  if (map.size > 5000) for (const k of [...map.keys()].slice(0, 1000)) map.delete(k);
  return true;
}

/** Fehlversuche je Adresse (z. B. falscher Profil-Schlüssel) */
const fails = new Map<string, number[]>();
export function countFail(bucket: string, ip: string): void { note(fails, `${bucket}:${ip}`, Infinity, 10 * 60 * 1000, true); }
const tooManyFails = (bucket: string, ip: string, max: number) => !note(fails, `${bucket}:${ip}`, max, 10 * 60 * 1000, false);

/** Globale Bremse von Cloudflare (Binding SENSITIVE, alle Instanzen zusammen) – fehlt sie, gilt nur die lokale */
export interface RateLimit { limit(o: { key: string }): Promise<{ success: boolean }> }

/**
 * Sicherheitsrelevante Wege: lokal höchstens `maxFails` Fehlversuche in 10 Minuten, dazu global
 * die Cloudflare-Grenze für alle Versuche (großzügig – ein Haushalt teilt sich oft eine Adresse).
 */
export async function limited(global: RateLimit | undefined, bucket: string, ip: string, maxFails: number): Promise<boolean> {
  if (tooManyFails(bucket, ip, maxFails)) return false;
  if (!global) return true;
  try { return (await global.limit({ key: `${bucket}:${ip}` })).success; } catch { return true; }
}
/** JSON-Objekt aus der Anfrage – null bei Unsinn, Listen oder zu großem Inhalt */
export async function readBody(request: Request, max = 8000): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > max) return null;
  try {
    const body = text ? JSON.parse(text) : {};
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch { return null; }
}
export const badRequest = () => json({ error: "Ungültige Anfrage." }, 400);
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}
