/**
 * Umzug annehmen (siehe shared/platform/move.ts). Läuft als erstes Modul, bevor irgendetwas den Speicher liest.
 */
import { decodeMove, movePlan, MOVE_PARAM } from "@shared/platform/move";

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

moveIn();
