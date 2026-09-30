import { useState } from "react";
import { Eye, KeyRound, Shuffle } from "lucide-react";
import { notReady, other, remaining, TEAM_NAME, type CNAction, type CNState, type Color, type Team } from "@shared/games/codenames/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";
import { MUTED } from "@/lib/palette";

/** Farben der Karten: Teams kräftig, Passanten beige, Attentäter schwarz */
export const COLOR: Record<Color, string> = { rot: MUTED.red, blau: MUTED.blue, neutral: MUTED.sand, attentaeter: MUTED.ink };
const TEXT_ON: Record<Color, string> = { rot: "#fff", blau: "#fff", neutral: "#2a2418", attentaeter: "#fff" };
const TEAMS: Team[] = ["rot", "blau"];

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "?";

export function Board(props: BoardProps<CNState, CNAction>) {
  const { game: s } = props;
  if (s.phase === "teams") return <Teams {...props} />;
  if (s.phase === "over") return <Over {...props} />;
  return s.mode === "key" ? <KeyCard {...props} /> : <Play {...props} />;
}

/** Punkte oben: wie viele Karten jedem Team noch fehlen, wer dran ist */
function Score({ s, showTurn }: { s: CNState; showTurn: boolean }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-1.5 pt-1">
      {TEAMS.map((t) => (
        <div key={t} className={cn("flex items-center justify-between rounded-xl px-3 py-1.5 text-white", showTurn && s.turn === t ? "ring-2 ring-white/80" : "opacity-80")}
          style={{ background: COLOR[t] }} data-testid={`score-${t}`}>
          <span className="truncate font-bold">{showTurn && s.turn === t ? "▶ " : ""}{TEAM_NAME[t]}</span>
          <span className="text-lg font-extrabold tabular-nums">{remaining(s, t)}</span>
        </div>
      ))}
    </div>
  );
}

/** Teams einteilen: online jeder selbst, lokal (und als Host) für alle */
function Teams({ room, game: s, me, isHost, act }: BoardProps<CNState, CNAction>) {
  const players = room.players;
  const local = me === null;
  const mine = me ? s.members[me] : undefined;
  const missing = notReady(s);
  const set = (player: string, team: Team | null, chief: boolean) => act({ type: "join", player, team, chief });

  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-1 pt-1">
        <h2 className="text-xl font-extrabold tracking-tight">Teams einteilen</h2>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">
        Jedes Team braucht einen <b className="text-foreground">Chef</b> (sieht die Schlüsselkarte){s.mode === "app" ? " und mindestens einen Agenten, der rät" : ""}.
      </p>
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {players.map((p) => {
          const m = s.members[p.id] ?? { team: null, chief: false };
          const editable = local || isHost || p.id === me;
          return (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5" data-testid={`member-${p.name}`}>
              <span className="min-w-0 flex-1 truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}{m.chief && <KeyRound className="ml-1 inline size-4 align-[-2px] text-ice" aria-label="Chef" />}</span>
              {TEAMS.map((t) => (
                <button key={t} type="button" disabled={!editable} onClick={() => set(p.id, m.team === t ? null : t, m.team === t ? false : m.chief)}
                  aria-pressed={m.team === t} aria-label={`${p.name}: Team ${TEAM_NAME[t]}`}
                  className={cn("rounded-lg px-2.5 py-1.5 text-sm font-bold ring-1 ring-inset disabled:cursor-default", m.team === t ? "text-white ring-transparent" : "text-muted-foreground ring-border")}
                  style={m.team === t ? { background: COLOR[t] } : undefined}>{TEAM_NAME[t]}</button>
              ))}
              <button type="button" disabled={!editable || !m.team} onClick={() => set(p.id, m.team, !m.chief)} aria-pressed={m.chief} aria-label={`${p.name}: Chef`}
                className={cn("rounded-lg px-2 py-1.5 text-sm font-bold ring-1 ring-inset disabled:opacity-40", m.chief ? "bg-ice text-navy-950 ring-transparent" : "text-muted-foreground ring-border")}>Chef</button>
            </div>
          );
        })}
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {!local && !mine?.team && <p className="text-center text-sm font-semibold text-ice">Wähle oben dein Team.</p>}
        {missing && <p className="text-center text-sm text-muted-foreground" data-testid="not-ready">{missing}</p>}
        {(local || isHost) ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button size="lg" variant="secondary" onClick={() => act({ type: "shuffleTeams" })} aria-label="Zufällig verteilen"><Shuffle /></Button>
            <Button size="lg" disabled={!!missing} onClick={() => act({ type: "begin" })}>Los geht's</Button>
          </div>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">Der Host startet, sobald alle eingeteilt sind.</p>}
      </div>
    </>
  );
}

/** Eine Wortkarte im 5×5-Raster */
function WordCard({ word, color, revealed, hint, onClick, disabled }: { word: string; color: Color; revealed: boolean; hint: boolean; onClick?: () => void; disabled: boolean }) {
  const shown = revealed || hint;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={`${word}${revealed ? ` (${color === "neutral" ? "Passant" : color === "attentaeter" ? "Attentäter" : TEAM_NAME[color]})` : ""}`}
      className={cn("relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg px-0.5 text-center font-bold leading-tight shadow outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
        "text-[clamp(0.55rem,2.9vw,0.95rem)] [hyphens:auto]", !revealed && "bg-paper text-paper-ink", revealed && "opacity-90", !disabled && !revealed && "active:scale-95")}
      style={revealed ? { background: COLOR[color], color: TEXT_ON[color] } : hint && shown ? { boxShadow: `inset 0 0 0 3px ${COLOR[color]}`, background: color === "attentaeter" ? "#3a3a40" : undefined, color: color === "attentaeter" ? "#fff" : undefined } : undefined}
      lang="de">
      <span className={cn("break-words", revealed && "line-through decoration-2 opacity-80")}>{word}</span>
    </button>
  );
}

/** Die Partie in der App: Raster, Hinweis des Chefs, Agenten tippen */
function Play({ room, game: s, me, act }: BoardProps<CNState, CNAction>) {
  const local = me === null;
  const m = me ? s.members[me] : undefined;
  const [peek, setPeek] = useState(false);
  const [word, setWord] = useState("");
  const [count, setCount] = useState(1);
  const chiefView = local ? peek : !!s.seesKey;
  const myTurnChief = local || (m?.team === s.turn && m.chief);
  const myTurnAgent = local || (m?.team === s.turn && !m.chief);

  const guess = (i: number) => { vibrate(10); act({ type: "guess", i }); };

  return (
    <>
      <Score s={s} showTurn />
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1.5 text-sm">
        {s.clue ? (
          <span className="min-w-0 truncate" data-testid="clue">Hinweis: <b className="text-lg">{s.clue.word}</b> <b className="text-ice">{s.clue.count === 0 ? "∞" : s.clue.count}</b> · noch {s.guessesLeft} {s.guessesLeft === 1 ? "Versuch" : "Versuche"}</span>
        ) : <span className="text-muted-foreground">Chef {TEAM_NAME[s.turn]} überlegt einen Hinweis …</span>}
        <RulesSheet gameId={room.gameId} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-5 gap-1 py-2" role="group" aria-label="Wörter">
        {s.words.map((w, i) => (
          <WordCard key={i} word={w} color={s.key[i]} revealed={s.revealed[i]} hint={chiefView}
            disabled={s.revealed[i] || !s.clue || !myTurnAgent || (local && peek)} onClick={() => guess(i)} />
        ))}
      </div>

      <div className="grid shrink-0 gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {local && (
          <button type="button" className="glass flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold select-none"
            onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onContextMenu={(e) => e.preventDefault()}
            aria-label="Chef-Ansicht (gedrückt halten)">
            <Eye className="size-4" />{peek ? "Nur die Chefs schauen!" : "Chef-Ansicht – gedrückt halten"}
          </button>
        )}
        {!s.clue && myTurnChief ? (
          <form className="grid grid-cols-[1fr_auto_auto] gap-2" onSubmit={(e) => { e.preventDefault(); act({ type: "clue", word, count }); setWord(""); setCount(1); }}>
            <Input value={word} onChange={(e) => setWord(e.target.value.replace(/\s/g, ""))} placeholder="Hinweiswort" aria-label="Hinweiswort" autoComplete="off" maxLength={30} />
            <div className="flex items-center gap-1">
              <Button type="button" variant="secondary" size="icon" aria-label="Zahl verringern" onClick={() => setCount((c) => Math.max(0, c - 1))}>−</Button>
              <b className="w-5 text-center text-lg tabular-nums" aria-label="Zahl">{count === 0 ? "∞" : count}</b>
              <Button type="button" variant="secondary" size="icon" aria-label="Zahl erhöhen" onClick={() => setCount((c) => Math.min(9, c + 1))}>+</Button>
            </div>
            <Button type="submit" disabled={!word.trim()}>Geben</Button>
          </form>
        ) : s.clue && myTurnAgent ? (
          <Button size="lg" variant="secondary" disabled={s.guessed < 1} onClick={() => act({ type: "pass" })}>
            {s.guessed < 1 ? `Team ${TEAM_NAME[s.turn]}: Wort antippen` : "Zug beenden"}
          </Button>
        ) : (
          <p className="glass rounded-xl py-3 text-center text-muted-foreground">
            <SmoothText>{m?.team ? (m.team === s.turn ? (m.chief ? "Deine Agenten raten …" : "Warte auf den Hinweis deines Chefs.") : `Team ${TEAM_NAME[s.turn]} ist dran.`) : "Du schaust zu – oben im Menü kannst du einem Team beitreten."}</SmoothText>
          </p>
        )}
      </div>
    </>
  );
}

/** Brettspiel-Hilfe: nur die Schlüsselkarte für die Chefs – ihr legt eure eigenen Wortkarten aus */
function KeyCard({ room, game: s, me, act }: BoardProps<CNState, CNAction>) {
  const local = me === null;
  const [shown, setShown] = useState(!local);
  const canSee = local ? shown : !!s.seesKey;
  return (
    <>
      <Score s={s} showTurn={false} />
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1.5 text-sm">
        <span>Es beginnt <b style={{ color: COLOR[s.start] }}>Team {TEAM_NAME[s.start]}</b> (9 Karten)</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      {canSee ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-2">
          {/* Der Rahmen zeigt – wie auf der echten Karte – das Startteam */}
          <div className="grid aspect-square max-h-full w-full max-w-[26rem] grid-cols-5 grid-rows-5 gap-1.5 rounded-2xl p-2.5" style={{ boxShadow: `inset 0 0 0 6px ${COLOR[s.start]}`, background: "#0b1426" }}
            role="group" aria-label="Schlüsselkarte">
            {s.key.map((c, i) => (
              <button key={i} type="button" onClick={() => act({ type: "mark", i })} aria-label={`Feld ${i + 1}: ${c === "neutral" ? "Passant" : c === "attentaeter" ? "Attentäter" : TEAM_NAME[c]}${s.revealed[i] ? ", aufgedeckt" : ""}`}
                aria-pressed={s.revealed[i]} className={cn("grid place-items-center rounded-md text-lg font-extrabold", s.revealed[i] && "opacity-30")} style={{ background: COLOR[c], color: TEXT_ON[c] }}>
                {c === "attentaeter" ? "✕" : s.revealed[i] ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass my-2 grid min-h-0 flex-1 place-items-center rounded-2xl p-6 text-center">
          <div>
            <p className="text-lg font-bold">Die Schlüsselkarte sehen nur die Chefs.</p>
            <p className="mt-1 text-sm text-muted-foreground">Legt 25 Wortkarten aus eurer Schachtel aus (5 × 5). Die Chefs geben Hinweise, die Agenten zeigen auf Karten.</p>
            {local && <Button size="lg" className="mt-4" onClick={() => setShown(true)}><Eye />Schlüsselkarte zeigen</Button>}
          </div>
        </div>
      )}
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {canSee ? (
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <p className="text-sm leading-snug text-muted-foreground">Karte am Tisch aufgedeckt? Hier antippen – die App zählt mit und erkennt den Sieg.</p>
            {local && <Button variant="secondary" onClick={() => setShown(false)}>Verdecken</Button>}
          </div>
        ) : <p className="text-center text-sm text-muted-foreground">Es fehlen noch: Rot {remaining(s, "rot")}, Blau {remaining(s, "blau")}.</p>}
      </div>
    </>
  );
}

function Over({ room, game: s, isHost, dispatch }: BoardProps<CNState, CNAction>) {
  const w = s.winner;
  const team = (t: Team) => Object.entries(s.members).filter(([, m]) => m.team === t).map(([id]) => nameOf(room.players, id)).join(", ");
  const ranking = TEAMS.map((t) => ({ id: t, name: `${TEAM_NAME[t]}: ${team(t) || "–"}`, score: 9 - (t === s.start ? 0 : 1) - remaining(s, t) }))
    .sort((a, b) => (a.id === w ? -1 : b.id === w ? 1 : 0));
  return (
    <ResultScreen winner={w ? `Team ${TEAM_NAME[w]}` : "Niemand"} isHost={isHost} dispatch={dispatch} ranking={ranking} scoreLabel="gefunden"
      subtitle={s.assassin ? `Team ${TEAM_NAME[w ? other(w) : s.turn]} hat den Attentäter erwischt.` : "hat alle Agenten gefunden."}>
      {s.mode === "app" && (
        <div className="grid grid-cols-5 gap-1 text-[0.6rem] font-bold">
          {s.words.map((word, i) => <span key={i} className="truncate rounded px-0.5 py-1" style={{ background: COLOR[s.key[i]], color: TEXT_ON[s.key[i]] }}>{word}</span>)}
        </div>
      )}
    </ResultScreen>
  );
}
