import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/theme";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Für „Zum Home-Bildschirm“ als App – nur im fertigen Build, nicht beim Entwickeln
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Nicht auf „load“ warten – das hängt bei langsamen Schriften; nach kurzer Pause reicht
  setTimeout(() => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Offline-Vorrat auf den Stand dieser Version bringen (fehlende Spiele nachladen, alte Dateien weg)
    navigator.serviceWorker.ready.then((r) => r.active?.postMessage("precache")).catch(() => {});
  }, 1500);
}
