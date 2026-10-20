import type { FragenKategorie } from "./typen";
import { ALLGEMEIN } from "./allgemein";
import { GEOGRAFIE } from "./geografie";
import { NATUR } from "./natur";
import { GESCHICHTE } from "./geschichte";
import { SPORT } from "./sport";
import { ESSEN } from "./essen";
import { KULTUR } from "./kultur";
import { KINDER } from "./kinder";

/** Alle Kategorien – neue nur hinten anfügen, Kennungen nie ändern (laufende Partien merken sich „Kategorie:Nummer“) */
export const KATEGORIEN: FragenKategorie[] = [ALLGEMEIN, GEOGRAFIE, NATUR, GESCHICHTE, SPORT, ESSEN, KULTUR, KINDER];
export const KAT_BY_ID: Record<string, FragenKategorie> = Object.fromEntries(KATEGORIEN.map((k) => [k.id, k]));
