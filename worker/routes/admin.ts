/** HTTP: /api/admin/… – Anmeldung, Einstellungen, Räume, Statistik, Verlauf, Daten, Zuschauen */
import { isGameId } from "../../shared/games";
import { PROFILE_ID_RE } from "../../shared/platform/profile";
import { GROUP_CODE_RE } from "../../shared/platform/group";
import { WIPE_KINDS, type WipeKind } from "../../shared/platform/admin";
import { BUILD, type ServerStatus } from "../../shared/build";
import { sanitizeAccess, type RoomAccess } from "../../shared/platform/directory";
import { PIN_RE, ROOM_CODE_RE } from "../../shared/platform/protocol";
import { type AdminRoomAction } from "../../shared/platform/admin";
import { isBotLevel } from "../../shared/platform/botSkill";
import { ASSET_PREFIX, assetPath, FILE_MAX_BYTES, fileType } from "../../shared/platform/files";
import { Env, settingsOf, profileOf, groupOf } from "../env";
import { readBody, readBytes, badRequest, json, withTimeout, makeCode } from "../http";
import { WATCH_PATH } from "../rooms";
import { AdminCred } from "../settings";

/** Admin-Anmeldung aus der Anfrage: `authorization: Bearer <token>` oder Passwort (Kopfzeile oder Body) */
export function adminCred(request: Request, password?: unknown): AdminCred {
  const token = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  const pw = typeof password === "string" && password ? password : request.headers.get("x-admin-password") ?? undefined;
  return { token, password: pw || undefined };
}
/** Datei (Rohdaten im Body) in R2 ablegen – aus der Verwaltung und aus der GitHub-Aktion „Dateien einspielen“ */
export async function putAsset(env: Env, path: string, request: Request): Promise<Response> {
  if (!env.FILES) return json({ ok: false, error: "Der Dateispeicher ist nicht verbunden." }, 503);
  const bytes = await readBytes(request, FILE_MAX_BYTES);
  if (!bytes) return json({ ok: false, error: "Die Datei ist zu groß (höchstens 25 MB)." }, 413);
  const type = fileType(bytes, path);
  if (!type) return json({ ok: false, error: "Der Inhalt passt nicht zur Endung." }, 400);
  await env.FILES.put(ASSET_PREFIX + path, bytes, { httpMetadata: { contentType: type } });
  return json({ ok: true, path, size: bytes.length });
}

/** Kurzbeschreibung eines Eingriffs fürs Protokoll */
function auditLabel(path: string, body: Record<string, unknown>): string {
  const room = path.match(/\/rooms\/([A-Z0-9]+)/)?.[1];
  const action = body.action && typeof body.action === "object" ? String((body.action as { type?: unknown }).type ?? "") : "";
  const what = path.replace(/^\/api\/admin\/?/, "").replace(/\/[A-Z0-9]{5}(\/|$)/, "/…$1") || "einstellungen";
  const review = /\/sets\/[a-z0-9]{12}\/review$/.test(path) ? (body.ok === true ? " (freigegeben)" : " (abgelehnt)") : "";
  return `${room ? `Raum ${room}: ` : ""}${what}${action ? ` (${action})` : ""}${review}`;
}

export async function handleAdmin(request: Request, env: Env, path: string): Promise<Response> {
  const settings = settingsOf(env);
  let body: Record<string, unknown> = {};
  if (request.method === "POST") {
    // Einstellungen mit Standards aller Spiele können größer werden als normale Anfragen
    const parsed = await readBody(request, 64_000);
    if (!parsed) return badRequest();
    body = parsed;
  }
  const cred = adminCred(request, body.password);

  // Zuschauen: WebSocket kann keine Kopfzeilen setzen – das Sitzungs-Token kommt deshalb in der Adresse
  const watch = path.match(/^\/api\/admin\/rooms\/([A-Z0-9]+)\/watch$/);
  if (watch && request.headers.get("Upgrade") === "websocket") {
    const token = new URL(request.url).searchParams.get("t");
    // Ohne Token gar nicht erst prüfen (sonst zählte es als falsches Passwort)
    const ok = token ? await settings.auth({ token }) : { ok: false, status: 401, error: "Bitte melde dich neu an." };
    if (!ok.ok || !ROOM_CODE_RE.test(watch[1])) return json({ ok: false, error: ok.error }, ok.status ?? 403);
    await settings.audit(`Raum ${watch[1]}: zugeschaut`);
    const inner = new Request(new URL(WATCH_PATH, request.url), request);
    return env.ROOMS.get(env.ROOMS.idFromName(watch[1])).fetch(inner);
  }

  // Anmelden (gibt ein Sitzungs-Token zurück) oder Freigaben/Standards speichern
  if (path === "/api/admin" && request.method === "POST") {
    const update = body.config === undefined && body.defaults === undefined ? undefined : {
      config: body.config,
      code: body.code === null ? null : typeof body.code === "string" ? body.code : undefined,
      defaults: body.defaults,
    };
    const { status, ...res } = await settings.admin(cred, update);
    if (res.ok && (update || res.token)) await settings.audit(update ? "Einstellungen gespeichert" : "Angemeldet");
    return json(res, res.ok ? 200 : status ?? 403);
  }

  if (path === "/api/admin/logout" && request.method === "POST") {
    if (cred.token) await settings.logout(cred.token);
    return json({ ok: true });
  }

  const auth = await settings.auth(cred);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status ?? 403);

  // Jeder Eingriff landet im Protokoll – nur was und wann, keine Inhalte
  if (request.method !== "GET") await settings.audit(auditLabel(path, body));
  if (path === "/api/admin/audit" && request.method === "GET") return json(await settings.auditList());
  if (path === "/api/admin/health" && request.method === "GET") return json(await settings.healthList());

  if (path === "/api/admin/stats" && request.method === "GET") return json(await settings.statsGet());

  // Kartensets der Spieler: Vorschläge prüfen, freigeben, ablehnen (mit Grund) oder wieder aus der Liste nehmen
  if (path === "/api/admin/sets" && request.method === "GET") return json({ sets: await settings.adminSets() });
  const cset = path.match(/^\/api\/admin\/sets\/([a-z0-9]{12})(?:\/(review))?$/);
  if (cset && !cset[2] && request.method === "GET") {
    const set = await settings.listedSet(cset[1], false);
    return set ? json({ set }) : json({ ok: false, error: "Dieses Set gibt es nicht (mehr)." }, 404);
  }
  if (cset && cset[2] && request.method === "POST") {
    const ok = body.ok === true;
    const note = typeof body.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    // Geprüft wird genau die Fassung, die die Verwaltung gesehen hat – inzwischen geändert: erst neu ansehen
    const seen = typeof body.at === "number" ? body.at : NaN;
    const now = await settings.listedSet(cset[1], false);
    if (!now) return json({ ok: false, error: "Dieses Set gibt es nicht (mehr)." }, 404);
    if (now.updatedAt !== seen) return json({ ok: false, error: "Das Set wurde inzwischen geändert – bitte neu ansehen." }, 409);
    const set = await settings.reviewSet(cset[1], ok, note);
    if (!set) return json({ ok: false, error: "Dieses Set gibt es nicht (mehr)." }, 404);
    await profileOf(env, set.owner).setStatus(set.id, set.status, note);
    return json({ ok: true, status: set.status });
  }

  // Dateien der App in R2 (Ordner assets/): auflisten, hochladen (PUT, Rohdaten), löschen
  if (path === "/api/admin/files" && request.method === "GET") {
    if (!env.FILES) return json({ ok: false, error: "Der Dateispeicher ist nicht verbunden." }, 503);
    const list = await env.FILES.list({ prefix: ASSET_PREFIX, limit: 500 });
    return json({ files: list.objects.map((o) => ({ path: o.key.slice(ASSET_PREFIX.length), size: o.size, uploaded: o.uploaded.getTime() })) });
  }
  const file = path.match(/^\/api\/admin\/files\/(.+)$/);
  if (file && (request.method === "PUT" || request.method === "DELETE")) {
    if (!env.FILES) return json({ ok: false, error: "Der Dateispeicher ist nicht verbunden." }, 503);
    const target = assetPath(decodeURIComponent(file[1]));
    if (!target) return json({ ok: false, error: "Ordner, Name oder Endung passt nicht." }, 400);
    if (request.method === "DELETE") { await env.FILES.delete(ASSET_PREFIX + target.path); return json({ ok: true }); }
    return putAsset(env, target.path, request);
  }
  // Updates: Stand (Modus, wartende Version, Verlauf) und „Jetzt live schalten“
  if (path === "/api/admin/release" && request.method === "GET") return json(await settings.releaseStatus());
  if (path === "/api/admin/release" && request.method === "POST") {
    const r = await settings.releaseTick(true);
    return json(r, r.ok ? 200 : 502);
  }
  if (path === "/api/admin/status" && request.method === "GET") {
    const status: ServerStatus = {
      ...(await settings.status()),
      build: BUILD,
      services: { realtime: !!(env.REALTIME_APP_ID && env.REALTIME_APP_TOKEN), realtimeFake: !!env.REALTIME_FAKE, password: !!env.ADMIN_PASSWORD },
    };
    return json(status);
  }

  // Offene Räume: jeder Raum wird selbst gefragt – was nicht mehr existiert, fliegt aus der Übersicht
  if (path === "/api/admin/rooms" && request.method === "GET") {
    const known = await settings.roomList();
    const rooms = await Promise.all(known.map(async (r) => {
      try {
        const live = await withTimeout(env.ROOMS.get(env.ROOMS.idFromName(r.code)).summary(), 3000);
        if (live) return live;
        await settings.roomGone(r.code);
        return null;
      } catch { return r; }
    }));
    return json({ rooms: rooms.filter((r) => r !== null).sort((a, b) => b.activeAt - a.activeAt), now: Date.now() });
  }

  if (path === "/api/admin/archive" && request.method === "GET") return json({ rooms: await settings.archiveList(), now: Date.now() });
  if (path === "/api/admin/archive/delete" && request.method === "POST") {
    const code = String(body.code ?? "");
    const createdAt = Number(body.createdAt);
    if (!ROOM_CODE_RE.test(code) || !Number.isFinite(createdAt)) return json({ error: "Ungültige Anfrage." }, 400);
    await settings.archiveDelete(code, createdAt);
    return json({ ok: true });
  }
  if (path === "/api/admin/directory" && request.method === "GET") return json(await settings.directory());

  const del = path.match(/^\/api\/admin\/(groups|profiles)\/([A-Za-z0-9_-]+)\/delete$/);
  if (del && request.method === "POST") {
    const [, kind, id] = del;
    if (kind === "groups") {
      if (!GROUP_CODE_RE.test(id)) return json({ error: "Ungültiger Gruppencode." }, 400);
      await groupOf(env, id).wipe();
      await settings.directoryRemove("grp", id);
    } else {
      if (!PROFILE_ID_RE.test(id)) return json({ error: "Ungültiges Profil." }, 400);
      await profileOf(env, id).wipe(id);
      await settings.directoryRemove("prf", id);
    }
    return json({ ok: true });
  }

  // Daten löschen – zur Sicherheit muss „LÖSCHEN“ mitkommen
  if (path === "/api/admin/wipe" && request.method === "POST") {
    if (body.confirm !== "LÖSCHEN") return json({ error: "Bitte zur Bestätigung LÖSCHEN eintippen." }, 400);
    const kinds = Array.isArray(body.what) ? body.what.filter((k): k is WipeKind => WIPE_KINDS.includes(k as WipeKind)) : [];
    if (!kinds.length) return json({ error: "Nichts ausgewählt." }, 400);
    // Offene Räume vorher merken – sie werden geschlossen (alle fliegen raus)
    const open = kinds.includes("rooms") ? (await settings.roomList()).map((r) => r.code) : [];
    const { groups, profiles } = await settings.wipe(kinds);
    await Promise.all([
      ...open.map((c) => env.ROOMS.get(env.ROOMS.idFromName(c)).adminClose().catch(() => false)),
      ...groups.map((c) => groupOf(env, c).wipe().catch(() => undefined)),
      ...profiles.map((id) => profileOf(env, id).wipe(id).catch(() => undefined)),
    ]);
    // Schließen meldet Räume im Verlauf als beendet – wurde der Verlauf mit gelöscht, dort auch weg
    if (kinds.includes("archive") && open.length) await settings.wipe(["archive"]);
    return json({ ok: true, rooms: open.length, groups: groups.length, profiles: profiles.length, config: kinds.includes("settings") ? await settings.config() : undefined });
  }

  // Alles zum Herunterladen
  if (path === "/api/admin/export" && request.method === "GET") {
    return json({ exportedAt: new Date().toISOString(), config: await settings.config(), stats: await settings.statsGet(), archive: await settings.archiveList(), ...(await settings.directory()) });
  }

  // Dauerraum anlegen: bleibt bestehen, auch wenn er leer ist; der erste, der hineinkommt, ist Host
  if (path === "/api/admin/rooms/create" && request.method === "POST") {
    const pin = String(body.pin ?? "");
    if (!PIN_RE.test(pin)) return json({ error: "Die PIN muss 4 bis 8 Ziffern haben." }, 400);
    const gameId = isGameId(body.game) ? body.game : "alles";
    const config = await settings.config();
    const access = sanitizeAccess({ ...(body.room && typeof body.room === "object" ? body.room : {}), life: "forever" }, undefined, true);
    if (!access.name) return json({ error: "Bitte gib dem Raum einen Namen." }, 400);
    for (let i = 0; i < 6; i++) {
      const code = makeCode();
      if (await env.ROOMS.get(env.ROOMS.idFromName(code)).init(pin, gameId, true, code, config.defaults, access, true)) return json({ code }, 201);
    }
    return json({ error: "Gerade ist kein Raumcode frei." }, 503);
  }

  // Entwickler-Modus: Testraum mit Bots – unsichtbar, zählt nicht; der Admin tritt als Erster bei und ist Host
  if (path === "/api/admin/test-room" && request.method === "POST") {
    const gameId = isGameId(body.game) ? body.game : "alles";
    const n = Math.max(1, Math.min(10, Math.floor(Number(body.bots) || 3)));
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    const config = await settings.config();
    const access: RoomAccess = { name: "Testraum", visibility: "none", admission: "pin", life: "hour" };
    for (let i = 0; i < 6; i++) {
      const code = makeCode();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      if (!(await stub.init(pin, gameId, true, code, config.defaults, access, false, true))) continue;
      const res = await stub.adminAct({ type: "addBots", n, level: isBotLevel(body.level) ? body.level : undefined });
      if (!res.ok) return json(res, 400);
      return json({ code, pin }, 201);
    }
    return json({ error: "Gerade ist kein Raumcode frei." }, 503);
  }

  // Einzelheiten und Eingriffe in einen Raum
  const r = path.match(/^\/api\/admin\/rooms\/([A-Z0-9]+)(?:\/(act))?$/);
  if (r && ROOM_CODE_RE.test(r[1])) {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(r[1]));
    if (!r[2] && request.method === "GET") {
      const detail = await stub.adminDetail();
      if (!detail) await settings.roomGone(r[1]);
      return detail ? json({ room: detail }) : json({ ok: false, error: "Den Raum gibt es nicht mehr." }, 404);
    }
    if (r[2] && request.method === "POST") {
      const res = await stub.adminAct(body.action as AdminRoomAction);
      return json(res, res.ok ? 200 : 400);
    }
  }

  const m = path.match(/^\/api\/admin\/rooms\/([A-Z0-9]+)\/(close|unlock)$/);
  if (m && request.method === "POST") {
    if (!ROOM_CODE_RE.test(m[1])) return json({ error: "Ungültiger Raumcode." }, 400);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
    const ok = m[2] === "close" ? await stub.adminClose() : await stub.adminUnlock();
    if (!ok) await settings.roomGone(m[1]);
    return json({ ok }, ok ? 200 : 404);
  }

  return json({ error: "Nicht gefunden." }, 404);
}
