import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/theme";
import { siteConfigNow, whenSiteConfig } from "./hooks/useSiteConfig";
import App from "./App";
import { checkFreshStart } from "./lib/freshStart";
import { startUpdates } from "./lib/update";
import { installBase, ownsRegistration, SW_SCOPE, SW_URL } from "./lib/base";
import { BASE } from "@shared/platform/base";

// Basispfad (unter endlab.de: /spieltisch) vor alle Anfragen – zuerst, vor dem ersten fetch
installBase();
// Alte Adresse ohne Basispfad (z. B. spieltisch.endlab.de/r/ABCDE): auf denselben Pfad unter dem Basispfad, gleiche Herkunft – nichts geht verloren
if (BASE && location.pathname !== BASE && !location.pathname.startsWith(`${BASE}/`)) location.replace(`${BASE}${location.pathname}${location.search}${location.hash}`);

// Als App auf dem Homescreen: echte Fensterhöhe statt 100dvh (iOS rechnet dort die Statusleiste falsch heraus)
// Nach einem Neuladen (z. B. durch ein Update) meldet iOS die Höhe anfangs zu klein und schickt danach kein „resize“ –
// darum mehrfach nachmessen; im Hochformat über die ganze Breite ist das Fenster dort so hoch wie der Bildschirm.
const iosApp = (navigator as Navigator & { standalone?: boolean }).standalone === true;
if (iosApp || matchMedia("(display-mode: standalone)").matches) {
  const fit = () => {
    let h = Math.max(window.innerHeight, document.documentElement.clientHeight);
    if (iosApp && window.innerWidth === screen.width && window.innerWidth < window.innerHeight) h = Math.max(h, screen.height);
    document.documentElement.style.setProperty("--app-h", `${h}px`);
  };
  const soon = () => { fit(); for (const ms of [100, 500, 1500]) setTimeout(fit, ms); };
  soon();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 300));
  window.addEventListener("pageshow", soon);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) soon(); });
}

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
        navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(() => {});
        // Offline-Vorrat auf den Stand dieser Version bringen (fehlende Spiele nachladen, alte Dateien weg)
        navigator.serviceWorker.ready.then((r) => r.active?.postMessage("precache")).catch(() => {});
      } else {
        // Offline-App abgeschaltet (Standard): alten Worker und Zwischenspeicher entfernen – immer frisch online
        // Nur den eigenen – unter endlab.de gehören andere Service Worker der Startseite und anderen Projekten
        navigator.serviceWorker.getRegistrations().then((rs) => rs.filter(ownsRegistration).forEach((r) => void r.unregister())).catch(() => {});
        if ("caches" in window) caches.keys().then((ks) => ks.filter((k) => k.startsWith("spieltisch")).forEach((k) => void caches.delete(k))).catch(() => {});
      }
    });
  }, 1500);
}
