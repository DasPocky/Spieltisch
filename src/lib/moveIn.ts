/**
 * Umzug annehmen (siehe shared/platform/move.ts). Läuft als erstes Modul, bevor irgendetwas den Speicher liest.
 * Auf der alten workers.dev-Adresse zieht die App selbst um: Speicher einpacken, weiter nach spieltisch.endlab.de.
 */
import { decodeMove, movePlan, MOVE_PARAM, moveOutTarget } from "@shared/platform/move";

function moveOut() {
  if (typeof window === "undefined") return;
  let target: string | null = null;
  try { target = moveOutTarget(location, localStorage); } catch { target = moveOutTarget(location, { length: 0, key: () => null, getItem: () => null }); }
  if (!target) return;
  location.replace(target);
  // Nichts weiter starten: keine Anfragen, kein neues Profil auf der alten Adresse
  throw new Error("Spieltisch zieht um nach spieltisch.endlab.de");
}

function moveIn() {
  if (typeof window === "undefined") return;
  const hash = new URLSearchParams(location.hash.slice(1));
  const packed = hash.get(MOVE_PARAM);
  if (packed === null) return;
  // Anker sofort weg – er soll weder im Verlauf noch in geteilten Links stehen
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  const data = decodeMove(packed);
  if (!data) return;
  try {
    for (const [k, v] of movePlan(data, (k) => localStorage.getItem(k) !== null)) localStorage.setItem(k, v);
  } catch {
    // Speicher voll oder gesperrt: dann eben ohne alte Daten – Profile lassen sich per Code übertragen
  }
}

moveOut();
moveIn();
