import type { RoomState } from "@shared/platform/room";
import { cardsLeft, palast, type PalastAction, type PalastState } from "@shared/games/palast/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { Board } from "./Board";
import { Icon } from "./Icon";

const B = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules({ focus }: { focus?: string }) {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">Als Erster <B>alle Karten loswerden</B>. Wer fertig ist, ist raus – die anderen spielen um die Plätze weiter. Wer am Ende als Letzter noch Karten hat, <B>hält die Palastwache</B>.</p>
        <h3 className="mt-4 font-semibold text-foreground">Geben</h3>
        <p className="mt-1.5">
          52 Karten (ab sechs Spielern zwei Blätter), die Farbe spielt keine Rolle. Jeder bekommt <B>drei verdeckte Tischkarten</B>, darauf
          <B> drei offene</B> und <B>drei auf die Hand</B>. Der Rest ist der Nachziehstapel.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Tauschen</h3>
        <p className="mt-1.5">Vor dem Start darf jeder Handkarten gegen offene Tischkarten tauschen – starke Karten (2, 10, Ass, König) liegen besser offen. Tippe eine Handkarte und eine offene an, dann „Fertig“.</p>
        <h3 className="mt-4 font-semibold text-foreground">Legen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Reihum legst du eine oder <B>mehrere gleiche Karten</B>, die <B>gleich hoch oder höher</B> sind als die oberste der Ablage (Ass ist hoch).</li>
          <li>Danach ziehst du auf <B>drei Handkarten</B> nach, solange der Stapel reicht.</li>
          <li>Kannst du nicht legen, <B>nimmst du die ganze Ablage</B> auf die Hand.</li>
          <li>In der App zeigt die Hand jeden Wert nur einmal mit Anzahl. Antippen wählt alle dieses Werts, nochmal antippen eine weniger.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground" data-focused={focus === "house"}>Sonderkarten</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>2 – Neustart:</B> geht auf alles, danach darf wieder alles darauf.</li>
          <li><B>10 – Verbrennen:</B> geht auf alles. Die Ablage kommt aus dem Spiel, und du legst gleich noch einmal.</li>
          <li><B>Vier gleiche</B> hintereinander (auch von mehreren Spielern) verbrennen die Ablage ebenso. (Abschaltbar.)</li>
          <li><B>7:</B> Der Nächste muss 7 oder niedriger legen. (Abschaltbar – Paket „Ohne Sieben“.)</li>
          <li>Wandert die Ablage sehr lange hin und her, ohne dass jemand vorankommt (Stapel leer, nichts verbrannt), wird sie nach dem nächsten Legen verbrannt – damit nichts hängen bleibt.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">Tischkarten</h3>
        <p className="mt-1.5">
          Sind Hand und Stapel leer, spielst du deine <B>offenen Tischkarten</B>, danach <B>blind die verdeckten</B>: Du deckst eine auf –
          passt sie, liegt sie; passt sie nicht, nimmst du sie mit der ganzen Ablage auf die Hand und spielst erst die Hand wieder leer.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Einstellungen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Ohne Sieben:</B> die 7 ist eine normale Karte.</li>
          <li><B>Schnell:</B> ohne Tauschen gleich losspielen.</li>
        </ul>
        <p className="mt-3">An einem Handy für alle: Das Handy geht reihum, beim Tauschen und vor jedem Zug mit Sichtschutz. Wer nicht weiterkommt, für den zieht der Host („Für … ziehen“).</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Sonderkarten</h3>
      <ul className="grid gap-2">
        {[
          { card: "herz-2" as const, title: "Zwei", text: "Neustart – auf alles, danach ist alles erlaubt." },
          { card: "pik-10" as const, title: "Zehn", text: "Verbrennt die Ablage. Du legst gleich noch einmal." },
          { card: "karo-7" as const, title: "Sieben", text: "Der Nächste legt 7 oder niedriger." },
        ].map((x) => (
          <li key={x.card} className="glass flex gap-3 rounded-xl p-3">
            <PlayingCard card={x.card} className="w-11 shrink-0 self-start" />
            <div><b>{x.title}</b><p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{x.text}</p></div>
          </li>
        ))}
      </ul>
    </>
  );
}

function HeaderExtra({ game: s }: BoardProps<PalastState, PalastAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border" data-testid="header-pile">
      Stapel <b className="text-foreground tabular-nums">{s.pileCount}</b>
    </span>
  );
}

const log = (s: PalastState) => s.log;
const overview = (s: PalastState, room: RoomState) => ({
  cols: ["Hand", "Offen", "Verdeckt", "Platz"],
  rows: Object.fromEntries(room.players.map((p) => {
    const place = s.out.indexOf(p.id);
    return [p.id, [s.counts[p.id] ?? 0, (s.up[p.id] ?? []).length, (s.downLeft[p.id] ?? []).filter(Boolean).length,
      place >= 0 ? `${place + 1}.` : s.guard === p.id ? "Wache" : cardsLeft(s, p.id) ? "–" : ""]];
  })),
  curId: s.phase === "play" ? s.curId : null,
});

export const palastUI: GameUI<PalastState, PalastAction> = { logic: palast, Icon, Board, Rules, HeaderExtra, log, overview };
