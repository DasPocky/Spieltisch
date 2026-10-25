/**
 * Themen fürs Erklärspiel: fasst die Kategorien von Stirnraten (die auch Zeichnen & Raten nutzt) zu wenigen
 * Gruppen zusammen – als Chips in den Einstellungen. Kategorien zum Summen oder für Geräusche taugen nicht
 * zum Erklären und fehlen. Neue Kategorien bei Stirnraten landen ohne Eintrag hier unter „Gemischtes“.
 */
import { CATEGORIES, catsUpTo, levelOf, type Category, type Level } from "../stirnraten/cards";
import type { Options } from "../../platform/types";

export interface Theme { id: string; name: string; emoji: string; cats: string[]; /** erst ab dieser Stufe */ level?: Level }

export const THEMES: Theme[] = [
  { id: "natur", name: "Tiere & Natur", emoji: "🦒", cats: ["k-tiere", "k-bauernhof", "k-meer", "k-natur", "k-dinos", "f-tiere"] },
  { id: "essen", name: "Essen", emoji: "🍝", cats: ["k-essen", "k-obst", "f-essen"] },
  { id: "alltag", name: "Alltag & Zuhause", emoji: "🏠", cats: ["k-zuhause", "k-spielzeug", "k-koerper", "f-haushalt", "f-werkzeug", "f-kleidung", "f-koerper", "g-wg"] },
  { id: "berufe", name: "Berufe & Schule", emoji: "🧑‍🔧", cats: ["k-berufe", "f-berufe", "f-schule", "g-buero"] },
  { id: "freizeit", name: "Sport & Freizeit", emoji: "⚽", cats: ["f-sport", "f-hobbys", "f-musik", "g-fitness"] },
  { id: "welt", name: "Länder & Reisen", emoji: "🌍", cats: ["f-laender", "f-staedte", "f-sehenswert", "f-reise", "f-deutsch"] },
  { id: "wissen", name: "Wissen & Technik", emoji: "💡", cats: ["k-fahrzeuge", "f-weltraum", "f-geschichte", "f-technik", "f-mittelalter"] },
  { id: "fantasie", name: "Märchen & Feste", emoji: "🧚", cats: ["k-maerchen", "f-sagen", "f-feste"] },
  { id: "sprache", name: "Gefühle & Sprüche", emoji: "💭", cats: ["f-gefuehle", "f-redewendungen", "g-jugend"] },
  { id: "tun", name: "Tätigkeiten", emoji: "🤸", cats: ["k-tun", "f-pantomime"] },
  { id: "leute", name: "Party & Leute", emoji: "🥳", cats: ["g-party", "g-liebe", "g-internet", "g-peinlich", "g-nachtleben", "g-genres"], level: "freunde" },
  { id: "ab18", name: "Ab 18", emoji: "😈", cats: ["a-flirt", "a-schlafzimmer", "a-trinken", "a-jga", "a-alltag", "a-verrucht"], level: "ab18" },
];

const RANK: Record<Level, number> = { kinder: 0, familie: 1, freunde: 2, ab18: 3 };
/** Taugt die Kategorie zum Erklären? (keine Lieder, keine Geräusche) */
const explainable = (c: Category) => c.style !== "summen" && c.style !== "geraeusche";
const themed = new Set(THEMES.flatMap((t) => t.cats));

/** Ist das Thema bei dieser Stufe wählbar? */
export const themeShown = (t: Theme, o: Options) => !t.level || RANK[levelOf(o.level)] >= RANK[t.level];

/** Kategorien, aus denen gezogen wird: bis zur Stufe, nur eingeschaltete Themen (alle aus: alle Themen) */
export function activeCats(o: Options): Category[] {
  const cats = catsUpTo(levelOf(o.level)).filter(explainable);
  const on = THEMES.filter((t) => themeShown(t, o) && o[`th_${t.id}`] !== false);
  const ids = new Set(on.flatMap((t) => t.cats));
  const picked = cats.filter((c) => ids.has(c.id) || (!themed.has(c.id) && on.length > 0));
  return picked.length ? picked : cats;
}

export const ALL_EXPLAINABLE = CATEGORIES.filter(explainable);
