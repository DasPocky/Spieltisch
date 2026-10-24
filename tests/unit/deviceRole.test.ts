import { describe, expect, it } from "vitest";
import { deviceRole, roleSwitches } from "@/platform/deviceRole";

describe("Geräterolle", () => {
  it("bestimmt die Rolle an einer Stelle", () => {
    expect(deviceRole({ online: true })).toBe("phone");
    expect(deviceRole({ online: false })).toBe("shared");
    expect(deviceRole({ online: true, screen: true })).toBe("screen");
    expect(deviceRole({ online: true, companion: true, desk: true })).toBe("companion");
    expect(deviceRole({ online: true, desk: true, tv: true, isHost: true })).toBe("desk");
    expect(deviceRole({ online: true, tv: true, isHost: true })).toBe("remote");
    // Gast mit Fernseher bleibt Spiel-Handy – keine Fernbedienung
    expect(deviceRole({ online: true, tv: true, isHost: false })).toBe("phone");
  });

  it("bietet nur passende Wechsel an", () => {
    expect(roleSwitches({ online: true })).toEqual(["screen"]);
    expect(roleSwitches({ online: true, tv: true })).toEqual([]);
    expect(roleSwitches({ online: true, tv: true, isHost: true })).toEqual(["remote"]);
    expect(roleSwitches({ online: true, deskPossible: true })).toEqual(["desk", "screen"]);
    expect(roleSwitches({ online: true, desk: true, deskPossible: true })).toEqual(["classic", "pair", "screen"]);
    expect(roleSwitches({ online: true, desk: true, deskPossible: true, paired: true })).toEqual(["classic", "private", "screen"]);
    expect(roleSwitches({ online: false })).toEqual([]);
    expect(roleSwitches({ online: true, companion: true })).toEqual([]);
    expect(roleSwitches({ online: true, screen: true })).toEqual([]);
  });
});
