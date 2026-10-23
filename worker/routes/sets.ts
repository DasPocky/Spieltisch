/**
 * HTTP: /api/sets/… – eigene Kartensets. Wer fragt, nennt seine Profil-ID (Kopfzeile x-profile) und weist sich mit
 * dem Geräteschlüssel aus (x-profile-key). Freigegebene Sets darf jeder lesen.
 *
 *   GET    /api/sets?kind=…            eigene Sets (Kurzinfo)
 *   GET    /api/sets/public?kind=…     freigegebene Sets
 *   GET    /api/sets/<id>              ein Set (eigenes oder freigegebenes)
 *   PUT    /api/sets/<id>              anlegen/ändern {kind, name, data}
 *   DELETE /api/sets/<id>              löschen (auch aus der Liste für alle, samt Bildern)
 *   POST   /api/sets/<id>/submit       für alle vorschlagen · /withdraw zurückziehen
 *   POST   /api/sets/image             Bild hochladen (Rohdaten) → {value: "bild:<schlüssel>"}
 */
import { PROFILE_ID_RE } from "../../shared/platform/profile";
import { photoType } from "../../shared/platform/photo";
import {
  type GameContent,
  cleanSetData, cleanSetName, IMG_PREFIX, SET_ID_RE, SET_IMAGE_MAX_BYTES, SET_KINDS, setImages, SetError, type CardSet, type CardSetData, type SetKind,
} from "../../shared/platform/cardsets";
import { Env, profileOf, settingsOf } from "../env";
import { allowed, json, readBody, readBytes } from "../http";
import { ownsProfile } from "../auth";

const notYours = () => json({ error: "Dein Profil passt nicht zu diesem Gerät. Übertrage es neu („Code zum Übertragen anzeigen“)." }, 403);
const isKind = (k: unknown): k is SetKind => SET_KINDS.some((x) => x.id === k);

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rand = (n: number) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map((x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join(""); };
/** Ordner der Bilder eines Profils: Kurz-Hash der ID (die ID selbst steht nicht in der Adresse) */
const imageFolder = async (profile: string) => `k/${hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kartenbild:${profile}`))).slice(0, 16)}`;

/** Bilder eines Sets löschen, die `keep` nicht mehr braucht – nur aus dem eigenen Ordner (fremde Schlüssel bleiben unberührt) */
export async function deleteImages(env: Env, profile: string, data: CardSetData, keep: CardSetData = {}) {
  if (!env.FILES) return;
  const folder = `${await imageFolder(profile)}/`;
  const still = new Set(setImages(keep));
  const gone = setImages(data).filter((k) => !still.has(k) && k.startsWith(folder));
  if (gone.length) await env.FILES.delete(gone);
}

export async function handleSets(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const settings = settingsOf(env);
  if (!(await settings.config()).features.profiles) return json({ error: "Profile sind gerade abgeschaltet." }, 403);

  // Freigegebene Sets – ohne Profil
  if (path === "/api/sets/public" && request.method === "GET") {
    const kind = url.searchParams.get("kind");
    if (!isKind(kind)) return json({ error: "Unbekannte Art." }, 400);
    // Ohne Besitzer und Namen: die Profil-ID bleibt geheim, ein Name erscheint nur nach ausdrücklicher Zustimmung (noch offen)
    return json({ sets: (await settings.publicSets(kind)).map(({ by: _by, ...info }) => ({ ...info, owner: "" })) });
  }

  const profile = request.headers.get("x-profile") ?? "";
  const mine = PROFILE_ID_RE.test(profile) && (await ownsProfile(env, profile, request));
  const store = mine ? profileOf(env, profile) : null;

  if (path === "/api/sets" && request.method === "GET") {
    if (!store) return notYours();
    const kind = url.searchParams.get("kind");
    const all = await store.sets();
    return json({ sets: isKind(kind) ? all.filter((s) => s.kind === kind) : all });
  }

  if (path === "/api/sets/image" && request.method === "POST") {
    if (!store) return notYours();
    if (!env.FILES) return json({ error: "Bilder gehen hier gerade nicht." }, 503);
    if (!allowed("set-image", ip, 120)) return json({ error: "Zu viele Bilder auf einmal. Bitte gleich nochmal." }, 429);
    const bytes = await readBytes(request, SET_IMAGE_MAX_BYTES);
    if (!bytes) return json({ error: "Das Bild ist zu groß." }, 413);
    const type = photoType(bytes);
    if (!type) return json({ error: "Nur JPEG-, PNG- oder WebP-Bilder." }, 400);
    const key = `${await imageFolder(profile)}/${rand(20)}`;
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: type } });
    return json({ value: `${IMG_PREFIX}${key}` }, 201);
  }

  const m = path.match(/^\/api\/sets\/([a-z0-9]+)(?:\/(submit|withdraw))?$/);
  if (!m || !SET_ID_RE.test(m[1])) return json({ error: "Nicht gefunden." }, 404);
  const id = m[1];

  if (!m[2] && request.method === "GET") {
    const own = store ? await store.set(id) : null;
    const set = own ?? (await settings.listedSet(id, true));
    return set ? json({ set: own ? set : { ...set, owner: "" } }) : json({ error: "Dieses Set gibt es nicht (mehr)." }, 404);
  }

  if (!store) return notYours();

  if (!m[2] && request.method === "PUT") {
    if (!allowed("set-save", ip, 200)) return json({ error: "Zu viele Änderungen. Bitte gleich nochmal." }, 429);
    const body = await readBody(request, 120_000);
    if (!body || !isKind(body.kind)) return json({ error: "Ungültige Anfrage." }, 400);
    const old = await store.set(id);
    if (old && old.kind !== body.kind) return json({ error: "Die Art eines Sets lässt sich nicht ändern." }, 400);
    try {
      const data = cleanSetData(body.kind, (body.data ?? {}) as CardSetData);
      // Nur eigene Bilder: ein fremder Schlüssel würde sonst beim Löschen das Bild eines anderen mitnehmen
      const folder = `${await imageFolder(profile)}/`;
      if (setImages(data).some((k) => !k.startsWith(folder))) return json({ error: "Dieses Bild gehört nicht zu deinem Profil. Lade es neu hoch." }, 400);
      // Wer ein vorgeschlagenes oder freigegebenes Set ändert, schlägt es neu vor
      const listed = old && (old.status === "wartet" || old.status === "frei");
      const set: CardSet = { id, kind: body.kind, name: cleanSetName(body.name), owner: profile, status: listed ? "wartet" : "privat", updatedAt: Date.now(), ...data };
      await store.putSet(set);
      if (listed) await settings.submitSet(set, (await store.get()).name || "Gast");
      if (old) await deleteImages(env, profile, old as CardSetData, set);
      return json({ set });
    } catch (e) {
      if (e instanceof SetError) return json({ error: e.message }, 400);
      throw e;
    }
  }

  if (!m[2] && request.method === "DELETE") {
    const old = await store.deleteSet(id);
    if (old) {
      await settings.withdrawSet(id);
      await deleteImages(env, profile, old as CardSetData);
    }
    return json({ ok: true });
  }

  if (m[2] && request.method === "POST") {
    const set = (await store.set(id)) as CardSet | null;
    if (!set) return json({ error: "Dieses Set gibt es nicht (mehr)." }, 404);
    if (m[2] === "withdraw") {
      await settings.withdrawSet(id);
      await store.setStatus(id, "privat");
      return json({ ok: true, status: "privat" });
    }
    if (!allowed("set-submit", ip, 20)) return json({ error: "Zu viele Vorschläge. Bitte später nochmal." }, 429);
    await settings.submitSet(set, (await store.get()).name || "Gast");
    await store.setStatus(id, "wartet");
    return json({ ok: true, status: "wartet" });
  }

  return json({ error: "Nicht gefunden." }, 404);
}

/** Bilder der Kartensets ausliefern – nur mit dem genauen (nicht erratbaren) Namen */
export async function serveSetImage(env: Env, key: string): Promise<Response> {
  const obj = env.FILES ? await env.FILES.get(key) : null;
  if (!obj) return new Response("Nicht gefunden.", { status: 404 });
  return new Response(obj.body, { headers: {
    "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
  } });
}

/** Inhalte der im Raum gewählten Sets laden: eigene des Gastgebers (aus seinem Profil) oder freigegebene */
export async function loadContent(env: Env, ids: string[], kind: SetKind, hostProfile: string | undefined): Promise<GameContent> {
  const settings = settingsOf(env);
  const sets: GameContent["sets"] = [];
  for (const id of ids) {
    if (!SET_ID_RE.test(id)) continue;
    let set = hostProfile && PROFILE_ID_RE.test(hostProfile) ? ((await profileOf(env, hostProfile).set(id)) as unknown as CardSet | null) : null;
    if (!set) set = (await settings.listedSet(id, true)) as unknown as CardSet | null;
    if (!set || set.kind !== kind) continue;
    sets.push({ id: set.id, name: set.name, data: { black: set.black, white: set.white, words: set.words, questions: set.questions } });
  }
  return { sets };
}
