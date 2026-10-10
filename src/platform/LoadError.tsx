import { Component, type ReactNode } from "react";
import { RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/useRoute";

/**
 * Fängt ab, wenn ein Spiel nicht geladen werden kann (z. B. ohne Netz, bevor es je gespeichert wurde) –
 * statt einer leeren Seite gibt es einen Hinweis mit „Nochmal“.
 */
export class LoadError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto grid h-dvh-safe max-w-md place-items-center px-6 text-center" role="alert">
        <div>
          <WifiOff className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight">Das Spiel lädt gerade nicht</h1>
          <p className="mt-1 text-muted-foreground">Wahrscheinlich fehlt das Netz. Mit Netz einmal öffnen – danach geht es auch offline.</p>
          <div className="mt-5 grid gap-2">
            {/* Der Browser merkt sich fehlgeschlagene Ladeversuche – deshalb die Seite neu laden */}
            <Button onClick={() => location.reload()}><RotateCw />Nochmal versuchen</Button>
            <Button variant="secondary" onClick={() => { navigate("/"); location.reload(); }}>Zur Startseite</Button>
          </div>
        </div>
      </main>
    );
  }
}
