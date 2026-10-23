import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { isImage, SET_KINDS, setImageUrl, type CardSet, type CardSetInfo } from "@shared/platform/cardsets";
import { isFolge, isZahl } from "@shared/games/quiz/fragen/typen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/pages/CardSets";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";

const kindName = (k: string) => SET_KINDS.find((x) => x.id === k)?.name ?? k;

/** Anzahl der Vorschläge, die auf eine Entscheidung warten (für die Kachel auf dem Admin-Start) */
export function useWaitingSets(): number | null {
  const { api } = useAdmin();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { api<{ sets: CardSetInfo[] }>("/api/admin/sets").then((r) => setN(r.sets.filter((s) => s.status === "wartet").length), () => setN(null)); }, [api]);
  return n;
}

/**
 * Verwaltung → Kartensets: Vorschläge der Spieler prüfen (Warteschlange zuerst), Inhalt ansehen – auch Bilder –,
 * freigeben oder mit Grund ablehnen. Freigegebene lassen sich wieder aus der Liste nehmen.
 */
export function CardSetsSection() {
  const { api } = useAdmin();
  const [sets, setSets] = useState<CardSetInfo[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { api<{ sets: CardSetInfo[] }>("/api/admin/sets").then((r) => setSets(r.sets), (e: Error) => toast(e.message)); }, [api]);
  useEffect(load, [load]);
  const waiting = sets?.filter((s) => s.status === "wartet") ?? [];
  const listed = sets?.filter((s) => s.status === "frei") ?? [];

  const row = (s: CardSetInfo) => (
    <li key={s.id}>
      <button type="button" onClick={() => setOpen(s.id)} data-testid="admin-set-row"
        className="glass flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-semibold">{s.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{kindName(s.kind)} · {s.count} Einträge{s.by ? ` · von ${s.by}` : ""}</span>
        </span>
        <StatusBadge status={s.status} />
        <span className="text-sm font-semibold text-primary">Ansehen</span>
      </button>
    </li>
  );

  return (
    <div className="grid gap-5" data-testid="admin-sets">
      {!sets && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
      {sets && (
        <>
          <section className="grid gap-2">
            <h2 className="font-semibold">Warten auf Prüfung <span className="font-normal text-muted-foreground">· {waiting.length}</span></h2>
            {waiting.length ? <ul className="grid gap-1.5">{waiting.map(row)}</ul> : <p className="text-sm text-muted-foreground">Gerade wartet nichts.</p>}
          </section>
          <section className="grid gap-2">
            <h2 className="font-semibold">Für alle freigegeben <span className="font-normal text-muted-foreground">· {listed.length}</span></h2>
            {listed.length ? <ul className="grid gap-1.5">{listed.map(row)}</ul> : <p className="text-sm text-muted-foreground">Noch keine.</p>}
          </section>
          <p className="text-xs text-muted-foreground">Spieler sehen freigegebene Sets ohne Namen des Erstellers. Ändert der Ersteller ein freigegebenes Set, verschwindet es aus der Liste, bis es neu geprüft ist.</p>
        </>
      )}
      <Review id={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />
    </div>
  );
}

function Review({ id, onClose, onDone }: { id: string | null; onClose: () => void; onDone: () => void }) {
  const { api } = useAdmin();
  const [set, setSet] = useState<CardSet | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSet(null); setNote("");
    if (id) api<{ set: CardSet }>(`/api/admin/sets/${id}`).then((r) => setSet(r.set), (e: Error) => { toast(e.message); onClose(); });
  }, [id, api, onClose]);
  const decide = async (ok: boolean) => {
    if (!set) return;
    setBusy(true);
    try {
      await api(`/api/admin/sets/${set.id}/review`, { ok, note, at: set.updatedAt });
      toast(ok ? "Freigegeben" : set.status === "frei" ? "Aus der Liste genommen" : "Abgelehnt");
      onDone();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const items = (title: string, xs: string[] | undefined, dark = false) => !!xs?.length && (
    <section className="grid gap-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title} · {xs.length}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {xs.map((x) => (
          <li key={x} className={cn("rounded-lg px-2 py-1 text-sm", dark ? "bg-[#1b1e25] text-white" : "bg-white text-[#1b1e25] ring-1 ring-black/10")}>
            {isImage(x) ? <img src={setImageUrl(x)} alt="Bildkarte" className="max-h-24 rounded" /> : x}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{set?.name ?? "Set"}</SheetTitle>
          <SheetDescription>{set ? `${kindName(set.kind)} · alles ansehen, dann entscheiden` : "Lädt …"}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 overflow-y-auto px-5 pt-1 pb-3" data-testid="admin-set-review">
          {!set ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /> : (
            <>
              {items("Schwarze Karten", set.black, true)}
              {items("Weiße Karten", set.white)}
              {items(set.kind === "zeichnen" ? "Begriffe" : "Wörter", set.words)}
              {!!set.questions?.length && (
                <ol className="grid list-decimal gap-1 pl-5 text-sm">
                  {set.questions.map((q, i) => (
                    <li key={i}><b>{q[0]}</b> <span className="text-muted-foreground">→ {isZahl(q) ? `${q[1]} ${q[2]}` : isFolge(q) ? q[1].join(" → ") : `${q[1]} (falsch: ${q[2]}, ${q[3]}, ${q[4]})`}</span></li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="col-span-2 grid gap-1">
            <Label htmlFor="set-note">Grund – sieht der Ersteller, nötig zum Ablehnen</Label>
            <Input id="set-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Bitte ohne echte Namen" />
          </div>
          <Button variant="destructive" disabled={!set || busy || !note.trim()} onClick={() => void decide(false)} data-testid="admin-set-reject">
            <X />{set?.status === "frei" ? "Aus der Liste" : "Ablehnen"}
          </Button>
          <Button disabled={!set || busy || set.status === "frei"} onClick={() => void decide(true)} data-testid="admin-set-approve"><Check />Freigeben</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
