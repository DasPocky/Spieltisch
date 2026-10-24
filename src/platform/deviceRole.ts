/**
 * Was ist dieses Gerät? – eine Stelle für alle Ansichten (Raum, Menü, Fernseher).
 * Gerät und Spieler sind getrennt: wer sein Handy zum Fernseher macht, bleibt Mitspieler; ein Spieler am Rechner
 * kann zusätzlich ein Begleit-Handy haben. Die Rolle bestimmt nur, welche Bedienelemente das Gerät zeigt.
 */

export type DeviceRole = "phone" | "remote" | "desk" | "companion" | "screen" | "shared";

/** Was das Gerät gerade weiß – alles schon anderswo ermittelt (Raum, Kopplung, Fenstergröße) */
export interface DeviceFacts {
  /** Online-Raum (sonst „Ein Handy für alle“) */
  online: boolean;
  /** Dieses Gerät zeigt den Großen Tisch (`/tisch/…`) */
  screen?: boolean;
  /** Begleit-Handy eines Spielers am Rechner */
  companion?: boolean;
  /** Am Rechner: Partie läuft hier am Tisch aus eigener Sicht */
  desk?: boolean;
  /** Am Rechner möglich (großer Bildschirm, Spiel kann es, Partie läuft) */
  deskPossible?: boolean;
  /** Ein Großer Tisch ist verbunden */
  tv?: boolean;
  isHost?: boolean;
  /** Das Begleit-Handy ist verbunden */
  paired?: boolean;
  /** Ein eigener Spieler auf diesem Gerät (online beigetreten) */
  player?: boolean;
}

export function deviceRole(f: DeviceFacts): DeviceRole {
  if (f.screen) return "screen";
  if (!f.online) return "shared";
  if (f.companion) return "companion";
  if (f.desk) return "desk";
  if (f.tv && f.isHost) return "remote";
  return "phone";
}

export const ROLES: Record<DeviceRole, { label: string; text: string }> = {
  phone: { label: "Spiel-Handy", text: "Du spielst hier mit: deine Karten, deine Züge." },
  remote: { label: "Fernbedienung", text: "Dein Spiel-Handy steuert als Host auch den Fernseher." },
  desk: { label: "Rechner mit eigener Hand", text: "Du spielst am Rechner am Tisch, deine Hand liegt darunter." },
  companion: { label: "Begleit-Handy", text: "Gekoppelt mit deinem Rechner: Kamera, Mikro, Chat und deine Karten." },
  screen: { label: "Großer Bildschirm", text: "Zeigt den Tisch für alle und spielt selbst nicht mit." },
  shared: { label: "Ein Handy für alle", text: "Alle spielen reihum an diesem Gerät." },
};

/** Wechsel, die gerade passen – mehr zeigt das Blatt „Mein Gerät ist …“ nicht */
export type RoleSwitch = "screen" | "desk" | "classic" | "pair" | "private" | "remote";

export function roleSwitches(f: DeviceFacts): RoleSwitch[] {
  const role = deviceRole(f);
  if (role === "screen" || role === "shared" || role === "companion") return [];
  const out: RoleSwitch[] = [];
  if (role === "remote") out.push("remote");
  if (f.deskPossible && role !== "desk") out.push("desk");
  if (role === "desk") out.push("classic", f.paired ? "private" : "pair");
  // Fernseher werden: nur ohne verbundenen Tisch – sonst gäbe es zwei
  if (!f.tv) out.push("screen");
  return out;
}
