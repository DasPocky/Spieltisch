import { Crown } from "lucide-react";
import { ROLES, SPECIAL_ROLES, type Role, type RoleInfo } from "@shared/games/werwolf/logic";
import { cn } from "@/lib/utils";
import { Ico } from "./parts";
import { RoleIcon } from "./RoleIcon";

/** Regelseite Werwolf: Ablauf, Rollen, Sieg und die beiden Erzähler-Modi. */
export function Rules({ focus }: { focus?: string }) {
  const roles: Role[] = ["werwolf", "dorf", ...SPECIAL_ROLES];
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Worum geht's?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Im Dorf Düsterwald verstecken sich Werwölfe. Jede Nacht fressen sie einen Dorfbewohner, jeden Tag versucht das Dorf, einen Werwolf zu entlarven und zu verurteilen.
          Jeder kennt nur seine eigene Rolle – die Werwölfe kennen sich untereinander.
        </p>
        <h3 className="mt-4 font-semibold">Ablauf</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li><b className="text-foreground">Nacht:</b> Alle schließen die Augen. Der Erzähler weckt nacheinander: in der ersten Nacht Dieb, Amor und die Verliebten (dann Schwestern, wildes Kind, Wolfshund), jede Nacht Seherin, Fuchs, Rabe, Heiler, die Werwölfe (danach weißer Werwolf, Urwolf, großer böser Wolf), Hexe und Flötenspieler.</li>
          <li><b className="text-foreground">Morgen:</b> Das Dorf erfährt, wer gestorben ist. Die Karten der Toten werden aufgedeckt.</li>
          <li><b className="text-foreground"><Ico icon={Crown} className="mr-1" />Hauptmann:</b> Am ersten Tag wählt das Dorf zuerst einen Hauptmann. Seine Stimme zählt doppelt, bei Gleichstand zählt, wen er gewählt hat. Stirbt er, bestimmt er einen Nachfolger. (Abschaltbar.)</li>
          <li><b className="text-foreground">Tag:</b> Alle diskutieren und stimmen ab. Wer die meisten Stimmen hat, stirbt. Bei Gleichstand stirbt der Sündenbock, sonst entscheidet der Hauptmann; ohne Hauptmann stirbt niemand (oder Stichwahl, siehe Hausregeln). Tote reden nicht mehr mit.</li>
        </ol>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Ist der Engel im Spiel, beginnt die Partie mit einem Tag samt Abstimmung, erst dann kommt die erste Nacht.</p>
        <h3 className="mt-4 font-semibold">Sieg</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Das Dorf gewinnt, wenn alle Werwölfe tot sind. Die Werwölfe gewinnen, wenn kein Dorfbewohner mehr lebt. Ein gemischtes Liebespaar gewinnt, wenn es als Letztes übrig bleibt.
          Solo-Rollen haben eigene Ziele: Der weiße Werwolf will als Einziger überleben, der Flötenspieler alle verzaubern, der Engel in der ersten Runde sterben.
        </p>
        <h3 className="mt-4 font-semibold">Wie viele Werwölfe?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Das Original ist für 8–18 Spieler: 8–11 Spieler 2 Werwölfe, 12–17 Spieler 3, ab 18 Spielern 4. Die App erlaubt schon 5–7 Spieler, dann mit einem Werwolf. „Auto“ richtet sich danach.
        </p>
      </section>

      {(["Grundspiel", "Neumond", "Charaktere", "Die Gemeinde", "Hausregel"] as RoleInfo["from"][]).map((from) => (
      <div key={from}>
      <h3 className="mt-5 mb-2 font-semibold">Rollen: {from === "Hausregel" ? "Beliebte Hausregeln" : from}</h3>
      <ul className="grid gap-2">
        {roles.filter((id) => ROLES[id].from === from).map((id) => {
          const r = ROLES[id];
          return (
            <li key={id} data-focused={id === focus} className={cn("scroll-mt-3 rounded-xl px-3 py-2.5", id === focus ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
              <b><RoleIcon role={id} className="mr-1.5 text-ice" />{r.name}</b> <span className="text-xs text-muted-foreground">· {r.team === "werwolf" ? "Werwölfe" : r.team === "solo" ? "spielt allein" : "Dorf"}</span>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{r.help}</p>
            </li>
          );
        })}
      </ul>
      </div>
      ))}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Welche Rollen mitspielen, legt der Host in den Einstellungen fest. Der Urwolf und der große böse Wolf zählen zu den Werwölfen. Nicht dabei sind z. B. das Mädchen, der Schauspieler und die Ereigniskarten.</p>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Hausregeln – so spielt jeder ein bisschen anders</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li><b className="text-foreground">Ohne Hauptmann</b> spielen (Einstellung „Hauptmann“ aus).</li>
          <li><b className="text-foreground">Gleichstand ohne Hauptmann:</b> niemand stirbt – oder Stichwahl zwischen den Gleichstehenden. Ein lebender Sündenbock stirbt bei Gleichstand immer.</li>
          <li><b className="text-foreground">Wölfe gewinnen schon bei Gleichstand:</b> sobald sie mindestens so viele sind wie alle anderen (kürzere Partien).</li>
          <li><b className="text-foreground">Seherin nur gut/böse:</b> Sie erfährt nicht die Rolle, nur ob jemand zu den Werwölfen gehört.</li>
          <li><b className="text-foreground">Hexe darf sich nicht selbst heilen</b> – im Original darf sie es.</li>
          <li><b className="text-foreground">Erste Nacht ohne Opfer:</b> Die Wölfe lernen sich nur kennen.</li>
          <li><b className="text-foreground">Tote dürfen mitreden</b> – im Original schweigen sie.</li>
          <li><b className="text-foreground">Rollen der Toten erst am Ende aufdecken</b> – im Original sofort.</li>
          <li><b className="text-foreground">Dorfschlampe</b> – keine Originalrolle, aber beliebt.</li>
        </ul>
        <h3 className="mt-4 font-semibold">Mit echten Karten spielen</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Stellt „Rollen: Eigene Karten“ ein, wenn ihr euer Kartenspiel (z. B. Die Werwölfe von Düsterwald) benutzt. Jeder zieht eine Karte.
          Mit Spielleiter tippt er ein, wer was hat; erzählt die App, wählt online jeder seine gezogene Karte am eigenen Handy. Danach führt die App wie gewohnt durch Nacht und Tag.
        </p>
      </section>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Erzähler: die App</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          <b className="text-foreground">Online</b> handelt jede Rolle geheim am eigenen Handy. Standard ist <b className="text-foreground">nacheinander</b> wie am Tisch: Alle schließen die Augen, das Handy des Hosts liest vor, welche Rolle erwacht – nur deren Handy zeigt dann die Auswahl. Alternativ <b className="text-foreground">gleichzeitig</b> (schneller): Alle tippen zur selben Zeit, wer nichts zu tun hat, gibt einen Verdacht ab, der morgens anonym gezeigt wird – so verrät sich niemand.
          Tagsüber stimmt jeder am Handy ab; der Host kann die Abstimmung beenden.
          <b className="text-foreground"> Lokal</b> liegt ein Handy in der Mitte, liest vor („Vorlesen“) und die aufgerufenen Rollen tippen selbst.
        </p>
        <h3 className="mt-4 font-semibold">Automatik mit einem Handy</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Die App ruft jede Rolle auf, dann läuft ein Countdown (Tempo einstellbar). Niemand muss „Weiter“ tippen.</li>
          <li>Gewählt wird durch <b className="text-foreground">Antippen und kurzes Gedrückthalten</b> – leise und sicher gegen Fehltipper.</li>
          <li>Solange jemand am Handy ist, erscheinen Hinweise nur als Text, damit niemand hört, wo das Handy gerade ist. Erst wenn es wieder in der Mitte liegt, spricht die App weiter.</li>
          <li>Ist die Zeit um, verlängert die App und bittet per Text, jetzt zu wählen.</li>
          <li>Die Hexe beantwortet zwei Fragen nacheinander: erst heilen, dann vergiften.</li>
          <li>Am Tag läuft die Diskussionszeit mit Ansage. Abgestimmt wird per Zeigen („3, 2, 1“), geheim reihum oder gemeinsam – je nach Einstellung.</li>
        </ul>
        <h3 className="mt-4 font-semibold">Erzähler: ein Spielleiter</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Der Host leitet und spielt nicht mit. Er sieht alle Rollen, bekommt den Vorlesetext und tippt die Entscheidungen der Nacht und das Urteil des Dorfes ein. Die Mitspieler sehen am Handy nur ihre Rollenkarte.
          Lokal reicht ihr das Gerät zum Rollen-Ansehen herum, danach führt der Spielleiter.
        </p>
      </section>
    </>
  );
}
