import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Sichtschutz beim lokalen Spielen mit verdeckten Karten: Wechselt der Spieler am Zug,
 * bleibt die Hand verdeckt, bis der Richtige das Handy hat.
 */
export function useHandoff(local: boolean, curId: string | null, players: number) {
  const [shownFor, setShownFor] = useState<string | null>(null);
  return { covered: local && players > 1 && shownFor !== curId, reveal: () => setShownFor(curId) };
}

export function HandoffCover({ name, onReveal }: { name: string; onReveal: () => void }) {
  return (
    <div className="glass grid gap-3 rounded-2xl p-4 text-center">
      <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{name}</b>.</p>
      <Button size="lg" onClick={onReveal}>Ich bin {name} – Karten zeigen</Button>
    </div>
  );
}
