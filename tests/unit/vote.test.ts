import { afterEach, describe, expect, it, vi } from "vitest";
import { planStatus, startVoted, tallyVote, VOTE_SECONDS, voteWinner, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

/** Glückssieben mit Punkteblock schnell zu Ende spielen */
function playGlueckssieben(r: RoomState): RoomState {
  for (const [key, value] of Object.entries({ mode: "table", target: 100 })) r = act(r, { type: "setOption", key, value });
  r = act(r, { type: "start" });
  for (const [id, p] of [["p1", 120], ["p2", 0], ["p3", 0]] as const) r = game(r, { type: "padEnter", player: id, points: p });
  return game(r, { type: "padFinish" });
}

afterEach(() => vi.useRealTimers());

describe("Abstimmen über das nächste Spiel", () => {
  it("Host startet, alle stimmen ab, bei voller Beteiligung ist sofort entschieden und der Gewinner startet", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    expect(() => act(r, { type: "startVote", games: ["maumau", "eins"] }, "p2")).toThrow(/Host/);
    expect(() => act(r, { type: "startVote", games: ["maumau"] })).toThrow(/2 bis 4/);
    expect(() => act(r, { type: "startVote", games: ["maumau", "maumau"] })).toThrow(/verschiedene/);
    expect(() => act(r, { type: "startVote", games: ["maumau", "gibtsnicht"] })).toThrow();
    r = act(r, { type: "startVote", games: ["maumau", "eins", "alles"] });
    expect(r.vote?.endsAt).toBeGreaterThan(Date.now() + (VOTE_SECONDS - 2) * 1000);
    expect(() => act(r, { type: "vote", gameId: "dame" }, "p2")).toThrow(/Wahl/);
    expect(() => act(r, { type: "vote", gameId: "eins" }, "fremd")).toThrow(/Raum/);
    r = act(r, { type: "vote", gameId: "eins" }, "p1");
    r = act(r, { type: "vote", gameId: "maumau" }, "p2");
    // Umentscheiden geht
    r = act(r, { type: "vote", gameId: "eins" }, "p2");
    expect(tallyVote(r)).toEqual({ maumau: 0, eins: 2, alles: 0 });
    expect(r.vote?.winner).toBeUndefined();
    r = act(r, { type: "vote", gameId: "alles" }, "p3");
    expect(r.vote?.winner).toBe("eins");
    expect(r.gameId).toBe("eins");
    r = startVoted(r);
    expect(r.vote).toBeUndefined();
    expect(r.phase).toBe("playing");
    expect(r.gameId).toBe("eins");
  });

  it("Bots blockieren nicht, Gleichstand entscheidet der Zufall", () => {
    let r = roomWith(["Anna", "Ben", "Bot"]);
    r = { ...r, bots: ["p3"] };
    r = act(r, { type: "startVote", games: ["maumau", "eins"] });
    r = act(r, { type: "vote", gameId: "maumau" }, "p1");
    expect(voteWinner({ ...r, vote: { ...r.vote!, votes: { p1: "maumau", p2: "eins" } } }, () => 0)).toBe("maumau");
    expect(voteWinner({ ...r, vote: { ...r.vote!, votes: { p1: "maumau", p2: "eins" } } }, () => 0.99)).toBe("eins");
    r = act(r, { type: "vote", gameId: "eins" }, "p2");
    expect(["maumau", "eins"]).toContain(r.vote?.winner);
  });

  it("Ausweg: Mitspieler erst nach Ablauf der Zeit, Host jederzeit auswerten, selbst wählen oder abbrechen", () => {
    vi.useFakeTimers();
    let r = roomWith(["Anna", "Ben", "Cem"]);
    r = act(r, { type: "startVote", games: ["maumau", "eins"] });
    r = act(r, { type: "vote", gameId: "eins" }, "p2");
    expect(() => act(r, { type: "endVote" }, "p2")).toThrow(/läuft noch/);
    expect(() => act(r, { type: "endVote", gameId: "maumau" }, "p2")).toThrow(/Host/);
    expect(() => act(r, { type: "endVote", cancel: true }, "p2")).toThrow(/Host/);
    // Abbrechen: nichts gewählt
    expect(act(r, { type: "endVote", cancel: true }).vote).toBeUndefined();
    // Selbst wählen, auch gegen die Stimmen
    expect(act(r, { type: "endVote", gameId: "maumau" }).vote?.winner).toBe("maumau");
    // Host wertet jetzt aus
    expect(act(r, { type: "endVote" }).vote?.winner).toBe("eins");
    // Zeit um: jeder darf auswerten (offline Spieler halten nichts auf)
    vi.advanceTimersByTime(VOTE_SECONDS * 1000);
    r = act(r, { type: "endVote" }, "p3");
    expect(r.vote?.winner).toBe("eins");
    expect(() => act(r, { type: "vote", gameId: "eins" }, "p1")).toThrow(/nicht abgestimmt/);
  });

  it("Passt die Spielerzahl nicht, bleibt der Gewinner in der Lobby gewählt", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    r = act(r, { type: "startVote", games: ["dame", "eins"] });
    r = startVoted(act(r, { type: "endVote", gameId: "dame" }));
    expect(r.phase).toBe("lobby");
    expect(r.gameId).toBe("dame");
    expect(r.vote).toBeUndefined();
  });

  it("Nach einer Partie im Partyabend: Gewinner rückt im Plan nach vorn, Abstimmen mitten in der Partie geht nicht", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    r = act(r, { type: "setPlan", games: ["glueckssieben", "maumau", "eins"] });
    r = act(act(r, { type: "setOption", key: "mode", value: "table" }), { type: "start" });
    expect(() => act(r, { type: "startVote", games: ["maumau", "eins"] })).toThrow(/nach der Partie/);
    r = act(r, { type: "toLobby" });
    r = act(r, { type: "selectGame", gameId: "glueckssieben" });
    r = playGlueckssieben(r);
    expect(planStatus(r.evening)?.next).toBe("maumau");
    r = act(r, { type: "startVote", games: ["maumau", "eins"] });
    r = act(r, { type: "endVote", gameId: "eins" });
    expect(r.phase).toBe("lobby");
    expect(r.evening?.plan?.games).toEqual(["glueckssieben", "eins", "maumau"]);
    expect(planStatus(r.evening)?.next).toBe("eins");
    r = startVoted(r);
    expect(r.phase).toBe("playing");
    expect(r.gameId).toBe("eins");
  });

  it("Kurze Runden: Spiele mit Paket „Kurz“ bekommen es, andere bleiben beim Standard", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    r = act(r, { type: "setPlan", games: ["alles", "maumau"], short: true });
    expect(r.evening?.plan?.short).toBe(true);
    expect(r.options.target).toBe(3000);
    r = act(act(r, { type: "start" }), { type: "toLobby" });
    expect(r.gameId).toBe("alles");
    // Abstimmung im Plan: Gewinner mit Paket „Kurz“
    r = startVoted(act(act(r, { type: "startVote", games: ["eins", "maumau"] }), { type: "endVote", gameId: "eins" }));
    expect(r.options.target).toBe("round");
    // Ohne kurze Runden: Standard
    let s = roomWith(["Anna", "Ben"]);
    s = act(s, { type: "setPlan", games: ["alles", "maumau"] });
    expect(s.options.target).not.toBe(3000);
  });
});
