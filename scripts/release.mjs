#!/usr/bin/env node
/**
 * Ausliefern (Deploy-Befehl von Cloudflare Workers Builds, `npm run cf:deploy`): Programmteile der laufenden Version
 * mitliefern, dann `wrangler deploy`. Jede Version geht sofort live.
 *
 * Nur auf main. Andere Zweige laufen über den Version-Befehl (`npm run cf:preview`); landet ein anderer Zweig doch
 * hier, lädt das Skript nur eine Vorschau hoch und fasst live nicht an.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Adresse der laufenden Version */
const LIVE = process.env.LIVE_URL || "https://spieltisch.endlab.de";
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

const run = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: "inherit" });

const branch = process.env.WORKERS_CI_BRANCH || execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"]).toString().trim();
if (branch !== "main") {
  console.log(`Zweig ${branch}: nur Vorschau hochladen.`);
  run(["preview"]);
  process.exit(0);
}

await keepPreviousAssets();
run(["deploy"]);
