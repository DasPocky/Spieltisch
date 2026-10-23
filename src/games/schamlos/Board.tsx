import { useMemo, useState } from "react";
import { Check, Crown } from "lucide-react";
import type { SchamlosAction, SchamlosState } from "@shared/games/schamlos/logic";
import { cardText, fillIn } from "@shared/games/schamlos/cards";
import { isImage, setImageUrl } from "@shared/platform/cardsets";
import { playerName } from "@shared/platform/turns";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { cn } from "@/lib/utils";
import { Avatar, roomAvatars } from "@/platform/Avatar";
import { HandoffCover } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";

type P = BoardProps<SchamlosState, SchamlosAction>;

/** Text einer Karte bzw. eines eingesetzten Stücks – Bildkarten (aus eigenen Sets) als Bild */
export function Piece({ text, className }: { text: string; className?: string }) {
  if (isImage(text)) return <img src={setImageUrl(text)} alt="Bildkarte" className={cn("inline-block max-h-24 rounded-lg align-middle", className)} />;
  return <>{text}</>;
}

/** Schwarze Karte – mit eingesetzten Antworten, sobald welche gewählt sind */
export function BlackCard({ prompt, answers = [], className }: { prompt: string; answers?: string[]; className?: string }) {
  const parts = fillIn(prompt, answers);
  return (
    <div className={cn("rounded-2xl bg-[#1b1e25] p-4 text-lg font-bold leading-snug text-white shadow-lg hyphens-auto [overflow-wrap:anywhere] lg:p-7 lg:text-3xl", className)} data-testid="black-card">
      {parts.map((p, i) => p.fill
        ? <span key={i} className={cn(answers.length ? "text-[#ffb59c]" : "tracking-widest text-white/50")}>{answers.length ? <Piece text={p.text} /> : "______"}</span>
        : <span key={i}>{p.text}</span>)}
    </div>
  );
}

/** Satz einer Antwort als Fließtext – für die Auswahl des Zars */
function Sentence({ prompt, cards }: { prompt: string; cards: string[] }) {
  return <>{fillIn(prompt, cards).map((p, i) => <span key={i} className={p.fill ? "font-bold text-primary" : undefined}><Piece text={p.text} /></span>)}</>;
}

export function Board(props: P) {
  const { room, game: s, me, isHost, dispatch } = props;
  const avatars = useMemo(() => roomAvatars(room), [room]);
  const name = (id: string) => playerName(room, id);
  const local = me === null;

  if (s.phase === "over") {
    const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
    return <ResultScreen winner={s.winnerId ? name(s.winnerId) : "Niemand"} subtitle={`${s.goal} Punkte erreicht`} ranking={ranking} scoreLabel="Punkte" isHost={isHost || local} dispatch={dispatch} />;
  }

  const czar = s.czar;
  const others = room.players.filter((p) => p.id !== czar);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground" data-testid="schamlos-czar">
        <Crown className="size-4 text-primary" />
        <span className="min-w-0 flex-1 truncate">{czar === me ? <b className="text-foreground">Du bist Zar</b> : <><b className="text-foreground">{name(czar)}</b> ist Zar</>} · Runde {s.round}</span>
        <span className="flex -space-x-1">
          {others.map((p) => (
            <span key={p.id} className="relative" title={p.name}>
              <Avatar avatar={avatars[p.id]} name={p.name} className="size-6 text-xs ring-2 ring-background" />
              {s.phase === "pick" && s.played[p.id] && <Check className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />}
            </span>
          ))}
        </span>
      </div>

      {s.phase === "pick" && <Pick {...props} local={local} name={name} />}
      {s.phase === "judge" && <Judge {...props} local={local} name={name} />}
      {s.phase === "result" && <Result {...props} local={local} name={name} />}
    </div>
  );
}

type Sub = P & { local: boolean; name: (id: string) => string };

/** Legen: eigene Hand, eine oder zwei Karten wählen */
function Pick({ game: s, me, act, local, name, room }: Sub) {
  // Lokal: reihum, wer noch nicht gelegt hat – mit Sichtschutz
  const queue = room.players.map((p) => p.id).filter((id) => id !== s.czar && !s.played[id]);
  const who = local ? queue[0] ?? null : me;
  const [shown, setShown] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const hand = who ? s.hands[who] ?? [] : [];
  const done = !who || who === s.czar || !!s.played[who];

  if (local && who && shown !== who) {
    return (
      <>
        <BlackCard prompt={s.prompt} className="shrink-0" />
        <div className="flex flex-1 flex-col justify-center"><HandoffCover name={name(who)} onReveal={() => { setShown(who); setSel([]); }} /></div>
      </>
    );
  }
  if (done) {
    const mine = me ? s.played[me] : undefined;
    return (
      <>
        <BlackCard prompt={s.prompt} answers={mine?.length ? mine : []} className="shrink-0" />
        <p className="glass rounded-2xl p-4 text-center text-muted-foreground" data-testid="schamlos-wait">
          {me === s.czar ? "Die anderen suchen ihre frechste Antwort. Gleich liest du alle vor und wählst." : `Gelegt! Warte auf ${queue.map(name).join(", ") || "die anderen"} …`}
        </p>
      </>
    );
  }
  const toggle = (c: string) => setSel((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c].slice(-s.blanks)));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-6">
      <BlackCard prompt={s.prompt} answers={sel} className="shrink-0 lg:row-span-2 lg:self-start" />
      <div className="-m-1 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-1 lg:grid-cols-3 lg:gap-3" lang="de" data-testid="hand">
        {hand.map((c) => {
          const i = sel.indexOf(c);
          return (
            <button key={c} type="button" onClick={() => toggle(c)} aria-pressed={i >= 0}
              className={cn("relative min-h-20 rounded-xl bg-white p-3 text-left hyphens-auto [overflow-wrap:anywhere] text-[0.95rem] font-semibold leading-snug lg:min-h-36 lg:p-4 lg:text-xl lg:hover:-translate-y-0.5 text-[#1b1e25] shadow-sm ring-1 ring-black/10 transition active:scale-[0.98]",
                i >= 0 && "ring-3 ring-primary")}>
              <Piece text={cardText(c)} className="max-h-32 w-full object-contain" />
              {i >= 0 && s.blanks > 1 && <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>}
            </button>
          );
        })}
      </div>
      <Button size="lg" className="h-13 shrink-0 rounded-2xl text-base lg:col-start-2 lg:h-15 lg:text-lg" disabled={sel.length !== s.blanks}
        onClick={() => { act({ type: "play", cards: sel, ...(local && who ? { player: who } : {}) }); setSel([]); }}>
        {sel.length === s.blanks ? (s.blanks > 1 ? "Karten legen" : "Karte legen") : s.blanks > 1 ? `Wähle ${s.blanks} Karten` : "Wähle eine Karte"}
      </Button>
    </div>
  );
}

/** Wählen: der Zar liest alle Sätze vor und tippt den besten an */
function Judge({ game: s, me, act, local, name, isHost }: Sub) {
  const [shown, setShown] = useState(false);
  const mayChoose = local || me === s.czar;
  if (local && !shown) {
    return (
      <>
        <BlackCard prompt={s.prompt} className="shrink-0" />
        <div className="flex flex-1 flex-col justify-center"><HandoffCover name={name(s.czar)} onReveal={() => setShown(true)} /></div>
      </>
    );
  }
  return (
    <>
      <p className="shrink-0 text-center text-sm text-muted-foreground">
        {mayChoose ? "Lies alle Sätze vor – und tipp den besten an." : `${name(s.czar)} liest vor und wählt …`}
      </p>
      <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto lg:grid-cols-2 lg:gap-4" data-testid="schamlos-subs">
        {s.subs.map((x, i) => (
          <button key={i} type="button" disabled={!mayChoose} onClick={() => act({ type: "choose", index: i })}
            className={cn("rounded-2xl bg-[#1b1e25] p-3.5 text-left leading-snug text-white shadow transition enabled:active:scale-[0.98] lg:p-6 lg:text-2xl lg:enabled:hover:ring-2 lg:enabled:hover:ring-primary", x.by === me && "ring-2 ring-white/40")}>
            <Sentence prompt={s.prompt} cards={x.cards} />
            {x.by === me && <span className="ml-1 text-xs text-white/60">(deine)</span>}
          </button>
        ))}
      </div>
      {!mayChoose && isHost && <p className="shrink-0 text-center text-xs text-muted-foreground">Ist {name(s.czar)} weg? Im Menü kannst du weiterschalten.</p>}
    </>
  );
}

/** Ergebnis der Runde: Gewinnersatz, wer ihn gelegt hat, Punkte */
function Result({ game: s, me, act, local, name, isHost, room }: Sub) {
  const win = s.pick !== null ? s.subs[s.pick] : null;
  const ranking = room.players.map((p) => ({ id: p.id, score: s.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
  return (
    <>
      {win && (
        <div className="shrink-0 rounded-2xl bg-[#1b1e25] p-4 text-lg leading-snug text-white shadow-lg lg:p-8 lg:text-3xl" data-testid="schamlos-win">
          <Sentence prompt={s.prompt} cards={win.cards} />
          <div className="mt-3 text-sm text-white/70">Punkt für <b className="text-white">{win.by === me ? "dich" : name(win.by)}</b> – gewählt von {s.czar === me ? "dir" : name(s.czar)}</div>
        </div>
      )}
      <ul className="glass grid min-h-0 shrink auto-rows-min gap-1.5 overflow-y-auto rounded-2xl p-3 text-sm lg:grid-cols-3 lg:gap-x-8 lg:p-5 lg:text-lg">
        {ranking.map((r) => (
          <li key={r.id} className="flex items-center justify-between"><span className={cn(r.id === win?.by && "font-bold")}>{name(r.id)}</span><b className="tabular-nums">{r.score} / {s.goal}</b></li>
        ))}
      </ul>
      <div className="flex-1" />
      {(local || me === s.czar || isHost) && <Button size="lg" className="h-13 shrink-0 rounded-2xl text-base" onClick={() => act({ type: "next" })}>Nächste Runde</Button>}
    </>
  );
}
