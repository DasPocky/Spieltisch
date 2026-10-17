import { test as setup } from "@playwright/test";
import { ALL_ON, setConfig } from "./util";

/**
 * Die meisten Spiel-Tests spielen lokal („Ein Handy für alle“). Das ist im Auslieferungszustand aus –
 * für die Tests schaltet der Admin es einmal ein.
 */
setup("Ein Handy für alle einschalten", async ({ request }) => {
  await setConfig(request, ALL_ON);
});
