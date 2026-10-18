/** Mundbilder (Viseme) für den Moderator – ohne Abhängigkeiten, damit sie sich einfach prüfen lassen */

export type Viseme = "aa" | "E" | "I" | "O" | "U" | "PP" | "FF" | "SS" | "CH" | "DD" | "nn" | "kk" | "RR" | "sil";

/** Deutsch grob in Mundbilder: Vokale, Lippenlaute, Zischlaute … (reicht für glaubhafte Bewegung) */
export function visemesOf(word: string): Viseme[] {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, "");
  const out: Viseme[] = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i], two = w.slice(i, i + 3);
    if (two === "sch") { out.push("CH"); i += 2; continue; }
    if (w.slice(i, i + 2) === "ch") { out.push("CH"); i++; continue; }
    if ("aä".includes(c)) out.push(c === "a" ? "aa" : "E");
    else if ("e".includes(c)) out.push("E");
    else if ("iy".includes(c)) out.push("I");
    else if ("oö".includes(c)) out.push("O");
    else if ("uü".includes(c)) out.push("U");
    else if ("mbp".includes(c)) out.push("PP");
    else if ("fvw".includes(c)) out.push("FF");
    else if ("szßx".includes(c)) out.push("SS");
    else if ("tdl".includes(c)) out.push("DD");
    else if (c === "n") out.push("nn");
    else if ("kgq".includes(c)) out.push("kk");
    else if (c === "r") out.push("RR");
  }
  return out.length ? out : ["sil"];
}
