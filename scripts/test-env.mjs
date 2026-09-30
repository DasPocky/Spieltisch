// Legt für die Playwright-Tests fehlende Werte in .dev.vars an (vorhandene bleiben unangetastet).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const NEEDED = { ADMIN_PASSWORD: "test-admin", REALTIME_APP_ID: "test", REALTIME_APP_TOKEN: "test", REALTIME_FAKE: "1" };
const text = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
const have = new Set(text.split("\n").map((l) => l.split("=")[0].trim()).filter(Boolean));
const add = Object.entries(NEEDED).filter(([k]) => !have.has(k)).map(([k, v]) => `${k}=${v}`);
if (add.length) writeFileSync(".dev.vars", (text && !text.endsWith("\n") ? text + "\n" : text) + add.join("\n") + "\n");
