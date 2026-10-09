import { describe, expect, it } from "vitest";
import type { WerwolfState } from "@shared/games/werwolf/logic";
import { onlineSay } from "../../src/games/werwolf/narration";

const players = ["Anna", "Ben", "Cem", "Dora", "Emil"].map((name, i) => ({ id: `p${i + 1}`, name }));
const base = {
  phase: "night", night: 1, seq: true, awake: "seherin", revealDead: true, runoff: null, captain: null, hunters: [], news: null,
  roles: { p1: "werwolf", p2: "seherin", p3: "hexe", p4: "dorf", p5: "jaeger" },
  alive: { p1: true, p2: true, p3: true, p4: true, p5: true },
} as unknown as WerwolfState;
const opts = { tempo: "normal" };
const say = (a: Partial<WerwolfState>, b: Partial<WerwolfState>) => onlineSay({ ...base, ...a } as WerwolfState, { ...base, ...b } as WerwolfState, players, opts).join(" ");

describe("Erzähler online (Host-Handy)", () => {
  it("Nacht beginnt: alle schließen die Augen, erste Rolle erwacht", () => {
    const t = say({ phase: "reveal", night: 0, awake: undefined }, {});
    expect(t).toMatch(/Alle schließen die Augen/);
    expect(t).toMatch(/Die Seherin erwacht/);
  });

  it("nacheinander: Rolle schläft ein, nächste erwacht", () => {
    const t = say({}, { awake: "werwolf" });
    expect(t).toMatch(/Die Seherin schläft wieder ein\. Die Werwölfe erwachen/);
  });

  it("Morgen: Tote mit Rolle und Zeit für die Diskussion", () => {
    const t = say({ awake: "hexe" }, { phase: "day", awake: undefined, alive: { ...base.alive, p4: false }, news: { kind: "night", deaths: [{ id: "p4", cause: "wolf" }] } });
    expect(t).toMatch(/Es wird Tag/);
    expect(t).toMatch(/Dora ist tot und war Dorfbewohner/);
    expect(t).toMatch(/Minuten/);
  });

  it("Urteil des Dorfes und Jäger", () => {
    const day = { phase: "day", awake: undefined } as Partial<WerwolfState>;
    const t = say(day, { phase: "hunter", alive: { ...base.alive, p5: false }, hunters: ["p5"], news: { kind: "day", deaths: [{ id: "p5", cause: "dorf" }] } });
    expect(t).toMatch(/Das Dorf hat entschieden\. Emil ist tot und war Jäger/);
    expect(t).toMatch(/Emil war der Jäger/);
    expect(say(day, { phase: "night", night: 2, news: { kind: "day", deaths: [] } })).toMatch(/niemanden verurteilt/);
  });

  it("verrät keine Rollen, wenn Tote nicht aufgedeckt werden", () => {
    const t = say({ awake: "hexe", revealDead: false }, { phase: "day", revealDead: false, awake: undefined, alive: { ...base.alive, p2: false }, news: { kind: "night", deaths: [{ id: "p2", cause: "wolf" }] } });
    expect(t).toMatch(/Ben ist tot\./);
    expect(t).not.toMatch(/Seherin/);
  });
});
