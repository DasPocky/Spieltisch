#!/usr/bin/env node
/**
 * Belege der Quizfragen prüfen: Jede Frage trägt am Zeilenende „// Quelle: <Adresse> …“.
 * Das Skript holt die Seiten (Wikipedia über die Programmschnittstelle, sonst das HTML) und schaut nach,
 * ob die richtige Antwort darin vorkommt – bei Schätzfragen die Zahl, bei Ordnen alle vier Begriffe
 * (die Reihenfolge selbst prüft es nicht).
 *
 *   node scripts/quiz-belege.mjs [--streng] [--nur kategorie,…]
 *
 * Ergebnis: Liste der Fragen ohne Quelle, mit fehlender Seite oder ohne Fundstelle (Datei quiz-belege.md,
 * in der GitHub-Aktion auch in der Zusammenfassung). Mit --streng endet es mit Fehler, wenn etwas offen ist.
 */
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "shared/games/quiz/fragen";
const args = process.argv.slice(2);
const strict = args.includes("--streng");
const only = args.includes("--nur") ? args[args.indexOf("--nur") + 1].split(",") : null;
const UA = "Spieltisch-Quizpruefung/1.0 (https://github.com/DasPocky/Spieltisch)";

const ZAHLWORT = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"];

/** Fragen mit Quellen aus den Dateien lesen */
function readQuestions() {
  const out = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !["typen.ts", "index.ts"].includes(f)).sort()) {
    const cat = file.replace(/\.ts$/, "");
    if (only && !only.includes(cat)) continue;
    readFileSync(join(DIR, file), "utf8").split("\n").forEach((line, i) => {
      const m = line.match(/^\s*(\[.*\]),?\s*(?:\/\/\s*Quelle:\s*(.*))?$/);
      if (!m) return;
      let q;
      try { q = JSON.parse(m[1]); } catch { return; }
      if (!Array.isArray(q) || typeof q[0] !== "string") return;
      const urls = (m[2] ?? "").split(/\s+/).filter((u) => /^https?:\/\//.test(u));
      out.push({ cat, line: i + 1, q, urls });
    });
  }
  return out;
}

const norm = (t) => t.toLowerCase().replace(/[\u2212\u2013]/g, "-").replace(/[­​]/g, "").replace(/[   ]/g, " ").replace(/[„“”"‚‘’'«»]/g, "").replace(/\s+/g, " ");

/** Seite holen (zwischengespeichert) – Wikipedia als reiner Text, sonst HTML ohne Tags */
const cache = new Map();
async function page(url) {
  if (!cache.has(url)) cache.set(url, load(url));
  return cache.get(url);
}
async function load(url) {
  const wiki = url.match(/^https?:\/\/(\w+)\.wikipedia\.org\/wiki\/(.+)$/);
  // Wikipedia: ganze Seite als HTML (mit Tabellen und Infokasten, Weiterleitungen folgt die Schnittstelle selbst)
  const src = wiki ? `https://${wiki[1]}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(decodeURIComponent(wiki[2].split("#")[0]))}?redirect=true` : url;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(src, { headers: { "User-Agent": UA }, redirect: "follow" });
      if (r.status === 404) return null;
      if (!r.ok) { await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1))); continue; }
      const html = await r.text();
      return norm(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))));
    } catch {
      await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
    }
  }
  failed.add(url);
  return null;
}
const failed = new Set();

/** Kommt ein Begriff vor? Ganz, ohne Artikel, als Ziffer/Zahlwort oder mit allen wichtigen Wörtern */
const FILL = /^(der|die|das|den|dem|des|ein|eine|einen|einem|am|im|in|auf|zum|zur|mit|aus|von|vom|durch|nach)\s+/;
function hasTerm(text, term) {
  let t = norm(term).replace(/\s*\(.*?\)/g, "").replace(/[.,;:!?]+$/, "");
  if (!t || text.includes(t)) return true;
  while (FILL.test(t)) { t = t.replace(FILL, ""); if (text.includes(t)) return true; }
  const n = ZAHLWORT.indexOf(t);
  if (n >= 0 && new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(text)) return true;
  if (/^\d+$/.test(t) && Number(t) <= 20 && text.includes(ZAHLWORT[Number(t)])) return true;
  // mehrere Wörter: jedes muss vorkommen (lange Wörter genügen mit ihrem Anfang, z. B. „Gemüsesuppe“ → „gemüs“)
  const words = t.split(/[\s-]+/).filter((w) => w.length >= 4);
  return words.length > 1 && words.every((w) => text.includes(w.length >= 7 ? w.slice(0, 5) : w));
}

/** Zahl in den üblichen Schreibweisen (1234, 1.234, 1 234, 12,5 / 12.5) */
function hasNumber(text, n) {
  const forms = new Set();
  const [int, dec] = String(n).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  for (const g of [int, grouped, grouped.replace(/\./g, " ")]) {
    if (dec) { forms.add(`${g},${dec}`); forms.add(`${g}.${dec}`); } else forms.add(g);
  }
  return [...forms].some((f) => new RegExp(`(^|[^\\d.,])${f.replace(/\./g, "\\.")}([^\\d]|[.,](?!\\d)|$)`).test(text));
}

async function check(item) {
  const { q, urls } = item;
  if (!urls.length) return { ...item, status: "ohne Quelle" };
  const texts = (await Promise.all(urls.map(page)));
  const missing = urls.filter((_, i) => texts[i] === null);
  const text = texts.filter(Boolean).join(" \n ");
  if (!text) return { ...item, status: "Seite fehlt", detail: missing.join(" ") };
  let lacking = [];
  if (typeof q[1] === "number") { if (!hasNumber(text, q[1])) lacking = [String(q[1])]; }
  else if (Array.isArray(q[1])) lacking = q[1].filter((x) => !hasTerm(text, x));
  else if (!hasTerm(text, q[1])) lacking = [q[1]];
  if (lacking.length) return { ...item, status: "nicht gefunden", detail: `${lacking.join(", ")}${missing.length ? ` (Seite fehlt: ${missing.join(" ")})` : ""}` };
  return { ...item, status: missing.length ? "teilweise" : "ok", detail: missing.length ? `Seite fehlt: ${missing.join(" ")}` : "" };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const questions = readQuestions();
const results = await pool(questions, 4, check);
if (failed.size) console.log(`Abruf fehlgeschlagen (Netz): ${[...failed].join(" ")}`);
const open = results.filter((r) => r.status !== "ok");
const by = (s) => results.filter((r) => r.status === s).length;
const lines = [
  `# Quiz-Belege`,
  ``,
  `${results.length} Fragen · ${by("ok")} belegt · ${by("nicht gefunden")} Antwort nicht gefunden · ${by("Seite fehlt")} Seite fehlt · ${by("ohne Quelle")} ohne Quelle · ${by("teilweise")} mit einer fehlenden von mehreren Seiten`,
  ``,
  ...(open.length ? ["| Datei:Zeile | Status | Frage | Antwort | Hinweis |", "| --- | --- | --- | --- | --- |"] : []),
  ...open.map((r) => `| ${r.cat}:${r.line} | ${r.status} | ${r.q[0].replace(/\|/g, "/")} | ${(Array.isArray(r.q[1]) ? r.q[1].join(" → ") : String(r.q[1])).replace(/\|/g, "/")} | ${(r.detail ?? "").replace(/\|/g, "/")} |`),
];
writeFileSync("quiz-belege.md", lines.join("\n") + "\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
console.log(lines.slice(0, 3).join("\n"));
for (const r of open) console.log(`${r.cat}:${r.line}\t${r.status}\t${r.q[0]}\t${r.detail ?? ""}`);
if (strict && open.some((r) => r.status !== "teilweise")) process.exit(1);
