import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Offline-Liste für den Service Worker: alle gebauten Dateien der Seite (auch die erst später geladenen Spiele).
 * Der Worker speichert sie beim ersten Besuch still mit – danach laufen lokale Spiele auch ohne Netz.
 */
function precacheList(): Plugin {
  return {
    name: "spieltisch-precache",
    apply: "build",
    generateBundle(_, bundle) {
      if (this.environment?.name !== "client") return;
      const files = Object.values(bundle).map((f) => `/${f.fileName}`).filter((f) => !f.endsWith(".map") && f.startsWith("/assets/"))
        .map((f) => `${APP_BASE}${f}`)
        // Schriften nicht vorab: es gibt viele (je Look eigene) – die benutzten landen beim ersten Laden im Cache
        .filter((f) => !/\.woff2?$/.test(f));
      this.emitFile({ type: "asset", fileName: "precache.json", source: JSON.stringify(files) });
    },
  };
}

/** Stand des Codes: in Cloudflare-Builds aus deren Umgebung, sonst aus git */
function buildInfo() {
  const git = (cmd: string) => { try { return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };
  return {
    sha: process.env.WORKERS_CI_COMMIT_SHA || git("rev-parse HEAD") || "dev",
    branch: process.env.WORKERS_CI_BRANCH || git("rev-parse --abbrev-ref HEAD"),
    time: new Date().toISOString(),
  };
}

/**
 * Basispfad: mit APP_BASE ausdrücklich, sonst in jedem Cloudflare-Build (Produktion und Vorschau) „/spieltisch“ –
 * die App läuft unter endlab.de/spieltisch (E3, docs/endlab.md). Lokal und in den Tests bleibt sie an der Wurzel.
 */
const APP_BASE = (process.env.APP_BASE ?? (process.env.WORKERS_CI_BRANCH ? "/spieltisch" : "")).replace(/\/+$/, "");

export default defineConfig({
  base: `${APP_BASE}/`,
  // Basispfad (z. B. „/spieltisch“ unter endlab.de) – ohne Angabe läuft die App an der Wurzel wie bisher
  define: { __BUILD__: JSON.stringify(buildInfo()), __APP_BASE__: JSON.stringify(APP_BASE) },
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: false }), precacheList()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
