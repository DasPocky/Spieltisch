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

export default defineConfig({
  define: { __BUILD__: JSON.stringify(buildInfo()) },
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: false }), precacheList()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
