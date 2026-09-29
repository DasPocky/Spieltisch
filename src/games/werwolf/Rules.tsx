import { ROLES, SPECIAL_ROLES, type Role, type RoleInfo } from "@shared/games/werwolf/logic";
import { cn } from "@/lib/utils";

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
          <li><b className="text-foreground">Nacht:</b> Alle schließen die Augen. Der Erzähler weckt nacheinander Amor (nur in der ersten Nacht), Beschützer, Werwölfe, Seherin und Hexe.</li>
          <li><b className="text-foreground">Morgen:</b> Das Dorf erfährt, wer gestorben ist.</li>
          <li><b className="text-foreground">Tag:</b> Alle diskutieren und stimmen ab. Wer die meisten Stimmen hat, stirbt. Bei Gleichstand stirbt niemand.</li>
        </ol>
        <h3 className="mt-4 font-semibold">Sieg</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Das Dorf gewinnt, wenn alle Werwölfe tot sind. Die Werwölfe gewinnen, sobald sie mindestens so viele sind wie alle anderen. Ein gemischtes Liebespaar gewinnt, wenn es als Letztes übrig bleibt.
        </p>
      </section>

      {(["Grundspiel", "Neumond", "Charaktere", "Die Gemeinde"] as RoleInfo["from"][]).map((from) => (
      <div key={from}>
      <h3 className="mt-5 mb-2 font-semibold">Rollen: {from}</h3>
      <ul className="grid gap-2">
        {roles.filter((id) => ROLES[id].from === from).map((id) => {
          const r = ROLES[id];
          return (
            <li key={id} data-focused={id === focus} className={cn("scroll-mt-3 rounded-xl px-3 py-2.5", id === focus ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
              <b>{r.emoji} {r.name}</b> <span className="text-xs text-muted-foreground">· {r.team === "werwolf" ? "Werwölfe" : "Dorf"}</span>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{r.help}</p>
            </li>
          );
        })}
      </ul>
      </div>
      ))}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Welche Rollen mitspielen, legt der Host in den Einstellungen fest. Der Urwolf und der große böse Wolf zählen zu den Werwölfen.</p>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Erzähler: die App</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          <b className="text-foreground">Online</b> handelt jede Rolle geheim am eigenen Handy – nachts alle gleichzeitig. Wer nichts zu tun hat, gibt einen Verdacht ab, der morgens anonym gezeigt wird. So tippt jeder, und niemand verrät sich.
          Tagsüber stimmt jeder am Handy ab; der Host kann die Abstimmung beenden.
          <b className="text-foreground"> Lokal</b> liegt ein Handy in der Mitte, liest vor („Vorlesen“) und die aufgerufenen Rollen tippen selbst.
        </p>
        <h3 className="mt-4 font-semibold">Erzähler: ein Spielleiter</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Der Host leitet und spielt nicht mit. Er sieht alle Rollen, bekommt den Vorlesetext und tippt die Entscheidungen der Nacht und das Urteil des Dorfes ein. Die Mitspieler sehen am Handy nur ihre Rollenkarte.
          Lokal reicht ihr das Gerät zum Rollen-Ansehen herum, danach führt der Spielleiter.
        </p>
      </section>
    </>
  );
}
