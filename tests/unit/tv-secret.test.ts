/**
 * Geheimhaltung am Großen Tisch: Der Fernseher sieht nie mehr als jemand, der nicht mitspielt – keine Hand, keine Rolle,
 * kein Begriff an der Stirn. Gegenprobe: was nur ein Spieler sieht (seine Hand, seine Rolle), sieht auch kein Außenstehender.
 * Zufalls-Bots spielen dazu ganze Partien aller Spiele mit Tisch-Ansicht, online und mit einem Handy für alle.
 */
import { describe, expect, it } from "vitest";
import { candidates, shuffleInPlace } from "@shared/platform/bots";
import { applyRoomAction, roomGame, viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { GameError } from "@shared/platform/types";
import { act, roomWith } from "./helpers";

/** alle Texte im Spielstand (Karten, Rollen, Wörter …) */
function texts(x: unknown, out = new Set<string>()): Set<string> {
  if (typeof x === "string") out.add(x);
  else if (x && typeof x === "object") for (const v of Object.values(x)) texts(v, out);
  return out;
}

const OUTSIDER = "niemand-am-tisch";
const GAMES: [string, number][] = [
  ["stapelbau", 3], ["himmelskarten", 3], ["zehnphasen", 3], ["glueckssieben", 3], ["decknamen", 4], ["alles", 3], ["maexchen", 4],
  ["dame", 2], ["muehle", 2], ["ludo", 4], ["fischen", 4], ["hellseher", 4], ["werwolf", 7], ["einenacht", 5], ["spion", 5], ["stirnraten", 4], ["zeichnen", 4], ["quiz", 3], ["kritzelpost", 4], ["schamlos", 4], ["maumau", 3], ["eins", 3], ["herzen", 4], ["schocken", 4], ["bluff", 4], ["stadtlandfluss", 4], ["erklaerspiel", 5], ["werbinich", 4], ["ankreuzspiel", 4], ["klingel", 4],
];

function check(r: RoomState) {
  const tv = texts(viewRoom(r, WATCH_ID).game);
  const out = texts(viewRoom(r, OUTSIDER).game);
  const more = [...tv].filter((t) => !out.has(t));
  expect(more, `${r.gameId}: Fernseher sieht mehr als ein Außenstehender`).toEqual([]);
  // Gegenprobe: nur ein einziger Spieler kennt es → privat → Außenstehende sehen es nicht
  const views = r.players.map((p) => texts(viewRoom(r, p.id).game));
  views.forEach((mine, i) => {
    const others = views.filter((_, j) => j !== i);
    const own = [...mine].filter((t) => others.every((o) => !o.has(t)));
    const leaked = own.filter((t) => out.has(t));
    expect(leaked, `${r.gameId}: Privates von ${r.players[i].name} ist für Außenstehende sichtbar`).toEqual([]);
  });
}

function play(gameId: string, n: number, online: boolean) {
  let r = roomWith(Array.from({ length: n }, (_, i) => `Spieler${i + 1}`), gameId);
  if (online && gameId !== "werwolf") r = act(r, { type: "setEntry", mode: "turn" });
  r = act(r, { type: "start" }, online ? "p1" : null);
  for (let step = 0; step < 3000 && r.phase === "playing" && !roomGame(r).isOver(r.game); step++) {
    // jeder fünfte Zug reicht – die Partien kommen trotzdem durch alle Phasen
    if (step % 5 === 0) check(r);
    let moved = false;
    for (const m of shuffleInPlace(candidates(r, online))) {
      try { r = applyRoomAction(r, m.action, m.actor); moved = true; break; } catch (e) { if (!(e instanceof GameError)) throw e; }
    }
    if (!moved) break;
  }
}

describe("Großer Tisch: der Fernseher sieht nichts Privates", () => {
  for (const [gameId, n] of GAMES) {
    it(`${gameId}: online und mit einem Handy für alle`, () => {
      for (let i = 0; i < 2; i++) { play(gameId, n, true); play(gameId, n, false); }
    }, 120_000);
  }
});
