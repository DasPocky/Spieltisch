import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { newsFor, type NewsEntry } from "@shared/news";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { ONBOARDED_KEY, readJSON, readStr } from "@/lib/storage";
import { introMode } from "./intro/intro";

/** Zuletzt gesehene Neuigkeit (ID) – je Gerät */
export const NEWS_SEEN_KEY = "spieltisch:newsSeen";
/** Für Tests: „Was ist neu?“ auch im automatisierten Browser zeigen */
export const TEST_NEWS_KEY = "spieltisch:test-news";

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

/** Neuigkeiten als Liste – im Fenster nach einem Update und unter Profil → Neuigkeiten */
export function NewsList({ news }: { news: NewsEntry[] }) {
  if (!news.length) return <p className="text-muted-foreground">Gerade gibt es nichts Neues.</p>;
  return (
    <div className="grid gap-4">
      {news.map((n) => (
        <article key={n.id} data-testid="news-entry">
          <h3 className="font-semibold">{n.title}</h3>
          <p className="text-xs text-muted-foreground">{fmtDate(n.date)}</p>
          <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-sm leading-snug">
            {n.items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

/** Ungelesene Neuigkeiten dieses Geräts (neueste zuerst) */
function unread(all: NewsEntry[]): NewsEntry[] {
  const seen = readStr(NEWS_SEEN_KEY);
  const i = all.findIndex((n) => n.id === seen);
  return i < 0 ? all.slice(0, 3) : all.slice(0, i);
}

const markSeen = (all: NewsEntry[]) => { try { if (all[0]) localStorage.setItem(NEWS_SEEN_KEY, all[0].id); } catch { /* egal */ } };

/**
 * „Was ist neu?“ einmal pro Gerät – nur in der App-Hülle (nie mitten im Spiel).
 * Neue Geräte (noch nie eingerichtet) bekommen es nicht: für sie ist ohnehin alles neu.
 */
export function WhatsNew() {
  const config = useSiteConfig();
  const [show, setShow] = useState<NewsEntry[] | null>(null);
  useEffect(() => {
    if (!config) return;
    const all = newsFor(config.news);
    if (navigator.webdriver && !readJSON<boolean>(TEST_NEWS_KEY)) return;
    const known = readStr(NEWS_SEEN_KEY) !== null || !!readJSON<boolean>(ONBOARDED_KEY);
    if (!known || introMode() === "onboarding") { markSeen(all); return; }
    const fresh = unread(all);
    if (!fresh.length) return;
    // Erst nach der Begrüßung
    const t = setTimeout(() => setShow(fresh), introMode() === "welcome" ? 3500 : 600);
    return () => clearTimeout(t);
  }, [config]);
  const close = () => { if (config) markSeen(newsFor(config.news)); setShow(null); };
  return (
    <Sheet open={!!show} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent data-testid="whats-new">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" />Was ist neu?</SheetTitle>
          <SheetDescription>Kurz, was sich seit deinem letzten Besuch getan hat.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-2 pb-4"><NewsList news={show ?? []} /></div>
        <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button className="w-full" onClick={close}>Alles klar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Alle Neuigkeiten als Blatt – aus dem Profil */
export function NewsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const config = useSiteConfig();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Neuigkeiten</SheetTitle>
          <SheetDescription>Was sich am Spieltisch zuletzt getan hat.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"><NewsList news={newsFor(config?.news)} /></div>
      </SheetContent>
    </Sheet>
  );
}
