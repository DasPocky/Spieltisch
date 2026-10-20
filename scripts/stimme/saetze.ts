/**
 * Feste Bausteine der echten Stimme sammeln (für die GitHub-Aktion „Stimme“): Moderator-Sprüche je Charakter
 * und häufige Ansagen, zerlegt wie am Gerät. Ausgabe: JSON-Liste { mood, text } auf stdout.
 *   npx esbuild scripts/stimme/saetze.ts --bundle --platform=node --log-level=error | node > saetze.json
 */
import { LINES, type Mood } from "../../src/platform/moderator/lines";
import { pieces, sentences, type VoiceMood } from "../../shared/platform/voice";

const MOOD: Record<Mood, VoiceMood> = { charmant: "froh", frech: "ueberrascht", boese: "wuetend" };
const SAMPLE = "Anna";

/** Ansagen, die oft kommen (ohne Namen) */
const COMMON: [VoiceMood, string][] = [
  ["neutral", "Du bist dran."],
  ["neutral", "ist dran."],
  ["neutral", "Noch eine Minute."],
  ["neutral", "Noch 30 Sekunden."],
  ["neutral", "Die Zeit ist um. Stimmt jetzt ab."],
  ["neutral", "Es wird Nacht. Jeder schaut auf sein eigenes Handy und handelt geheim."],
  ["neutral", "Willkommen in Düsterwald. Jeder schaut sich jetzt geheim seine Rolle an. Sind alle bereit, beginnt die erste Nacht."],
  ["neutral", "Alle kennen ihre Rolle. Legt das Handy in die Mitte."],
  ["neutral", "Es wird Nacht in Düsterwald."],
  ["neutral", "Los!"],
  ["neutral", "Zeit ist um!"],
  ["neutral", "Das Spiel ist aus."],
  ["neutral", "Es gewinnt"],
  ["neutral", "mit"],
  ["neutral", "Punkten."],
  ["neutral", "Punkt."],
  ["neutral", "und"],
  ["neutral", "Die Lunte brennt!"],
  ["neutral", "Wer ist der Hochstapler? Auf drei zeigt jeder auf seinen Verdacht. Eins, zwei, drei!"],
];

const out = new Map<string, { mood: VoiceMood; text: string }>();
const add = (mood: VoiceMood, text: string) => {
  // Ganze Sätze ohne Namen am Stück (klingt am besten), dazu die Bausteine für Sätze mit Namen
  for (const s of sentences(text)) if (!s.includes(SAMPLE)) out.set(`${mood}|${s}`, { mood, text: s });
  for (const p of pieces(text, [SAMPLE], mood)) if (p.kind === "text") out.set(`${p.mood}|${p.text}`, { mood: p.mood, text: p.text });
};
for (const [mood, moments] of Object.entries(LINES) as [Mood, Record<string, string[]>][]) {
  for (const list of Object.values(moments)) for (const line of list) add(MOOD[mood], line.replaceAll("{name}", SAMPLE));
}
for (const [mood, text] of COMMON) add(mood, text);
process.stdout.write(JSON.stringify([...out.values()]));
