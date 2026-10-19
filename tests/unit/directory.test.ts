import { describe, expect, it } from "vitest";
import { DEFAULT_ACCESS, KNOCK_DELEGATE_MS, lifeMs, mayAdmit, sanitizeAccess, sanitizeCard } from "@shared/platform/directory";
import { addPlayer, applyRoomAction, createRoom } from "@shared/platform/room";

const H = 3_600_000;

describe("Raumverzeichnis", () => {
  it("Zugang: Standard ist öffentlich mit PIN, eine Stunde", () => {
    expect(sanitizeAccess(undefined)).toEqual({ visibility: "all", admission: "pin", life: "hour" });
    expect(sanitizeAccess({ visibility: "group", admission: "knock", life: "week", name: "  Donnerstags   runde " }))
      .toEqual({ name: "Donnerstags runde", visibility: "group", admission: "knock", life: "week" });
  });

  it("Zugang: Unsinn fällt auf den bisherigen Wert zurück, Name wird gekürzt", () => {
    const base = { ...DEFAULT_ACCESS, visibility: "none" as const };
    expect(sanitizeAccess({ visibility: "geheim", admission: 3, life: "ewig" }, base)).toEqual(base);
    expect(sanitizeAccess({ name: "x".repeat(60) }).name).toHaveLength(24);
    expect(sanitizeAccess({ name: "   " }, { ...DEFAULT_ACCESS, name: "Alt" }).name).toBeUndefined();
  });

  it("Dauerraum: nur der Admin legt ihn an, der Host kann ihn nicht ändern", () => {
    expect(sanitizeAccess({ life: "forever" }).life).toBe("hour");
    const perm = sanitizeAccess({ life: "forever" }, DEFAULT_ACCESS, true);
    expect(perm.life).toBe("forever");
    expect(sanitizeAccess({ life: "hour" }, perm).life).toBe("forever");
  });

  it("Lebensdauer: Wahl des Hosts, gedeckelt vom Admin; Dauerraum ohne Ende; alte Räume nach der Obergrenze", () => {
    expect(lifeMs({ ...DEFAULT_ACCESS, life: "day" }, 168)).toBe(24 * H);
    expect(lifeMs({ ...DEFAULT_ACCESS, life: "week" }, 48)).toBe(48 * H);
    expect(lifeMs({ ...DEFAULT_ACCESS, life: "forever" }, 48)).toBeNull();
    expect(lifeMs(undefined, 48)).toBe(48 * H);
  });

  it("Anklopfen: Host immer, die anderen erst, wenn der Host weg ist oder 30 s nicht reagiert – außer bei „Moment“", () => {
    expect(mayAdmit({ ago: 0 }, true, true)).toBe(true);
    expect(mayAdmit({ ago: 1000 }, false, true)).toBe(false);
    expect(mayAdmit({ ago: KNOCK_DELEGATE_MS }, false, true)).toBe(true);
    expect(mayAdmit({ ago: KNOCK_DELEGATE_MS * 3, snoozed: true }, false, true)).toBe(false);
    expect(mayAdmit({ ago: 0 }, false, false)).toBe(true);
  });

  it("Raumkarte vom Server wird geprüft", () => {
    expect(sanitizeCard(null)).toBeNull();
    const c = sanitizeCard({ code: "ABCDE", gameId: "eins", players: [{ name: "Anna", online: true, avatar: { color: 1, emoji: 2 } }], online: 1, visibility: "x", admission: "knock" });
    expect(c).toMatchObject({ code: "ABCDE", phase: "lobby", visibility: "all", admission: "knock", players: [{ name: "Anna", online: true }] });
  });

  it("Host stellt den Zugang im Raum um, andere dürfen das nicht", () => {
    let r = createRoom("eins");
    r = addPlayer(r, { id: "a", name: "Anna" });
    r = addPlayer(r, { id: "b", name: "Ben" });
    r = applyRoomAction(r, { type: "setAccess", access: { visibility: "none", admission: "knock", name: "Geheim" } }, "a");
    expect(r.access).toMatchObject({ visibility: "none", admission: "knock", name: "Geheim", life: "hour" });
    expect(() => applyRoomAction(r, { type: "setAccess", access: { visibility: "all" } }, "b")).toThrow("Host");
  });
});
