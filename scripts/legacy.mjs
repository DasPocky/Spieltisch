#!/usr/bin/env node
/**
 * Alte Spielversion sichern, bevor eine Änderung am Spielstand-Format live geht.
 *
 *   node scripts/legacy.mjs <spiel> [--from <git-ref>]   sichert Logik + Oberfläche aus <git-ref> (Standard: origin/main)
 *   node scripts/legacy.mjs <spiel> --no-snapshot        nur die Versionsliste nachziehen (Spiel hat `migrate`)
 *   node scripts/legacy.mjs --prune <spiel>-v<N>         gesicherte Version entfernen
 *
 * Ablauf: `version` in shared/games/<spiel>/logic.ts erhöhen, dann dieses Skript. Es kopiert
 * shared/games/<spiel> nach shared/legacy/<spiel>-v<alt> und src/games/<spiel> nach src/legacy/<spiel>-v<alt>,
 * passt die Importe an, trägt beides in die Verzeichnisse ein und aktualisiert shared/games/versions.json.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const VERSIONS = join(ROOT, "shared/games/versions.json");
const SHARED_INDEX = join(ROOT, "shared/legacy/index.ts");
const UI_INDEX = join(ROOT, "src/legacy/index.ts");

const args = process.argv.slice(2);
const fail = (msg) => { console.error(msg); process.exit(1); };
const versionIn = (file) => Number(/^\s*version:\s*(\d+)/m.exec(readFileSync(file, "utf8"))?.[1] ?? NaN);
const camel = (s) => s.replace(/[^a-z0-9]+(.)/gi, (_, c) => c.toUpperCase());

if (args[0] === "--prune") {
  const name = args[1];
  if (!/^[a-z0-9]+-v\d+$/.test(name ?? "")) fail("Aufruf: node scripts/legacy.mjs --prune <spiel>-v<N>");
  rmSync(join(ROOT, "shared/legacy", name), { recursive: true, force: true });
  rmSync(join(ROOT, "src/legacy", name), { recursive: true, force: true });
  for (const f of [SHARED_INDEX, UI_INDEX]) {
    writeFileSync(f, readFileSync(f, "utf8").split("\n").filter((l) => !l.includes(`/${name}/`) && !l.includes(`legacy:${name}`)).join("\n"));
  }
  console.log(`${name} entfernt.`);
  process.exit(0);
}

const id = args[0];
if (!id || !existsSync(join(ROOT, "shared/games", id, "logic.ts"))) fail("Aufruf: node scripts/legacy.mjs <spiel> [--from <git-ref>] [--no-snapshot]");
const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : "origin/main";
const versions = JSON.parse(readFileSync(VERSIONS, "utf8"));
const now = versionIn(join(ROOT, "shared/games", id, "logic.ts"));
const old = versions[id];

if (!args.includes("--no-snapshot")) {
  if (now === old) fail(`${id}: Version ist noch ${now} – erst \`version\` in shared/games/${id}/logic.ts erhöhen.`);
  const tmp = mkdtempSync(join(tmpdir(), "legacy-"));
  const tar = execFileSync("git", ["archive", from, `shared/games/${id}`, `src/games/${id}`], { cwd: ROOT });
  execFileSync("tar", ["-x", "-C", tmp], { input: tar });
  const was = versionIn(join(tmp, "shared/games", id, "logic.ts"));
  if (was !== old) fail(`${id}: In ${from} steht Version ${was}, versions.json sagt ${old} – bitte --from angeben.`);
  const name = `${id}-v${was}`;

  for (const side of ["shared", "src"]) {
    const src = join(tmp, side, "games", id);
    const dst = join(ROOT, side, "legacy", name);
    if (existsSync(dst)) fail(`${dst} gibt es schon.`);
    cpSync(src, dst, { recursive: true });
    // Importe anpassen: was außerhalb des Spielordners lag, zeigt weiter auf die echten Dateien
    const origDir = join(ROOT, side, "games", id);
    const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    for (const file of walk(dst).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const origFile = join(origDir, relative(dst, file));
      let code = readFileSync(file, "utf8");
      code = code.replace(/(from\s+|import\s*\(\s*)(["'])([^"']+)\2/g, (m, pre, q, spec) => {
        let next = spec;
        if (spec.startsWith(".")) {
          const target = resolve(dirname(origFile), spec);
          if (!target.startsWith(origDir + "/") && target !== origDir) {
            next = relative(dirname(file), target);
            if (!next.startsWith(".")) next = `./${next}`;
          }
        } else if (spec === `@shared/games/${id}` || spec.startsWith(`@shared/games/${id}/`)) {
          next = spec.replace(`@shared/games/${id}`, `@shared/legacy/${name}`);
        } else if (spec === `@/games/${id}` || spec.startsWith(`@/games/${id}/`)) {
          next = spec.replace(`@/games/${id}`, `@/legacy/${name}`);
        }
        return `${pre}${q}${next}${q}`;
      });
      writeFileSync(file, `// Gesicherte Version ${was} von „${id}“ – nicht mehr ändern (scripts/legacy.mjs)\n${code}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });

  // In die Verzeichnisse eintragen
  const logicName = /export const (\w+)\s*:\s*GameLogic/.exec(readFileSync(join(ROOT, "shared/legacy", name, "logic.ts"), "utf8"))?.[1];
  const uiName = /export const (\w+UI)\b/.exec(readFileSync(join(ROOT, "src/legacy", name, "index.tsx"), "utf8"))?.[1];
  if (!logicName || !uiName) fail("Export der Logik bzw. Oberfläche nicht gefunden – Einträge bitte von Hand ergänzen.");
  const alias = `${camel(id)}V${was}`;
  let s = readFileSync(SHARED_INDEX, "utf8");
  s = s.replace("// legacy:imports", `// legacy:imports\nimport { ${logicName} as ${alias} } from "./${name}/logic";`);
  s = s.replace("  // legacy:entries", `  // legacy:entries\n  "${id}@${was}": ${alias}, // legacy:${name}`);
  writeFileSync(SHARED_INDEX, s);
  let u = readFileSync(UI_INDEX, "utf8");
  u = u.replace("  // legacy:loaders", `  // legacy:loaders\n  "${id}@${was}": () => import("./${name}").then((m) => m.${uiName} as unknown as GameUI), // legacy:${name}`);
  writeFileSync(UI_INDEX, u);
  console.log(`Gesichert: ${name} (Version ${was}). Läuft nach dem Update noch eine Partie damit, spielt sie damit zu Ende.`);
}

versions[id] = now;
writeFileSync(VERSIONS, `${JSON.stringify(versions, null, 2)}\n`);
console.log(`versions.json: ${id} → ${now}`);
