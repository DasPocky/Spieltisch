/**
 * Beitritts-Nonce: ein wiederholter Beitritt (Antwort ging unterwegs verloren) soll keinen zweiten Spieler anlegen.
 * Die Nonce gilt nur kurz und nur zusammen mit der richtigen PIN – sie ist kein Zugang. Danach verbindet nur das Token.
 */
export const JOIN_RETRY_MS = 2 * 60_000;

/** Ältere Räume speichern hier nur die Spieler-ID – solche Einträge gelten als abgelaufen */
export type JoinEntry = { id: string; at: number } | string;

/** Wer mit dieser Nonce eben beigetreten ist – nur innerhalb der kurzen Frist, sonst null */
export function retryJoin(joins: Record<string, JoinEntry> | undefined, nonce: string | null, now: number): string | null {
  const e = nonce ? joins?.[nonce] : undefined;
  return e && typeof e === "object" && now - e.at < JOIN_RETRY_MS ? e.id : null;
}

/** Beitritt merken; Abgelaufenes fällt dabei weg (höchstens 40 Einträge) */
export function rememberJoin(joins: Record<string, JoinEntry> | undefined, nonce: string, id: string, now: number): Record<string, JoinEntry> {
  const live = Object.entries(joins ?? {}).filter(([, e]) => typeof e === "object" && now - e.at < JOIN_RETRY_MS);
  return Object.fromEntries([...live, [nonce, { id, at: now }]].slice(-40));
}

/** Spieler-ID zu einer Nonce, auch abgelaufen (nur um Entfernte nicht wieder hereinzulassen) */
export const joinedAs = (e: JoinEntry | undefined): string | undefined => (typeof e === "string" ? e : e?.id);
