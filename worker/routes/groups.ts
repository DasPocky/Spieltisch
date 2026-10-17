/** HTTP: /api/groups/… */
import { PROFILE_ID_RE } from "../../shared/platform/profile";
import { GROUP_CODE_LENGTH, GROUP_CODE_RE, MEMBER_ID_RE, randomCode } from "../../shared/platform/group";
import { cleanName } from "../../shared/platform/room";
import { Env, settingsOf, profileOf, groupOf } from "../env";
import { allowed, readBody, json } from "../http";
import { ownsProfile } from "../auth";
import { GroupAnswer } from "../groups";

const notYours = () => json({ error: "Dein Profil passt nicht zu diesem Gerät. Übertrage es neu („Code zum Übertragen anzeigen“)." }, 403);

export const answer = (r: GroupAnswer | { ok: true; gone: true }) =>
  r.ok ? json("gone" in r ? { ok: true, gone: true } : { ok: true, group: r.group }) : json({ error: r.error }, r.status);
/**
 * Gruppen: anlegen, ansehen (Mitglieder alles, sonst Vorschau), beitreten, umbenennen, Mitglied entfernen, Ergebnis melden.
 * Wer fragt, nennt seine Profil-ID (Kopfzeile x-profile bzw. Feld `profile`) und weist sich mit dem Geräteschlüssel
 * des Profils aus (Kopfzeile x-profile-key) – ohne passenden Schlüssel gibt es nur die Vorschau bzw. nichts zu ändern.
 */
export async function handleGroups(request: Request, env: Env, path: string): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (request.method === "POST" && !(await settingsOf(env).config()).features.groups) return json({ error: "Gruppen sind gerade abgeschaltet." }, 403);
  if (path === "/api/groups" && request.method === "POST") {
    const body = await readBody(request);
    const profile = String(body?.profile ?? "");
    if (!body || !PROFILE_ID_RE.test(profile)) return json({ error: "Ungültige Anfrage." }, 400);
    if (!(await ownsProfile(env, profile, request))) return notYours();
    if (!allowed("group-new", ip, 10)) return json({ error: "Zu viele neue Gruppen. Bitte später nochmal." }, 429);
    if (!cleanName(body.member)) return json({ error: "Bitte gib deinen Namen ein." }, 400);
    for (let i = 0; i < 6; i++) {
      const code = randomCode(GROUP_CODE_LENGTH);
      const group = await groupOf(env, code).init(code, String(body.name ?? ""), profile, String(body.member), body.avatar);
      if (group) {
        await profileOf(env, profile).setGroup(code, true);
        return json({ ok: true, group }, 201);
      }
    }
    return json({ error: "Gerade ist kein Gruppencode frei." }, 503);
  }

  const m = path.match(/^\/api\/groups\/([A-Z0-9]+)(?:\/(join|remove|result))?$/);
  if (!m) return json({ error: "Nicht gefunden." }, 404);
  const [, code, op] = m;
  if (!GROUP_CODE_RE.test(code)) return json({ error: "Ungültiger Gruppencode." }, 400);
  const store = groupOf(env, code);

  if (!op && request.method === "GET") {
    const profile = request.headers.get("x-profile") ?? "";
    // Nur mit Schlüssel als Mitglied – sonst Vorschau wie für Fremde
    const pid = PROFILE_ID_RE.test(profile) && (await ownsProfile(env, profile, request)) ? profile : null;
    const res = await store.get(pid);
    // Raten von Gruppencodes bremsen: Vorschauen und Fehlgriffe sind begrenzt
    if (!res?.group && !allowed("group-look", ip, 60)) return json({ error: "Zu viele Versuche. Bitte später nochmal." }, 429);
    if (!res) return json({ error: "Diese Gruppe gibt es nicht." }, 404);
    return json(res);
  }

  const body = await readBody(request);
  const profile = String(body?.profile ?? "");
  if (!body || !PROFILE_ID_RE.test(profile)) return json({ error: "Ungültige Anfrage." }, 400);
  if (!(await ownsProfile(env, profile, request))) return notYours();

  if (op === "join" && request.method === "POST") {
    if (!allowed("group-join", ip, 30)) return json({ error: "Zu viele Versuche. Bitte später nochmal." }, 429);
    const res = await store.join(profile, body.name, body.avatar);
    if (res.ok) await profileOf(env, profile).setGroup(code, true);
    return answer(res);
  }
  if (!op && request.method === "PUT") return answer(await store.rename(profile, body.name));
  if (op === "remove" && request.method === "POST") {
    const member = String(body.member ?? "");
    if (!MEMBER_ID_RE.test(member)) return json({ error: "Ungültiges Mitglied." }, 400);
    const me = await store.memberOf(profile);
    const res = await store.remove(profile, member);
    if (res.ok && me === member) await profileOf(env, profile).setGroup(code, false);
    return answer(res);
  }
  if (op === "result" && request.method === "POST") {
    if (!allowed("group-result", ip, 40)) return json({ error: "Zu viele Ergebnisse. Bitte später nochmal." }, 429);
    return answer(await store.result(profile, body));
  }
  return json({ error: "Nicht gefunden." }, 404);
}
