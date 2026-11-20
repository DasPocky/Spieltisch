/** Aussehen der ganzen Seite: einheitlich der EndLab-Look, Hell/Dunkel stellt jeder selbst ein */
export const LOOKS = [
  { id: "endlab", name: "EndLab", desc: "Marineblau und Eisblau", page: "#eef4f9", card: "#ffffff", primary: "#1d7fa0", ink: "#0e2240", font: "Sora" },
] as const;

/** page/card/primary/ink/font: nur für die Anzeige im Admin */
export type LookId = (typeof LOOKS)[number]["id"];
export const DEFAULT_LOOK: LookId = "endlab";
/** Früher gewählte Looks (Papierschnitt, Casino …) gelten nicht mehr – sie werden zu EndLab */
export const isLook = (x: unknown): x is LookId => LOOKS.some((l) => l.id === x);
