import { isGameId } from "../shared/games";
import { PROFILE_ID_RE, sanitizeResult, TRANSFER_CODE_RE } from "../shared/platform/profile";
import { GROUP_CODE_RE, randomCode } from "../shared/platform/group";
import { accessFor } from "../shared/platform/access";
import { sanitizeAccess, type RoomCard } from "../shared/platform/directory";
import { PIN_RE, ROOM_CODE_RE } from "../shared/platform/protocol";
import { Env, settingsOf, profileOf, transferOf } from "./env";
import { allowed, countFail, limited, readBody, badRequest, json, withTimeout, makeCode, sameSecret } from "./http";
import { GAME_IDS } from "./settings";
import { handleGroups } from "./routes/groups";
import { handleAdmin } from "./routes/admin";
import { handleCall } from "./routes/call";
import { ownsProfile } from "./auth";
import { ASSET_PREFIX, assetPath } from "../shared/platform/files";

/** Anfragen dieser Worker-Instanz, gesammelt gemeldet (nicht jede Anfrage einzeln – das wären doppelt so viele) */
let pendingRequests = 0;
let lastFlush = Date.now();
function countRequest(env: Env, ctx: ExecutionContext): void {
  pendingRequests++;
  if (pendingRequests < 25 && Date.now() - lastFlush < 60_000) return;
  const n = pendingRequests;
  pendingRequests = 0;
  lastFlush = Date.now();
  ctx.waitUntil(settingsOf(env).addRequests(n).catch(() => undefined));
}
const notOwner = () => json({ error: "Dieses Profil gehört zu einem anderen Gerät. Übertrage es dort mit „Code zum Übertragen anzeigen“." }, 403);

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    countRequest(env, ctx);

    // Freigaben für alle (ohne Geheimnisse)
    if (url.pathname === "/api/config" && request.method === "GET") return json(await settingsOf(env).config());

    // Welche Version läuft, wartet ein Update? (Geräte laden danach neu bzw. zeigen einen Hinweis)
    if (url.pathname === "/api/version" && request.method === "GET") return json(await settingsOf(env).version());

    // Der Build meldet eine hochgeladene Version: sofort live oder warten (scripts/release.mjs)
    if (url.pathname === "/api/release" && request.method === "POST") {
      const key = request.headers.get("x-release-key") ?? "";
      if (!env.RELEASE_SECRET || !(await sameSecret(key, env.RELEASE_SECRET))) return json({ deploy: "now", note: "Ohne RELEASE_SECRET geht jede Version sofort live." }, 403);
      const body = (await readBody(request)) as { versionId?: unknown; sha?: unknown; time?: unknown } | null;
      const v = { versionId: String(body?.versionId ?? ""), sha: String(body?.sha ?? ""), time: String(body?.time ?? "") };
      if (!/^[0-9a-f-]{36}$/.test(v.versionId) || !/^[0-9a-f]{7,40}$/.test(v.sha)) return badRequest();
      return json({ deploy: await settingsOf(env).releaseOffer(v) });
    }

    // Zugangscode prüfen
    if (url.pathname === "/api/access" && request.method === "POST") {
      const body = (await readBody(request)) as { code?: unknown } | null;
      if (!body) return badRequest();
      const ok = typeof body.code === "string" && await settingsOf(env).checkCode(body.code);
      return json({ ok }, ok ? 200 : 403);
    }

    // Profil: Statistik lesen, Namen setzen, lokale Partie eintragen, löschen
    // Aufs neue Handy übertragen: Einmal-Code anlegen (mit Profil-ID) bzw. einlösen
    const transfer = url.pathname.match(/^\/api\/profile\/([A-Z0-9]+)\/transfer$/);
    if (transfer && request.method === "POST") {
      if (!PROFILE_ID_RE.test(transfer[1])) return json({ error: "Ungültiges Profil." }, 400);
      if (!(await ownsProfile(env, transfer[1], request))) return notOwner();
      const code = randomCode(8);
      const until = await transferOf(env, code).offer(transfer[1]);
      return json({ code, until });
    }
    const take = url.pathname.match(/^\/api\/transfer\/([A-Z0-9]+)$/);
    if (take && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") ?? "local";
      if (!allowed("transfer", ip, 20) || !(await limited(env.SENSITIVE, "transfer", ip, 10))) return json({ error: "Zu viele Versuche. Bitte später nochmal." }, 429);
      if (!TRANSFER_CODE_RE.test(take[1])) return json({ error: "Ungültiger Code." }, 400);
      const id = await transferOf(env, take[1]).take();
      if (!id) countFail("transfer", ip);
      // Das neue Gerät bekommt einen eigenen Schlüssel für das Profil
      return id ? json({ id, key: await profileOf(env, id).addKey() }) : json({ error: "Der Code ist abgelaufen oder schon benutzt." }, 404);
    }

    if (url.pathname === "/api/groups" || url.pathname.startsWith("/api/groups/")) return handleGroups(request, env, url.pathname);

    const prof = url.pathname.match(/^\/api\/profile\/([A-Z0-9]+)(\/result)?$/);
    if (prof) {
      const id = prof[1];
      if (!PROFILE_ID_RE.test(id)) return json({ error: "Ungültiges Profil." }, 400);
      // Nur das Gerät mit dem Schlüssel des Profils (die ID allein reicht nicht)
      if (!(await ownsProfile(env, id, request))) return notOwner();
      const store = profileOf(env, id);
      if (prof[2] && request.method === "POST") {
        const body = (await readBody(request)) as Record<string, unknown> | null;
        if (!body) return badRequest();
        const entry = sanitizeResult(body, GAME_IDS, Date.now());
        if (!entry) return json({ error: "Ungültiges Ergebnis." }, 400);
        return json(await store.record(entry, id));
      }
      if (!prof[2] && request.method === "GET") return json(await store.get());
      if (!prof[2] && request.method === "PUT") {
        const body = (await readBody(request)) as { name?: unknown; avatar?: unknown } | null;
        if (!body) return badRequest();
        return json(await store.update(body.name === undefined ? undefined : String(body.name ?? ""), body.avatar));
      }
      if (!prof[2] && request.method === "DELETE") { await store.remove(); return json({ ok: true }); }
    }

    // Lokale Partie gestartet (Statistik) – ohne Antwortinhalt, je Adresse gedrosselt
    if (url.pathname === "/api/stats" && request.method === "POST") {
      const body = (await readBody(request)) as { game?: unknown } | null;
      if (!body) return badRequest();
      if (!isGameId(body.game)) return json({ error: "Unbekanntes Spiel." }, 400);
      if (!allowed("stats", request.headers.get("cf-connecting-ip") ?? "local", 20)) return json({ ok: false }, 429);
      await settingsOf(env).count(body.game, "local");
      return json({ ok: true });
    }

    // Admin: anmelden, Einstellungen speichern, abmelden, Räume, Statistik
    if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) return handleAdmin(request, env, url.pathname);

    // Raum anlegen
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const body = (await readBody(request)) as { pin?: unknown; game?: unknown; access?: unknown; room?: unknown; meet?: unknown } | null;
      if (!body) return badRequest();
      const pin = String(body.pin ?? "");
      if (!PIN_RE.test(pin)) return json({ error: "Die PIN muss 4 bis 8 Ziffern haben." }, 400);
      if (!isGameId(body.game)) return json({ error: "Unbekanntes Spiel." }, 400);
      const gameId = body.game;

      // Admin-Freigabe: abgeschaltet oder nur mit Zugangscode
      const settings = settingsOf(env);
      const config = await settings.config();
      const access = accessFor(config, gameId);
      if (access === "off") return json({ error: "Dieses Spiel ist gerade abgeschaltet." }, 403);
      if (!config.features.online) return json({ error: "Online-Räume sind gerade abgeschaltet – „Ein Handy für alle“ geht weiter." }, 403);
      if (config.limits.maxRooms > 0 && (await settings.roomList()).length >= config.limits.maxRooms) return json({ error: "Gerade sind alle Tische belegt. Versuch es später nochmal." }, 503);
      const unlocked = typeof body.access === "string" && await settings.checkCode(body.access);
      if (access === "code" && !unlocked) return json({ error: "Dafür braucht ihr den Zugangscode.", code: "access" }, 403);

      for (let i = 0; i < 6; i++) {
        const code = makeCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await stub.init(pin, gameId, unlocked, code, config.defaults, sanitizeAccess(body.room), body.meet === true)) return json({ code }, 201);
      }
      return json({ error: "Gerade ist kein Raumcode frei. Versuch es gleich nochmal." }, 503);
    }

    // Raumverzeichnis: offene Räume (für alle bzw. die eigenen Gruppen sichtbar)
    if (url.pathname === "/api/rooms/open" && request.method === "GET") {
      const groups = (url.searchParams.get("groups") ?? "").split(",").filter((c) => GROUP_CODE_RE.test(c)).slice(0, 20);
      if (!(await settingsOf(env).config()).features.online) return json({ rooms: [] });
      return json({ rooms: await settingsOf(env).openRooms(groups) });
    }

    // Deine Räume: das Handy nennt seine gespeicherten Zugänge, jeder Raum prüft sie selbst
    if (url.pathname === "/api/rooms/mine" && request.method === "POST") {
      const body = (await readBody(request)) as { rooms?: unknown } | null;
      if (!body) return badRequest();
      const list = (Array.isArray(body.rooms) ? body.rooms : []).slice(0, 20) as { code?: unknown; playerId?: unknown; token?: unknown }[];
      const rooms: RoomCard[] = [];
      const gone: string[] = [];
      await Promise.all(list.map(async (r) => {
        const code = String(r.code ?? "");
        if (!ROOM_CODE_RE.test(code)) return;
        try {
          const card = await withTimeout(env.ROOMS.get(env.ROOMS.idFromName(code)).card(String(r.playerId ?? ""), String(r.token ?? "")), 3000);
          if (card) rooms.push(card); else gone.push(code);
        } catch { /* Raum gerade nicht erreichbar – beim nächsten Mal */ }
      }));
      return json({ rooms: rooms.sort((a, b) => b.online - a.online || b.activeAt - a.activeAt), gone });
    }

    // Sprach-/Videochat eingerichtet?
    if (url.pathname === "/api/call" && request.method === "GET") {
      const on = (await settingsOf(env).config()).features.call;
      return json({ enabled: on && !!(env.REALTIME_APP_ID && env.REALTIME_APP_TOKEN) });
    }

    // Sprach-/Videochat: Anfragen an Cloudflare Realtime weiterreichen – nur für Mitspieler des Raums
    const callMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/call$/);
    if (callMatch && request.method === "POST") return handleCall(request, env, callMatch[1]);

    // Fotos aus R2: nur mit dem genauen (nicht erratbaren) Namen, den Leute im Raum kennen
    const photo = url.pathname.match(/^\/api\/photo\/(r\/[0-9a-f]{64}\/[A-Za-z0-9]{20})$/);
    if (photo && request.method === "GET") {
      const obj = env.FILES ? await env.FILES.get(photo[1]) : null;
      if (!obj) return new Response("Nicht gefunden.", { status: 404 });
      return new Response(obj.body, { headers: {
        "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      } });
    }

    // Dateien der App aus R2 (3D-Figuren, Bilder) – öffentlich, kurz zwischengespeichert, Änderungen über das ETag
    const asset = url.pathname.match(/^\/api\/asset\/(.+)$/);
    if (asset && request.method === "GET") {
      const target = assetPath(decodeURIComponent(asset[1]));
      const obj = target && env.FILES ? await env.FILES.get(ASSET_PREFIX + target.path, { onlyIf: request.headers }) : null;
      if (!obj) return new Response("Nicht gefunden.", { status: 404 });
      const headers = new Headers({ etag: obj.httpEtag, "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff", "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream" });
      // Bedingung erfüllt (ETag gleich): ohne Inhalt
      const body = "body" in obj ? (obj as R2ObjectBody).body : null;
      if (!body) return new Response(null, { status: 304, headers });
      return new Response(body, { headers });
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(\/ws)?$/);
    if (match) {
      const code = match[1];
      if (!ROOM_CODE_RE.test(code)) return json({ error: "Ungültiger Raumcode." }, 400);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));

      if (match[2]) return stub.fetch(request); // WebSocket
      if (request.method === "GET") return json(await stub.info());
    }

    return json({ error: "Nicht gefunden." }, 404);
  },

  // Alle 5 Minuten: wartendes Update freischalten, wenn es dran ist
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(settingsOf(env).releaseTick().then(() => undefined, () => undefined));
  },
} satisfies ExportedHandler<Env>;

// Die Durable Objects müssen aus dem Hauptmodul exportiert werden (wrangler.jsonc bindet sie über den Klassennamen)
export { GameRoom } from "./rooms";
export { SiteSettings } from "./settings";
export { ProfileStore } from "./profiles";
export { GroupStore } from "./groups";
