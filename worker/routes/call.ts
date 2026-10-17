/** HTTP: /api/rooms/:code/call – Sprach- und Videochat über Cloudflare Realtime, nur für Mitspieler des Raums */
import { CALL_SESSION_RE, ROOM_CODE_RE } from "../../shared/platform/protocol";
import { Env } from "../env";
import { json } from "../http";

/** Lokale Statistik: höchstens 20 Meldungen je Adresse in 10 Minuten (pro Worker-Instanz, grob reicht) */
export const REALTIME_API = "https://rtc.live.cloudflare.com/v1/apps";
export const MAX_CALL_BODY = 64_000;
export type CallOp = "new" | "tracks" | "renegotiate" | "close";
/**
 * Leitet eine Chat-Anfrage an das Cloudflare-SFU weiter. Das App-Token bleibt auf dem Server;
 * der Raum prüft Token des Spielers, Besitz der Sitzung und dass abgeholte Spuren aus diesem Raum stammen.
 */
export async function handleCall(request: Request, env: Env, code: string): Promise<Response> {
  if (!env.REALTIME_APP_ID || !env.REALTIME_APP_TOKEN) return json({ error: "Der Sprachchat ist nicht eingerichtet." }, 503);
  if (!ROOM_CODE_RE.test(code)) return json({ error: "Ungültiger Raumcode." }, 400);
  const text = await request.text();
  if (text.length > MAX_CALL_BODY) return json({ error: "Zu groß." }, 413);
  let body: { playerId?: unknown; token?: unknown; op?: unknown; session?: unknown; payload?: unknown };
  try { body = JSON.parse(text); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const op = body.op as CallOp;
  if (!["new", "tracks", "renegotiate", "close"].includes(op)) return json({ error: "Unbekannt." }, 400);
  const session = op === "new" ? null : typeof body.session === "string" && CALL_SESSION_RE.test(body.session) ? body.session : undefined;
  if (session === undefined) return json({ error: "Ungültige Sitzung." }, 400);

  const room = env.ROOMS.get(env.ROOMS.idFromName(code));
  if (!(await room.callAuth(String(body.playerId ?? ""), String(body.token ?? ""), session))) return json({ error: "Nicht erlaubt." }, 403);

  const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as { tracks?: { location?: string; sessionId?: string }[] };
  if (op === "tracks") {
    const remote = (payload.tracks ?? []).filter((t) => t.location === "remote").map((t) => String(t.sessionId ?? ""));
    if (remote.length && !(await room.callSessionsKnown(remote))) return json({ error: "Nicht erlaubt." }, 403);
  }

  if (env.REALTIME_FAKE === "1") {
    const data = fakeSfu(op, payload);
    if (op === "new") await room.callRegister(String(body.playerId), data.sessionId as string);
    return json(data);
  }

  const base = `${REALTIME_API}/${env.REALTIME_APP_ID}/sessions`;
  const target = op === "new" ? `${base}/new` : op === "tracks" ? `${base}/${session}/tracks/new` : op === "renegotiate" ? `${base}/${session}/renegotiate` : `${base}/${session}/tracks/close`;
  const res = await fetch(target, {
    method: op === "new" || op === "tracks" ? "POST" : "PUT",
    headers: { authorization: `Bearer ${env.REALTIME_APP_TOKEN}`, "content-type": "application/json" },
    body: op === "new" ? undefined : JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { sessionId?: string };
  if (op === "new" && res.ok && data.sessionId) await room.callRegister(String(body.playerId), data.sessionId);
  return json(data, res.status);
}
/** Test-SFU: antwortet wie Cloudflare Realtime, ohne Medien zu übertragen (nur mit REALTIME_FAKE=1) */
export function fakeSfu(op: CallOp, payload: { tracks?: { location?: string; sessionId?: string; trackName?: string; mid?: string }[] }): Record<string, unknown> {
  const tracks = payload.tracks ?? [];
  if (op === "new") return { sessionId: crypto.randomUUID().replace(/-/g, "") };
  if (op === "tracks" && tracks.some((t) => t.location === "remote")) {
    return {
      requiresImmediateRenegotiation: true,
      ...(() => {
        const out = tracks.map((t) => ({ sessionId: t.sessionId, trackName: t.trackName, mid: crypto.randomUUID().slice(0, 6) }));
        // Die Test-Gegenstelle liest die Kennungen aus dem SDP und meldet dafür Spuren
        return { tracks: out, sessionDescription: { type: "offer", sdp: `v=0 fake mids=${out.map((t) => t.mid).join(",")}` } };
      })(),
    };
  }
  if (op === "tracks") return { sessionDescription: { type: "answer", sdp: "v=0 fake" }, tracks: tracks.map((t) => ({ trackName: t.trackName, mid: t.mid })) };
  return {};
}
