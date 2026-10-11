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

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), precacheList()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
