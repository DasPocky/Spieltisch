import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playBot } from "@shared/platform/botSkill";
import { addPlayer, applyRoomAction, createRoom, currentPlayerId, defaultOptions, roomGame, migrateRoomState, upgradeRoom, type RoomAction, type RoomState } from "@shared/platform/room";
import { withDefaults, type GameDefaults } from "@shared/platform/access";
import { GAME_IDS, isGameId, type GameId } from "@shared/games";
import { GameError } from "@shared/platform/types";
import { RoomScreen } from "@/platform/RoomScreen";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/useRoute";
import { siteConfigNow, useSiteConfig } from "@/hooks/useSiteConfig";
import { LOCAL_GAME_KEY, localKey, readLocal, readStr, writeJSON } from "@/lib/storage";
import { myName, reportLocal } from "@/lib/profile";
import { linkLocalPlayer, localLinks, reportGroupResult } from "@/lib/group";
import type { GroupPick } from "@/platform/PlayerManager";
import { AccessGate } from "@/platform/AccessGate";
import { kindOfGame } from "@shared/platform/cardsets";
import { cachedContent } from "@/lib/cardsets";
import { setsFor } from "@/platform/SetPicker";

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

/** Gespeicherten Spielstand fortsetzen – nach einem Update mit der alten Version zu Ende, umgerechnet oder sanft neu */
function load(gameId: string): RoomState {
  const saved = readLocal<RoomState>(gameId as GameId);
  if (saved?.gameId === gameId) {
    try { return upgradeRoom(migrateRoomState(saved)).room; } catch { /* unbrauchbar – neu anfangen */ }
  }
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
  const id = readStr(LOCAL_GAME_KEY);
  if (isGameId(id)) return id;
  return GAME_IDS[0];
}

/**
 * Offline-Modus unter /lokal: ein Gerät, alle Spieler – erst die Lobby, dann das Spiel.
 * Der Spielstand bleibt im Browser, getrennt pro Spiel; eine laufende Partie geht beim Wiederkommen weiter.
 */
export function LocalGame() {
  const [room, setRoom] = useState<RoomState>(() => load(localGameId()));

  useEffect(() => {
    writeJSON(localKey(room.gameId), room);
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

  // Testspieler: ist ein Bot dran, zieht er nach kurzer Pause von selbst (jeder kann auch für ihn tippen)
  const botTurn = room.bots?.length && room.phase === "playing" ? currentPlayerId(room) : null;
  useEffect(() => {
    if (!botTurn || !room.bots?.includes(botTurn)) return;
    const t = setTimeout(() => run((s) => playBot(s, botTurn, false)?.next ?? s), 900 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [room, botTurn, run]);

  // „Ein Handy für alle“ ist standardmäßig aus – nur wenn der Admin es eingeschaltet hat (Online-Räume abgeschaltet: lokal als Rückfall)
  if (config && config.features?.local !== true && config.features?.online !== false) {
    return (
      <main className="mx-auto grid min-h-dvh-safe max-w-md content-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Gespielt wird online</h1>
        <p className="text-muted-foreground">„Ein Handy für alle“ ist gerade abgeschaltet. Erstellt einen Online-Raum – jeder spielt am eigenen Handy.</p>
        <Button size="lg" onClick={() => navigate("/")}>Zur Startseite</Button>
      </main>
    );
  }

  return (
    <AccessGate gameId={room.gameId}>
    <RoomScreen
      room={room}
      me={null}
      online={null}
      dispatch={(a: RoomAction) => run((s) => {
        // Start mit eigenen Kartensets: Inhalte aus dem Gerätespeicher (beim Wählen gemerkt) – nur für den Start
        const kind = (a.type === "start" || a.type === "restart") && s.sets?.length ? kindOfGame(s.gameId) : null;
        const wanted = kind ? setsFor(s, kind).map((x) => x.id) : [];
        const withContent = kind ? { ...s, content: cachedContent(wanted, kind) } : s;
        const missing = wanted.length - (withContent.content?.sets.length ?? 0);
        if (missing > 0) queueMicrotask(() => toast(missing === 1 ? "Ein gewähltes Kartenset ist nicht auf diesem Gerät – wählt es in den Einstellungen neu." : `${missing} gewählte Kartensets sind nicht auf diesem Gerät – wählt sie in den Einstellungen neu.`));
        const next = applyRoomAction(withContent, a, null);
        delete next.content;
        // Anderes Spiel gewählt: Standard-Einstellungen übernehmen
        return next.gameId !== s.gameId ? applyDefaults(next, siteConfigNow()?.defaults) : next;
      })}
      onAddLocal={(name, from?: GroupPick, bot?: boolean) => {
        const id = crypto.randomUUID();
        if (from) linkLocalPlayer(id, from.code, from.member);
        run((s) => {
          const next = addPlayer(s, { id, name });
          // Bots im Entwickler-Modus spielen „mittel“ (bewertete Spiele), sonst zufällig
          if (bot) { next.bots = [...(next.bots ?? []), id]; next.botLevels = { ...next.botLevels, [id]: "mittel" }; }
          return from ? { ...next, avatars: { ...next.avatars, [id]: from.avatar }, members: { ...next.members, [id]: from.member } } : next;
        });
      }}
      onLeave={() => navigate("/")}
    />
    </AccessGate>
  );
}
