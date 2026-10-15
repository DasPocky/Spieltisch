import { useEffect, useState } from "react";
import { Download, EllipsisVertical, MonitorSmartphone, Share, SquarePlus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBackClose } from "@/hooks/useBackClose";
import { readJSON, writeJSON } from "@/lib/storage";
import { Logo } from "./Logo";

const HIDE_KEY = "spieltisch:install-hint";
const INVITED_KEY = "spieltisch:install-invite";
const VISITS_KEY = "spieltisch:visits";

/** Das Ereignis, mit dem Chrome/Android das Installieren anbietet */
interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPrompt; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; writeJSON(HIDE_KEY, true); listeners.forEach((l) => l()); });
  // Besuche zählen (einmal je Sitzung) – ab dem zweiten lädt die App einmal zum Installieren ein
  try {
    if (!sessionStorage.getItem(VISITS_KEY)) {
      sessionStorage.setItem(VISITS_KEY, "1");
      writeJSON(VISITS_KEY, (readJSON<number>(VISITS_KEY) ?? 0) + 1);
    }
  } catch { /* egal */ }
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Installieren: per Knopf (Browser bietet es an), mit Anleitung (iPhone) oder gar nicht (schon installiert) */
export function useInstall() {
  const [canPrompt, setCanPrompt] = useState(() => !!deferred);
  const [standalone] = useState(isStandalone);
  useEffect(() => {
    const on = () => setCanPrompt(!!deferred);
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  const ios = !canPrompt && isIOS();
  return {
    standalone, canPrompt, ios,
    /** Lohnt sich ein Hinweis? Nur wenn wir wirklich helfen können */
    offer: !standalone && (canPrompt || ios),
    prompt: async () => {
      const d = deferred;
      if (!d) return false;
      await d.prompt();
      const choice = await d.userChoice?.catch(() => null);
      deferred = null; listeners.forEach((l) => l());
      return choice?.outcome !== "dismissed";
    },
  };
}

/**
 * Kleiner Hinweis auf der Startseite: Spieltisch als App auf den Home-Bildschirm legen.
 * Öffnet das Blatt mit Knopf bzw. Anleitung. Lässt sich wegklicken.
 */
export function InstallHint() {
  const install = useInstall();
  const [hidden, setHidden] = useState(() => readJSON<boolean>(HIDE_KEY) === true);
  const [open, setOpen] = useState(false);
  if (hidden || !install.offer) return null;
  const hide = () => { writeJSON(HIDE_KEY, true); setHidden(true); };

  return (
    <>
      <div className="glass flex shrink-0 items-center gap-2.5 rounded-2xl py-1.5 pr-1.5 pl-3 text-sm" data-testid="install-hint">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(true)}>
          {install.canPrompt ? (
            <><Download className="size-4 shrink-0 text-primary" /><b>Als App auf den Home-Bildschirm</b></>
          ) : (
            <span className="min-w-0 flex-1 truncate leading-snug text-muted-foreground">
              Als App: <Share className="inline size-4 align-[-3px] text-primary" /> <b className="text-foreground">Teilen</b> → <b className="text-foreground">Zum Home-Bildschirm</b>
            </span>
          )}
        </button>
        <button type="button" onClick={hide} aria-label="Hinweis ausblenden" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <InstallSheet open={open} onClose={() => setOpen(false)} onInstalled={hide} />
    </>
  );
}

/** Ab dem zweiten Besuch einmal von selbst: „Spieltisch als App“ */
export function InstallInvite() {
  const install = useInstall();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!install.offer || readJSON<boolean>(INVITED_KEY) || readJSON<boolean>(HIDE_KEY) || (readJSON<number>(VISITS_KEY) ?? 0) < 2) return;
    const t = setTimeout(() => { writeJSON(INVITED_KEY, true); setOpen(true); }, 1200);
    return () => clearTimeout(t);
  }, [install.offer]);
  return <InstallSheet open={open} onClose={() => setOpen(false)} onInstalled={() => writeJSON(HIDE_KEY, true)} invite />;
}

/** Das Blatt: Vorteile in drei Zeilen, dann Knopf (Android, Chrome) oder Schritt-für-Schritt (iPhone, andere Browser) */
export function InstallSheet({ open, onClose, onInstalled, invite }: { open: boolean; onClose: () => void; onInstalled?: () => void; invite?: boolean }) {
  const install = useInstall();
  useBackClose(open, onClose);
  const steps = install.ios
    ? [[Share, "Unten in der Leiste auf „Teilen“ tippen"], [SquarePlus, "„Zum Home-Bildschirm“ wählen"], [Download, "Oben rechts „Hinzufügen“ tippen"]] as const
    : [[EllipsisVertical, "Das Browsermenü öffnen (⋮ oder ≡)"], [SquarePlus, "„App installieren“ oder „Zum Startbildschirm“ wählen"], [Download, "Bestätigen – fertig"]] as const;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent data-testid="install-sheet">
        <SheetHeader className="flex items-center gap-3 pr-14">
          <Logo className="size-12 shrink-0 -rotate-6 rounded-xl" />
          <div className="min-w-0">
            <SheetTitle>Spieltisch als App</SheetTitle>
            <SheetDescription>{invite ? "Schön, dass du wieder da bist!" : "Direkt vom Home-Bildschirm starten"}</SheetDescription>
          </div>
        </SheetHeader>
        <div className="grid gap-4 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <ul className="grid gap-2 text-sm">
            <li className="flex items-center gap-2.5"><MonitorSmartphone className="size-4.5 shrink-0 text-primary" />Ganzer Bildschirm, ohne Adressleiste</li>
            <li className="flex items-center gap-2.5"><Zap className="size-4.5 shrink-0 text-primary" />Startet schneller, mit eigenem Symbol</li>
            <li className="flex items-center gap-2.5"><SquarePlus className="size-4.5 shrink-0 text-primary" />Kostenlos, ohne App-Store</li>
          </ul>
          {install.canPrompt ? (
            <Button size="lg" onClick={async () => { if (await install.prompt()) onInstalled?.(); onClose(); }}><Download />Installieren</Button>
          ) : (
            <ol className="grid gap-2" data-testid="install-steps">
              {steps.map(([Icon, text], i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-primary/8 p-2.5 text-sm">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 leading-snug">{text}</span>
                  <Icon className="size-5 shrink-0 text-primary" />
                </li>
              ))}
            </ol>
          )}
          <Button variant="ghost" onClick={onClose}>{invite ? "Später" : "Schließen"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Im Profil: Installieren immer erreichbar (außer in der installierten App) */
export function InstallCard() {
  const install = useInstall();
  const [open, setOpen] = useState(false);
  if (install.standalone) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="install-card"><Download />Als App installieren</Button>
      <InstallSheet open={open} onClose={() => setOpen(false)} onInstalled={() => writeJSON(HIDE_KEY, true)} />
    </>
  );
}
