import { defineConfig } from "@playwright/test";

const PORT = 5199;

/**
 * Ende-zu-Ende-Tests im Handy-Format gegen den echten Dev-Server (inkl. Worker und Durable Objects).
 * Lokal mit vorinstalliertem Chromium: PW_CHROMIUM_PATH=/pfad/zu/chromium npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "de-DE",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
