#!/usr/bin/env node
/**
 * Werbebilder neu bauen – aus den Screenshots eines frischen Testlaufs (`screenshots/`), nie mit Markennamen:
 *   docs/images/banner.png      (README, 3200×1640)
 *   docs/images/funktionen.png  (README, 3200×1800)
 *   public/og.png               (Vorschau beim Teilen, 1200×630)
 *
 *   npx playwright test …           # Screenshots erzeugen (siehe NEEDED unten)
 *   node scripts/bilder.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = resolve(import.meta.dirname, "..");
const SHOT = (f) => join(ROOT, "screenshots", f);
const NEEDED = ["01-home.png", "32-fuenfwuerfel-roll.png", "67-eins-online.png", "01e-lobby.png", "83-chat-bubble.png", "76-evening-result.png"];
const missing = NEEDED.filter((f) => !existsSync(SHOT(f)));
if (missing.length) {
  console.error(`Es fehlen Screenshots (erst die Handy-Tests laufen lassen): ${missing.join(", ")}`);
  process.exit(1);
}

const FONT = "https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&display=swap";
const css = `
  @import url("${FONT}");
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Quicksand, system-ui, sans-serif; color: #263238; background: #f3eee6; overflow: hidden; }
  .waves { position: absolute; inset: 0; background:
    radial-gradient(120% 60% at 50% -18%, #2f7f78 0 38%, transparent 38.2%),
    radial-gradient(130% 60% at 40% -10%, #5fa89f 0 45%, transparent 45.2%),
    radial-gradient(140% 60% at 60% -4%, #bcdcd4 0 50%, transparent 50.2%),
    radial-gradient(140% 40% at 50% 118%, #ff7a59 0 42%, transparent 42.2%); }
  .phone { position: absolute; border-radius: 9.5% / 4.6%; background: #1d1f22; padding: 1.1%; box-shadow: 0 40px 80px rgb(0 0 0 / .25); }
  .phone img { display: block; width: 100%; border-radius: 8.6% / 4%; }
  .logo { display: flex; align-items: center; gap: 48px; }
  .logo .tile { width: 260px; height: 260px; border-radius: 64px; background: linear-gradient(#2f7f78 0 34%, #bcdcd4 34% 55%, #ff7a59 55%); display: grid; place-items: center; }
  .logo .die { width: 140px; height: 140px; background: #fff; border-radius: 30px; transform: rotate(-12deg); box-shadow: 0 8px 20px rgb(0 0 0/.2);
    background-image: radial-gradient(circle, #263238 12px, transparent 13px); background-size: 46px 46px; background-position: 1px 1px; }
  h1 { font-size: 240px; font-weight: 700; letter-spacing: -4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 28px; }
  .chip { background: #fffdf8; border-radius: 28px; padding: 22px 40px; font-size: 56px; font-weight: 700; box-shadow: 0 6px 0 #e6ddd0; }
`;
// Bilder direkt eingebettet – eine leere Seite darf keine lokalen Dateien laden
const phone = (img, style) => `<div class="phone" style="${style}"><img src="data:image/png;base64,${readFileSync(SHOT(img)).toString("base64")}"></div>`;
const chips = (list) => `<div class="chips">${list.map((c) => `<span class="chip">${c}</span>`).join("")}</div>`;

const banner = `<div class="waves"></div>
  <div style="position:absolute;left:220px;top:500px;width:1450px;display:grid;gap:70px">
    <div class="logo"><div class="tile"><div class="die"></div></div><h1>Spieltisch</h1></div>
    <p style="font-size:84px;line-height:1.25">Euer Spieleabend am Handy – Raum öffnen, Link teilen, zusammen spielen. Mit Chat, Sprache und Video.</p>
    ${chips(["🎲 Fünf Würfel", "🃏 Eins!", "🐺 Werwolf", "⭐ Alles oder nichts", "🏁 Ludo", "+14"])}
  </div>
  ${phone("01-home.png", "left:1560px;top:290px;width:560px;transform:rotate(-6deg)")}
  ${phone("32-fuenfwuerfel-roll.png", "left:2070px;top:170px;width:600px")}
  ${phone("67-eins-online.png", "left:2620px;top:300px;width:560px;transform:rotate(6deg)")}`;

const og = `<div class="waves"></div>
  <div style="position:absolute;left:130px;top:150px;width:900px;display:grid;gap:40px;zoom:.42">
    <div class="logo"><div class="tile"><div class="die"></div></div><h1>Spieltisch</h1></div>
    <p style="font-size:84px;line-height:1.25">Eure Spielesammlung für den Spieleabend – ein Handy für alle oder jeder am eigenen.</p>
    ${chips(["🎲 Fünf Würfel", "🃏 Eins!", "🐺 Werwolf", "⭐ Alles oder nichts", "+15"])}
  </div>
  ${phone("01-home.png", "left:810px;top:40px;width:300px;transform:rotate(4deg)")}`;

const cards = [["01e-lobby.png", "Lobby", "Jeder mit Tier und Farbe, Reihenfolge mischen"], ["83-chat-bubble.png", "Chat & Video", "Reaktionen als Sprechblasen, Gesichter am Platz"],
  ["01-home.png", "Viele Looks", "Hell oder dunkel, die Verwaltung wählt den Stil"], ["76-evening-result.png", "Siegerehrung", "Podest, Konfetti und Spielabend-Wertung"]];
const funktionen = cards.map(([img, t, s], i) => `
  ${phone(img, `left:${170 + i * 770}px;top:120px;width:620px`)}
  <div style="position:absolute;left:${110 + i * 770}px;top:1500px;width:740px;text-align:center">
    <div style="font-size:84px;font-weight:700">${t}</div><div style="font-size:52px;opacity:.75;margin-top:16px">${s}</div>
  </div>`).join("");

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const [html, w, h, out] of [[banner, 3200, 1640, "docs/images/banner.png"], [funktionen, 3200, 1800, "docs/images/funktionen.png"], [og, 1200, 630, "public/og.png"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body style="width:${w}px;height:${h}px;position:relative">${html}</body></html>`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(ROOT, out) });
  console.log("geschrieben:", out);
  await page.close();
}
await browser.close();
