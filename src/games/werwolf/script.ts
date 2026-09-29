import type { Step } from "@shared/games/werwolf/logic";

/** Vorlesetext des Erzählers je Nachtschritt – verrät nie, wer welche Rolle hat. */
export const SCRIPT: Record<Step, { title: string; say: string; after?: string }> = {
  sleep: { title: "Die Nacht beginnt", say: "Es wird Nacht in Düsterwald. Alle schließen die Augen." },
  amor: { title: "Amor", say: "Amor erwacht und wählt zwei Menschen, die sich unsterblich verlieben.", after: "Amor schläft wieder ein." },
  lovers: { title: "Die Verliebten", say: "Ich tippe die Verliebten an. Sie öffnen die Augen, erkennen sich – und schlafen wieder ein." },
  beschuetzer: { title: "Beschützer", say: "Der Beschützer erwacht und wählt, wen er heute Nacht beschützt.", after: "Der Beschützer schläft wieder ein." },
  werwolf: { title: "Werwölfe", say: "Die Werwölfe erwachen, erkennen sich und einigen sich leise auf ein Opfer.", after: "Die Werwölfe schlafen satt wieder ein." },
  seherin: { title: "Seherin", say: "Die Seherin erwacht und zeigt auf die Person, deren Rolle sie sehen möchte.", after: "Die Seherin schläft wieder ein." },
  hexe: { title: "Hexe", say: "Die Hexe erwacht. Ich zeige ihr das Opfer der Nacht. Will sie heilen? Will sie vergiften?", after: "Die Hexe schläft wieder ein." },
};

export const DAWN_SAY = "Es wird Tag. Das Dorf erwacht.";
