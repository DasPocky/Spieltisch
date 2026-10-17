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
/** Anfragen je Adresse begrenzen (pro Worker-Instanz, grob reicht) */
export const hits = new Map<string, number[]>();
export function allowed(bucket: string, ip: string, max: number, ms = 10 * 60 * 1000): boolean {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < ms);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
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
