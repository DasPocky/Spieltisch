import { useEffect, useRef, useState } from "react";
import { DoorOpen } from "lucide-react";
import { KNOCK_DELEGATE_MS, mayAdmit, type KnockView } from "@shared/platform/directory";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";
import { playSound } from "./sound";

export type KnockEntry = KnockView & { at: number };

/**
 * Jemand klopft an: Der Host lässt ein, lehnt ab oder sagt „Moment“.
 * Reagiert er nicht (offline oder 30 Sekunden still), dürfen alle im Raum entscheiden – nichts bleibt hängen.
 */
export function KnockBar({ knocks, isHost, hostOnline, hostName, onAnswer }: {
  knocks: KnockEntry[]; isHost: boolean; hostOnline: boolean; hostName?: string;
  onAnswer: (id: string, decision: "admit" | "deny" | "wait") => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!knocks.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [knocks.length]);
  // Neues Anklopfen: kurzer Ton und Vibration
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = knocks.filter((k) => !seen.current.has(k.id));
    fresh.forEach((k) => seen.current.add(k.id));
    if (fresh.length && (isHost || !hostOnline)) {
      try { playSound("turn"); } catch { /* ohne Ton */ }
      try { navigator.vibrate?.([80, 60, 80]); } catch { /* egal */ }
    }
  }, [knocks, isHost, hostOnline]);

  if (!knocks.length) return null;
  const k = knocks[0];
  const ago = now - k.at;
  const may = mayAdmit({ ago, snoozed: k.snoozed }, isHost, hostOnline);
  const wait = Math.max(0, Math.ceil((KNOCK_DELEGATE_MS - ago) / 1000));
  return (
    <div className="text-in mb-2 shrink-0 rounded-2xl bg-primary/12 p-2.5 ring-1 ring-inset ring-primary/30" role="alert" data-testid="knock-bar">
      <div className="flex items-center gap-2.5">
        <span className="relative">
          <Avatar avatar={k.avatar} name={k.name} className="size-9 text-xl" />
          <DoorOpen className="absolute -right-1 -bottom-1 size-4 rounded-full bg-background p-0.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <b className="block truncate">{k.name} klopft an</b>
          <span className="text-muted-foreground">
            {knocks.length > 1 ? `und ${knocks.length - 1} weitere · ` : ""}
            {isHost ? (k.snoozed ? "Du hast „Moment“ gesagt" : "Reinlassen?")
              : may ? (hostOnline ? `${hostName ?? "Der Host"} reagiert nicht – du darfst entscheiden` : "Der Host ist offline – du darfst entscheiden")
              : k.snoozed ? `${hostName ?? "Der Host"} entscheidet gleich` : `${hostName ?? "Der Host"} entscheidet (noch ${wait} s)`}
          </span>
        </div>
      </div>
      {may && (
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <Button size="sm" onClick={() => onAnswer(k.id, "admit")}>Einlassen</Button>
          <Button size="sm" variant="secondary" onClick={() => onAnswer(k.id, "deny")}>Ablehnen</Button>
          {isHost && !k.snoozed ? <Button size="sm" variant="ghost" onClick={() => onAnswer(k.id, "wait")}>Moment</Button> : <span />}
        </div>
      )}
    </div>
  );
}
