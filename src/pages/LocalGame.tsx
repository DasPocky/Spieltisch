import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addPlayer, applyRoomAction, createRoom, defaultOptions, roomGame, type RoomAction, type RoomState } from "@shared/platform/room";
import { withDefaults, type GameDefaults } from "@shared/platform/access";
import { GAME_IDS, getGame, isGameId } from "@shared/games";
import { GameError } from "@shared/platform/types";
import { RoomScreen } from "@/platform/RoomScreen";
import { navigate } from "@/hooks/useRoute";
import { siteConfigNow, useSiteConfig } from "@/hooks/useSiteConfig";
import { LOCAL_GAME_KEY, localKey, readJSON, writeJSON } from "@/lib/storage";
import { myName, reportLocal } from "@/lib/profile";
import { linkLocalPlayer, localLinks, reportGroupResult } from "@/lib/group";
import type { GroupPick } from "@/platform/PlayerManager";
import { AccessGate } from "@/platform/AccessGate";

const isOver = (r: RoomState) => r.phase === "playing" && !!r.game && roomGame(r).isOver(r.game);

/**
 * Lokale Partie zu Ende: Das Ergebnis des Spielers, der so heißt wie das eigene Profil, kommt in die Statistik.
 * Nur beim Übergang zu „vorbei“ – nicht beim Neuladen einer schon beendeten Partie.
 */
function useLocalStats(room: RoomState) {
  const was = useRef(isOver(room));
  useEffect(() => {
    const over = isOver(room);
    if (over && !was.current) {
      const logic = roomGame(room);
      const name = myName().trim().toLowerCase();
      const me = name ? room.players.find((p) => p.name.trim().toLowerCase() === name) : undefined;
      const results = logic.results?.(room.game, { players: room.players, hostId: room.hostId, actorId: null, options: room.options, now: Date.now() });
      const mine = me && results?.find((r) => r.id === me.id);
      if (mine) void reportLocal({ gameId: room.gameId, won: mine.won, score: mine.score, players: results!.length });
      // Spieler aus einer Gruppe: Ergebnis an deren Bestenliste
      const links = localLinks();
      const byGroup: Record<string, { id: string; won: boolean }[]> = {};
      for (const r of results ?? []) {
        const link = links[r.id];
        if (link && room.members?.[r.id] === link.member) (byGroup[link.code] ??= []).push({ id: link.member, won: r.won });
      }
      for (const [code, players] of Object.entries(byGroup)) void reportGroupResult(code, room.gameId, players);
    }
    was.current = over;
  }, [room]);
}

/** Standard-Einstellungen des Admins über die eingebauten legen */
const applyDefaults = (r: RoomState, defaults: GameDefaults | undefined): RoomState =>
  ({ ...r, options: withDefaults(roomGame(r).settings, r.options, defaults?.[r.gameId]) });

/** Ist ein gespeicherter Spielstand noch mit dem aktuellen Code verträglich? */
function load(gameId: string): RoomState {
  const saved = readJSON<RoomState & { gameVersion?: number }>(localKey(gameId));
  if (saved?.v === 1 && saved.gameId === gameId && saved.gameVersion === getGame(gameId).version) return saved;
  return applyDefaults(createRoom(gameId), siteConfigNow()?.defaults);
}

/** Noch unberührt: Lobby, nie gestartet, Einstellungen wie eingebaut */
const untouched = (r: RoomState) => r.phase === "lobby" && r.round === 0
  && JSON.stringify(r.options) === JSON.stringify(defaultOptions(roomGame(r).settings));

/** Lokale Partie gestartet: anonym mitzählen (nur Spiel-ID, Fehler egal) */
function useStartStats(room: RoomState) {
  const last = useRef({ gameId: room.gameId, round: room.round });
  useEffect(() => {
    const prev = last.current;
    if (room.gameId === prev.gameId && room.round > prev.round && room.phase === "playing") {
      void fetch("/api/stats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game: room.gameId }), keepalive: true }).catch(() => null);
    }
    last.current = { gameId: room.gameId, round: room.round };
  }, [room.gameId, room.round, room.phase]);
}

/** Zuletzt lokal gewähltes Spiel (Startseite bzw. alte Spiel-Links merken es vor) */
function localGameId(): string {
  try { const id = localStorage.getItem(LOCAL_GAME_KEY); if (isGameId(id)) return id; } catch { /* egal */ }
  return GAME_IDS[0];
}

/**
 * Offline-Modus unter /lokal: ein Gerät, alle Spieler – erst die Lobby, dann das Spiel.
 * Der Spielstand bleibt im Browser, getrennt pro Spiel; eine laufende Partie geht beim Wiederkommen weiter.
 */
export function LocalGame() {
  const [room, setRoom] = useState<RoomState>(() => load(localGameId()));

  useEffect(() => {
    writeJSON(localKey(room.gameId), { ...room, gameVersion: getGame(room.gameId).version });
    try { localStorage.setItem(LOCAL_GAME_KEY, room.gameId); } catch { /* egal */ }
  }, [room]);
  useLocalStats(room);
  useStartStats(room);

  // Standards vom Server kamen erst nach dem Anlegen: noch unberührten Raum nachziehen
  const config = useSiteConfig();
  useEffect(() => {
    if (config?.defaults[room.gameId]) setRoom((r) => (untouched(r) ? applyDefaults(r, config.defaults) : r));
  }, [config, room.gameId]);

  const run = useCallback((fn: (s: RoomState) => RoomState) => {
    setRoom((s) => {
      try { return fn(s); } catch (e) {
        const msg = e instanceof GameError ? e.message : "Das ging gerade nicht.";
        if (!(e instanceof GameError)) console.error(e);
        queueMicrotask(() => toast(msg));
        return s;
      }
    });
  }, []);

  return (
    <AccessGate gameId={room.gameId}>
    <RoomScreen
      room={room}
      me={null}
      online={null}
      dispatch={(a: RoomAction) => run((s) => {
        const next = applyRoomAction(s, a, null);
        // Anderes Spiel gewählt: Standard-Einstellungen übernehmen
        return next.gameId !== s.gameId ? applyDefaults(next, siteConfigNow()?.defaults) : next;
      })}
      onAddLocal={(name, from?: GroupPick) => {
        const id = crypto.randomUUID();
        if (from) linkLocalPlayer(id, from.code, from.member);
        run((s) => {
          const next = addPlayer(s, { id, name });
          return from ? { ...next, avatars: { ...next.avatars, [id]: from.avatar }, members: { ...next.members, [id]: from.member } } : next;
        });
      }}
      onLeave={() => navigate("/")}
    />
    </AccessGate>
  );
}
