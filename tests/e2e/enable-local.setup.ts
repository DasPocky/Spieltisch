import { expect, test as setup } from "@playwright/test";

/**
 * Die meisten Spiel-Tests spielen lokal („Ein Handy für alle“). Das ist im Auslieferungszustand aus –
 * für die Tests schaltet der Admin es einmal ein.
 */
setup("Ein Handy für alle einschalten", async ({ request }) => {
  const res = await request.post("/api/admin", { data: { password: "test-admin", config: { site: "on", games: {}, message: "", features: { online: true, call: true, groups: true, profiles: true, local: true, offline: false } } } });
  expect(res.ok()).toBe(true);
});
