import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Eigene Konfiguration ohne Cloudflare-Plugin: die Unit-Tests prüfen nur die gemeinsame Logik in shared/.
export default defineConfig({
  resolve: { alias: { "@shared": fileURLToPath(new URL("./shared", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
