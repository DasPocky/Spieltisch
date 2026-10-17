#!/usr/bin/env node
/**
 * Ausliefern (Deploy-Befehl von Cloudflare Workers Builds): neue Version hochladen und den laufenden Worker fragen,
 * ob sie sofort live gehen soll oder warten (Update-Zeitpunkt im Admin bzw. UPDATE_MODE).
 *
 * Ohne Rückmeldung (kein RELEASE_SECRET, Worker nicht erreichbar, alte Version ohne /api/release) geht sie sofort live –
 * so bleibt nie ein Update liegen. Geht das Hochladen allein nicht (z. B. neue Durable-Object-Klassen), wird klassisch deployt.
 *
 * Umgebung im Build: RELEASE_SECRET (gleicher Wert wie das Worker-Secret), LIVE_URL (optional, Standard: workers.dev-Adresse),
 * WORKERS_CI_COMMIT_SHA und WORKERS_CI_BRANCH (setzt Cloudflare selbst). Nur auf main – andere Zweige laden nur eine Vorschau hoch.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Adresse der laufenden Version (Standard: workers.dev dieses Kontos) */
const LIVE = process.env.LIVE_URL || "https://spieltisch.bjoern-ef9.workers.dev";
/** Gebaute Seite (Vite + Cloudflare-Plugin) */
const CLIENT = "dist/client";

/**
 * Programmteile der laufenden Version mitliefern: Geräte, die sie noch geöffnet haben, können so nach dem Update
 * fehlende Teile (z. B. ein Spiel, das erst jetzt geöffnet wird) weiter nachladen. Eine Version zurück reicht –
 * die mitgelieferten Dateien stehen nicht in der neuen precache.json, wandern also nicht weiter.
 */
async function keepPreviousAssets() {
  try {
    const res = await fetch(new URL("/precache.json", LIVE), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) { console.log(`Alte Dateiliste nicht erreichbar (${res.status}) – ohne alte Programmteile.`); return; }
    const files = (await res.json()).filter((f) => typeof f === "string" && /^\/assets\/[\w.-]+$/.test(f));
    let added = 0;
    for (const f of files) {
      const dst = join(CLIENT, f);
      if (existsSync(dst)) continue;
      const r = await fetch(new URL(f, LIVE), { signal: AbortSignal.timeout(15_000) }).catch(() => null);
      if (!r?.ok) continue;
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
      added++;
    }
    console.log(`${added} Programmteile der laufenden Version mitgeliefert.`);
  } catch (e) {
    console.log(`Alte Programmteile nicht übernommen (${e.message}).`);
  }
}

const sha = process.env.WORKERS_CI_COMMIT_SHA || execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
const time = new Date().toISOString();
const run = (args) => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const deployNow = (why) => { console.log(`Sofort live: ${why}`); console.log(run(["deploy"])); };

// Nur main geht live. Andere Zweige (Vorschau): nur hochladen – nie den Live-Worker fragen, nie freischalten.
const branch = process.env.WORKERS_CI_BRANCH || execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"]).toString().trim();
if (branch !== "main") {
  console.log(`Zweig ${branch}: nur Vorschau hochladen.`);
  console.log(run(["versions", "upload", "--message", `Vorschau ${branch} ${sha.slice(0, 7)}`]));
  process.exit(0);
}

await keepPreviousAssets();

let versionId = null;
try {
  const out = run(["versions", "upload", "--message", `Spieltisch ${sha.slice(0, 7)}`, "--tag", sha.slice(0, 7)]);
  console.log(out);
  versionId = /Worker Version ID:\s*([0-9a-f-]{36})/i.exec(out)?.[1] ?? null;
} catch {
  deployNow("Hochladen ohne Deploy ging nicht (z. B. neue Durable-Object-Klasse)");
  process.exit(0);
}
if (!versionId) { deployNow("Versions-ID nicht gefunden"); process.exit(0); }

let decision = "now";
const { RELEASE_SECRET: secret } = process.env;
const live = LIVE;
if (secret) {
  try {
    const res = await fetch(new URL("/api/release", live), {
      method: "POST",
      headers: { "content-type": "application/json", "x-release-key": secret },
      body: JSON.stringify({ versionId, sha, time }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.deploy === "later") decision = "later";
    else if (!res.ok) console.log(`Worker sagt ${res.status}: ${body.note ?? body.error ?? ""}`);
  } catch (e) {
    console.log(`Worker nicht erreichbar (${e.message}) – sofort live.`);
  }
} else {
  console.log("RELEASE_SECRET fehlt im Build – sofort live.");
}

if (decision === "later") {
  console.log(`Version ${versionId} wartet – der Worker schaltet sie zum eingestellten Zeitpunkt frei.`);
} else {
  try {
    console.log(run(["versions", "deploy", `${versionId}@100%`, "--yes", "--message", `Spieltisch ${sha.slice(0, 7)}`]));
  } catch {
    deployNow("Freischalten der hochgeladenen Version ging nicht");
  }
}
