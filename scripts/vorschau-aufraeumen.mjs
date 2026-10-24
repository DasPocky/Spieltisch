// Vorschauen gemergter Zweige löschen. Jede Vorschau legt eigene Durable-Object-Namespaces an (4 Stück),
// das Konto erlaubt nur 100 – sonst schlagen neue Vorschau-Builds fehl.
//   node scripts/vorschau-aufraeumen.mjs              → Vorschauen aller Zweige, die in origin/main stecken oder gelöscht sind
//   node scripts/vorschau-aufraeumen.mjs claude/xyz   → nur diese Zweige
// Braucht CLOUDFLARE_API_TOKEN (Workers Scripts: Edit). Die Live-Version wird nie angefasst.
import { execSync } from "node:child_process";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "ef9cbceacd8be6cff839033e54c0cb6b";
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
const token = process.env.CLOUDFLARE_API_TOKEN;
const LIMIT = 100;

async function cf(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!body.success) throw new Error(`${path}: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  return body;
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Zweige, deren Vorschau weg darf: in main gemergt oder auf GitHub schon gelöscht */
function doneBranches() {
  git("fetch -q --prune origin");
  const merged = new Set(git("branch -r --merged origin/main").map((b) => b.replace(/^origin\//, "")));
  const alive = new Set(git("branch -r").map((b) => b.replace(/^origin\//, "")));
  return (name) => name !== "main" && (merged.has(name) || !alive.has(name));
}

const args = process.argv.slice(2);
const wanted = args.length ? (name) => args.includes(name) : doneBranches();
const previews = (await cf("/workers/workers/spieltisch/previews?per_page=100")).result;
let gone = 0;
for (const p of previews.filter((p) => wanted(p.name))) {
  await cf(`/workers/workers/spieltisch/previews/${p.id}`, { method: "DELETE" });
  console.log(`gelöscht: ${p.name}`);
  gone++;
}
const used = (await cf("/workers/durable_objects/namespaces?per_page=200")).result_info.total_count;
console.log(`${gone} Vorschau(en) gelöscht, ${previews.length - gone} bleiben · Namespaces ${used}/${LIMIT}`);
if (used > LIMIT - 20) {
  console.error(`Achtung: nur noch Platz für ${Math.floor((LIMIT - used) / 4)} Vorschauen`);
  process.exitCode = 1;
}
