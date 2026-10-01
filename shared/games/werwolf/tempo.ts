/**
 * Tempo der Automatik (Werwolf und Eine Nacht): drei Vorgaben oder eigene Zeiten.
 * Rollen, Werwölfe, reine Info-Schritte, Stichwahl/Wahl in Sekunden, Diskussion in Minuten.
 */
import type { Options, SettingDef } from "../../platform/types";

export interface Tempo { role: number; wolves: number; info: number; talk: number; vote: number }

export const TEMPO = {
  slow: { role: 30, wolves: 45, info: 10, talk: 8, vote: 90 },
  normal: { role: 20, wolves: 30, info: 8, talk: 5, vote: 90 },
  fast: { role: 12, wolves: 20, info: 6, talk: 3, vote: 90 },
} as const satisfies Record<string, Tempo>;

/** Eigene Zeiten: Einstellungsschlüssel je Wert */
const CUSTOM: Record<keyof Tempo, string> = { role: "tRole", wolves: "tWolves", info: "tInfo", talk: "tTalk", vote: "tVote" };

export function tempoOf(o: Options): Tempo {
  if (o.tempo === "slow" || o.tempo === "fast") return TEMPO[o.tempo];
  if (o.tempo !== "custom") return TEMPO.normal;
  const num = (k: keyof Tempo) => { const n = Number(o[CUSTOM[k]]); return Number.isFinite(n) && n > 0 ? n : TEMPO.normal[k]; };
  return { role: num("role"), wolves: num("wolves"), info: num("info"), talk: num("talk"), vote: num("vote") };
}

const custom = (o: Options) => o.tempo === "custom";

/**
 * Einstellungen „Tempo“ samt eigener Zeiten (nur bei „Eigene“ sichtbar).
 * `talk`: Diskussion gehört dazu (Eine Nacht hat dafür „minutes“), `vote`: wann die Wahl-Zeit sichtbar ist.
 */
export function tempoSettings({ hints, talk, vote, inGame }: {
  hints: Record<"slow" | "normal" | "fast", string>; talk: boolean; vote?: (o: Options) => boolean; inGame?: boolean;
}): SettingDef[] {
  const n = TEMPO.normal;
  const g = { group: "Ablauf", inGame } as const;
  const defs: SettingDef[] = [
    {
      key: "tempo", label: "Tempo", type: "choice", default: "normal", ...g,
      choices: [
        { value: "slow", label: "Gemütlich", hint: hints.slow },
        { value: "normal", label: "Normal", hint: hints.normal },
        { value: "fast", label: "Zügig", hint: hints.fast },
        { value: "custom", label: "Eigene", hint: "selbst einstellen" },
      ],
    },
    { key: CUSTOM.role, label: "Zeit pro Rolle (s)", type: "number", default: n.role, min: 5, max: 90, step: 5, showIf: custom, ...g },
    { key: CUSTOM.wolves, label: "Zeit Werwölfe (s)", type: "number", default: n.wolves, min: 10, max: 120, step: 5, showIf: custom, ...g },
    { key: CUSTOM.info, label: "Nur schauen (s)", type: "number", default: n.info, min: 3, max: 30, step: 1, showIf: custom, ...g },
  ];
  if (talk) defs.push({ key: CUSTOM.talk, label: "Diskussion (min)", type: "number", default: n.talk, min: 1, max: 20, step: 1, showIf: custom, ...g });
  if (vote) defs.push({ key: CUSTOM.vote, label: "Stichwahl & Wahl (s)", type: "number", default: n.vote, min: 30, max: 300, step: 15, showIf: (o) => custom(o) && vote(o), ...g });
  return defs;
}
