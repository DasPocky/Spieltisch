import type { Step } from "@shared/games/werwolf/logic";

/** Vorlesetext des Erzählers je Nachtschritt – verrät nie, wer welche Rolle hat. */
export const SCRIPT: Record<Step, { title: string; say: string; after?: string }> = {
  sleep: { title: "Die Nacht beginnt", say: "Es wird Nacht in Düsterwald. Alle schließen die Augen." },
  amor: { title: "Amor", say: "Amor erwacht und wählt zwei Menschen, die sich unsterblich verlieben.", after: "Amor schläft wieder ein." },
  lovers: { title: "Die Verliebten", say: "Ich tippe die Verliebten an. Sie öffnen die Augen, erkennen sich – und schlafen wieder ein." },
  wildeskind: { title: "Wildes Kind", say: "Das wilde Kind erwacht und wählt sein Vorbild.", after: "Das wilde Kind schläft wieder ein." },
  wolfshund: { title: "Wolfshund", say: "Der Wolfshund erwacht und entscheidet: Bleibt er beim Dorf – oder läuft er zu den Wölfen?", after: "Der Wolfshund schläft wieder ein." },
  schwestern: { title: "Die Schwestern", say: "Die Schwestern erwachen, erkennen einander – und schlafen wieder ein." },
  beschuetzer: { title: "Heiler", say: "Der Heiler erwacht und wählt, wen er heute Nacht beschützt.", after: "Der Heiler schläft wieder ein." },
  werwolf: { title: "Werwölfe", say: "Die Werwölfe erwachen, erkennen sich und einigen sich leise auf ein Opfer.", after: "Die Werwölfe schlafen satt wieder ein." },
  urwolf: { title: "Urwolf", say: "Der Urwolf erwacht. Will er das Opfer verwandeln, statt es zu fressen?", after: "Der Urwolf schläft wieder ein." },
  grosserwolf: { title: "Großer böser Wolf", say: "Der große böse Wolf erwacht und sucht sich allein ein zweites Opfer.", after: "Der große böse Wolf schläft wieder ein." },
  seherin: { title: "Seherin", say: "Die Seherin erwacht und zeigt auf die Person, deren Rolle sie sehen möchte.", after: "Die Seherin schläft wieder ein." },
  fuchs: { title: "Fuchs", say: "Der Fuchs erwacht und zeigt auf eine Person. Ich sage ihm, ob dort ein Wolf in der Nähe ist.", after: "Der Fuchs schläft wieder ein." },
  rabe: { title: "Rabe", say: "Der Rabe erwacht und markiert jemanden, der ihm verdächtig vorkommt.", after: "Der Rabe schläft wieder ein." },
  hexe: { title: "Hexe", say: "Die Hexe erwacht. Ich zeige ihr das Opfer der Nacht. Will sie heilen? Will sie vergiften?", after: "Die Hexe schläft wieder ein." },
};

export const DAWN_SAY = "Es wird Tag. Das Dorf erwacht.";
