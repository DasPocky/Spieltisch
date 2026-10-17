import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/theme";
import { siteConfigNow, whenSiteConfig } from "./hooks/useSiteConfig";
import App from "./App";
import { checkFreshStart } from "./lib/freshStart";
import { startUpdates } from "./lib/update";

// Admin-Einstellungen (u. a. der Look) gleich beim Start holen – und nach einem Neustart im Admin einmal frisch beginnen
siteConfigNow();
void whenSiteConfig().then(checkFreshStart);
// Neue Versionen bemerken und an einem ruhigen Moment neu laden
startUpdates();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Für „Zum Home-Bildschirm“ als App – nur im fertigen Build, nicht beim Entwickeln
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Nicht auf „load“ warten – das hängt bei langsamen Schriften; nach kurzer Pause reicht
  setTimeout(() => {
    void whenSiteConfig().then((c) => {
      if (c.features?.offline) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
        // Offline-Vorrat auf den Stand dieser Version bringen (fehlende Spiele nachladen, alte Dateien weg)
        navigator.serviceWorker.ready.then((r) => r.active?.postMessage("precache")).catch(() => {});
      } else {
        // Offline-App abgeschaltet (Standard): alten Worker und Zwischenspeicher entfernen – immer frisch online
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())).catch(() => {});
        if ("caches" in window) caches.keys().then((ks) => ks.filter((k) => k.startsWith("spieltisch")).forEach((k) => void caches.delete(k))).catch(() => {});
      }
    });
  }, 1500);
}
