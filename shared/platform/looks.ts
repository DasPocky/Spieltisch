/** Aussehen der ganzen Seite – der Admin wählt eins für alle, Hell/Dunkel stellt jeder selbst ein */
export const LOOKS = [
  { id: "papier", name: "Papierschnitt", desc: "Papierlagen, Petrol und Koralle", page: "#f3efe7", card: "#fffdf8", primary: "#ff7a59", ink: "#23343a", font: "Quicksand" },
  { id: "casino", name: "Casino", desc: "Weinrot, Gold, edle Schrift", page: "#2a080e", card: "#350b14", primary: "#e0b04a", ink: "#f2c96b", font: "Playfair Display" },
  { id: "comic", name: "Comic", desc: "Rasterpunkte, dicke Linien", page: "#fff7e0", card: "#ffffff", primary: "#e8322b", ink: "#111111", font: "Bangers" },
  { id: "aurora", name: "Aurora-Glas", desc: "Bunter Verlauf, Milchglas", page: "#6a5cff", card: "#9d94ff", primary: "#ffffff", ink: "#ffffff", font: "Sora" },
  { id: "notizblock", name: "Notizblock", desc: "Papier, Filzstift, dicke Konturen", page: "#fffdf6", card: "#ffffff", primary: "#ff6b5b", ink: "#22252b", font: "Baloo 2" },
  { id: "holz", name: "Holz & Filz", desc: "Spieltisch-Filz, Creme, Messing", page: "#1d4a36", card: "#f6efe2", primary: "#d9a957", ink: "#2b2016", font: "Fraunces" },
  { id: "nacht", name: "Neon-Nacht", desc: "Lila und Cyan, leuchtend", page: "#0c0d1c", card: "#14162a", primary: "#8b5cf6", ink: "#7ee8ff", font: "Space Grotesk" },
  { id: "klar", name: "Klar & ruhig", desc: "Minimal, viel Luft, Koralle", page: "#f5f5f7", card: "#ffffff", primary: "#ff5a3c", ink: "#111114", font: "Inter" },
  { id: "spielbox", name: "Retro-Spielbox", desc: "Knallgelb, kantig, 80er", page: "#ffd23f", card: "#ffffff", primary: "#12a862", ink: "#111111", font: "Archivo Black" },
  { id: "kreide", name: "Kreidetafel", desc: "Tafel und Kreide, Whiteboard im Hellen", page: "#2a332e", card: "#2d3630", primary: "#ffd58a", ink: "#f2f0e6", font: "Caveat" },
  { id: "bonbon", name: "Bonbon", desc: "Pastell, rund, verspielt", page: "#efe4ff", card: "#ffffff", primary: "#b07cf7", ink: "#3d2c5a", font: "Fredoka" },
  { id: "arcade", name: "Arcade", desc: "Pixel und Spielhalle", page: "#0b0b1e", card: "#16163a", primary: "#ff3d7f", ink: "#ffe14d", font: "Press Start 2P" },
  { id: "siebziger", name: "70er", desc: "Orange, Senf, Oliv", page: "#f4e4c1", card: "#fbf3e0", primary: "#c4472a", ink: "#3b2314", font: "Righteous" },
  { id: "marine", name: "Marine (bisher)", desc: "Navy und Eisblau", page: "#0a1730", card: "#16305e", primary: "#3f7ae0", ink: "#cfe0fa", font: "Plus Jakarta Sans" },
] as const;

/** page/card/primary/ink/font: nur für die Vorschau im Admin */
export type LookId = (typeof LOOKS)[number]["id"];
export const DEFAULT_LOOK: LookId = "papier";
export const isLook = (x: unknown): x is LookId => LOOKS.some((l) => l.id === x);
