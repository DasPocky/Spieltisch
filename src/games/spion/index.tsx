import { spion, POINTS, type SpionAction, type SpionState } from "@shared/games/spion/logic";
import { PACKS, PLACES } from "@shared/games/spion/places";
import type { BoardProps, GameUI } from "@/games/types";
import { LogList } from "@/platform/PlayersHistory";
import { Board } from "./Board";

/** Symbol: Hut mit Sonnenbrille vor einer Ortsnadel */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M28 5c-3.9 0-7 3-7 6.9 0 4.8 7 11.1 7 11.1s7-6.3 7-11.1C35 8 31.9 5 28 5z" fill="#cfe0fa" />
      <circle cx="28" cy="11.8" r="2.6" fill="#1f437f" />
      <path d="M8 22.5c0-5 2.6-8.5 6.5-8.5 1.5 0 2.3.8 3.5.8s2-.8 3.5-.8c3.9 0 6.5 3.5 6.5 8.5z" fill="#1b1e25" />
      <rect x="4" y="22" width="28" height="3.2" rx="1.6" fill="#1b1e25" />
      <rect x="9" y="17.5" width="18" height="2.3" fill="#a8454f" />
      <path d="M9 28h7.5a1 1 0 0 1 1 1v.8a3.6 3.6 0 0 1-3.6 3.6h-.3A4.6 4.6 0 0 1 9 28.8z M27 28h-7.5a1 1 0 0 0-1 1v.8a3.6 3.6 0 0 0 3.6 3.6h.3a4.6 4.6 0 0 0 4.6-4.6z" fill="#fdfdfb" />
      <rect x="16" y="28.6" width="4" height="1.4" rx=".7" fill="#fdfdfb" />
    </svg>
  );
}

function Rules({ focus }: { focus?: string }) {
  const h = "mt-4 font-semibold text-foreground";
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">
        Alle bekommen denselben <b className="text-foreground">geheimen Ort</b> (z. B. Bahnhof) und meist eine Rolle dort (z. B. Zugbegleiter).
        Nur der <b className="text-foreground">Spion</b> weiß nicht, wo ihr seid. Die anderen wollen den Spion entlarven, der Spion will den Ort herausfinden – ohne aufzufliegen.
      </p>
      <h3 className={h}>Ablauf einer Runde</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Jeder sieht sich seine Karte an (online am eigenen Handy, an einem Handy reihum mit Sichtschutz).</li>
        <li>Die Uhr läuft (Standard 8 Minuten). Wer oben steht, <b className="text-foreground">fragt</b> jemanden mündlich etwas über den Ort – z. B. „Wie oft bist du hier?“. Der Gefragte antwortet und fragt als Nächster. Wer dich gerade gefragt hat, darfst du nicht direkt zurückfragen.</li>
        <li>Fragen und Antworten dürfen den Ort nicht verraten – sonst hat der Spion leichtes Spiel. Zu vage Antworten machen dich aber verdächtig.</li>
      </ol>
      <h3 className={h} data-rule="vote" data-focused={focus === "vote" || undefined}>Abstimmen</h3>
      <p className="mt-1.5">
        Jeder darf <b className="text-foreground">einmal pro Runde</b> eine Abstimmung starten, die Uhr hält solange an. Alle zeigen auf ihren Verdacht (online: am Handy antippen).
        Standard: Verurteilt ist, wer <b className="text-foreground">mehr als die Hälfte</b> der Stimmen bekommt – oder, wenn eingestellt, <b className="text-foreground">alle Stimmen</b> außer der eigenen (wie in der Vorlage).
        Ohne Ergebnis geht die Runde weiter. Ist die Zeit um, wird ein letztes Mal abgestimmt.
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li>Spion verurteilt: Die anderen gewinnen.</li>
        <li>Unschuldiger verurteilt: Der Spion gewinnt.</li>
        <li>Zeit um und keine Mehrheit: Der Spion gewinnt.</li>
      </ul>
      <h3 className={h}>Der Spion rät</h3>
      <p className="mt-1.5">
        Der Spion darf sich während der Fragerunde <b className="text-foreground">jederzeit enttarnen</b> und den Ort raten (nicht während einer Abstimmung). Richtig: Der Spion gewinnt. Falsch: Die anderen gewinnen.
        Die Liste aller möglichen Orte sieht jeder; online kann man Orte antippen und so durchstreichen – das sieht nur man selbst.
      </p>
      <h3 className={h}>Wertung</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li>Spion gewinnt, weil die Zeit um ist: <b className="text-foreground">{POINTS.spyTime} Punkte</b>.</li>
        <li>Spion errät den Ort oder ein Unschuldiger wird verurteilt: <b className="text-foreground">{POINTS.spyBig} Punkte</b>.</li>
        <li>Spion entlarvt oder falsch geraten: alle anderen je <b className="text-foreground">{POINTS.group} Punkt</b>, wer die erfolgreiche Abstimmung gestartet hat, <b className="text-foreground">{POINTS.accuser}</b>.</li>
        <li>Einfacher: <b className="text-foreground">Nur Runden zählen</b> – wer auf der Gewinnerseite ist, bekommt 1.</li>
      </ul>
      <p className="mt-1.5">Nach der eingestellten Rundenzahl (Standard 5) gewinnt, wer die meisten Punkte hat.</p>
      <h3 className={h}>Orte</h3>
      <p className="mt-1.5">{PLACES.length} Orte in {PACKS.length} Paketen: {PACKS.map((p) => p.name).join(", ")}. Wählt in den Einstellungen, welche Pakete mitspielen. Ohne Rollen bekommt jeder nur den Ort.</p>
      <h3 className={h}>Hausregeln</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className="text-foreground">2 Spione</b> (ab 5 Spielern): Die Spione kennen sich nicht. Wird einer verurteilt, verlieren beide; errät einer den Ort, gewinnen beide.</li>
        <li><b className="text-foreground">Letzte Chance</b>: Ein verurteilter Spion darf noch den Ort raten – richtig geraten gewinnt er doch noch.</li>
      </ul>
    </section>
  );
}

function History({ game: s }: BoardProps<SpionState, SpionAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<SpionState, SpionAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border" data-testid="spion-round">
      {s.phase === "over" ? "Ende" : `Runde ${s.round}/${s.rounds}`}
    </span>
  );
}

export const spionUI: GameUI<SpionState, SpionAction> = {
  logic: spion, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({ cols: ["Punkte"], rows: Object.fromEntries(Object.entries(s.scores).map(([id, n]) => [id, [n]])), curId: s.phase === "talk" ? s.asker : null }),
};
