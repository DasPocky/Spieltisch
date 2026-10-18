#!/usr/bin/env node
/**
 * Dateien einspielen (GitHub-Aktion „Dateien einspielen“): freie Originale holen, verkleinern und in den Speicher (R2)
 * der laufenden App laden – über PUT /api/release/files/<Ordner>/<Name> mit RELEASE_SECRET.
 *
 * Umgebung: RELEASE_SECRET (gleicher Wert wie das Worker-Secret), ZIEL (Adresse der App, Standard: workers.dev-Adresse),
 * NUR (optional: nur diese Datei, z. B. „moderator/mensch.glb“).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET = (process.env.ZIEL || "https://spieltisch.bjoern-ef9.workers.dev").replace(/\/$/, "");
const SECRET = process.env.RELEASE_SECRET;
const ONLY = process.env.NUR || "";
/** Verkleinern: Meshopt + WebP; Skelett und Namen bleiben (die Bibliothek sucht „Armature“) */
const GLTF_CLI = "@gltf-transform/cli@4.5.1";

/** Alle Dateien mit Herkunft und Lizenz (siehe docs/betrieb.md) */
const FILES = [
  {
    path: "moderator/mensch.glb",
    url: "https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/mpfb.glb",
    license: "CC0 – Figur aus den TalkingHead-Beispielen (Blender/MPFB)",
    optimize: ["--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "2048", "--flatten", "false", "--join", "false", "--simplify", "false"],
  },
  {
    path: "moderator/roboter.glb",
    url: "https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
    license: "CC0 – RobotExpressive (Tomás Laulhé, Gesichter: Don McCurdy)",
  },
];

if (!SECRET) { console.error("RELEASE_SECRET fehlt – in GitHub unter Settings → Secrets → Actions anlegen."); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), "assets-"));
let failed = 0;

for (const f of FILES.filter((f) => !ONLY || f.path === ONLY)) {
  try {
    console.log(`\n${f.path}  (${f.license})`);
    const res = await fetch(f.url, { signal: AbortSignal.timeout(180_000) });
    if (!res.ok) throw new Error(`Download ${res.status}`);
    const src = join(dir, "src.glb"), out = join(dir, "out.glb");
    writeFileSync(src, Buffer.from(await res.arrayBuffer()));
    let file = src;
    if (f.optimize) {
      execFileSync("npx", ["-y", GLTF_CLI, "optimize", src, out, ...f.optimize], { stdio: "inherit" });
      file = out;
    }
    const bytes = readFileSync(file);
    console.log(`  ${(bytes.length / 1e6).toFixed(2)} MB → ${TARGET}`);
    const put = await fetch(`${TARGET}/api/release/files/${f.path}`, {
      method: "PUT", body: bytes, headers: { "x-release-key": SECRET, "content-type": "application/octet-stream" }, signal: AbortSignal.timeout(180_000),
    });
    const body = await put.json().catch(() => ({}));
    if (!put.ok) throw new Error(`Hochladen ${put.status}: ${body.error ?? "unbekannt"}`);
    console.log("  eingespielt ✓");
  } catch (e) {
    failed++;
    console.error(`  Fehler: ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(failed ? 1 : 0);
