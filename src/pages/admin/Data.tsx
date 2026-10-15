import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { WIPE_KINDS, type ArchivedRoom, type SiteConfig, type WipeKind } from "@shared/platform/access";
import { setSiteConfig } from "@/hooks/useSiteConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { download, gameName, Status, useSave, type Api } from "./shared";

const WHAT: Record<WipeKind, [string, string]> = {
  rooms: ["Offene Räume", "werden geschlossen – alle fliegen raus"],
  archive: ["Verlauf", "wer wann in welchem Raum war"],
  stats: ["Statistik", "alle Zähler auf 0"],
  groups: ["Gruppen", "mit Mitgliedern und Bestenliste"],
  profiles: ["Profile", "persönliche Statistiken"],
  settings: ["Einstellungen", "Freigaben, Standards, Optionen, Look und Zugangscode auf Auslieferungszustand"],
};

/** Export und Löschen – zum Neustart mit leerer Datenbank */
export function DataTab({ api, onReset }: { api: Api; onReset: (c: SiteConfig) => void }) {
  const [what, setWhat] = useState<WipeKind[]>([]);
  const [confirm, setConfirm] = useState("");
  const wipe = useSave();
  const exp = useSave();

  const exportAll = () => exp.run(async () => {
    const data = await api<{ archive: ArchivedRoom[] }>("/api/admin/export");
    const day = new Date().toISOString().slice(0, 10);
    download(`spieltisch-${day}.json`, JSON.stringify(data, null, 2));
    // Verlauf zusätzlich als Tabelle (öffnet sich in Excel, Numbers, Google Tabellen)
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Raum", "Start", "Zuletzt", "Ende", "Partien", "Spiele", "Leute"].map(q).join(";"),
      ...data.archive.map((r) => [r.code, new Date(r.createdAt).toLocaleString("de-DE"), new Date(r.lastAt).toLocaleString("de-DE"),
        r.endedAt ? new Date(r.endedAt).toLocaleString("de-DE") : "", r.partien, r.games.map(gameName).join(", "), r.players.join(", ")].map(q).join(";"))];
    download(`spieltisch-verlauf-${day}.csv`, "﻿" + rows.join("\n"), "text/csv");
  }, "Export gespeichert (JSON und Tabelle).");

  const run = () => wipe.run(async () => {
    const r = await api<{ rooms: number; groups: number; profiles: number; config?: SiteConfig }>("/api/admin/wipe", { what, confirm: confirm.trim() });
    setWhat([]); setConfirm("");
    // Einstellungen zurückgesetzt: Admin und App sofort auf den frischen Stand
    if (r.config) { setSiteConfig(r.config); onReset(r.config); }
  }, "Gelöscht.");

  return (
    <div className="grid gap-5" data-testid="data">
      <Card className="grid gap-3">
        <h2 className="font-bold">Export</h2>
        <p className="text-sm text-muted-foreground">Statistik, Verlauf, Gruppen, Profile und Einstellungen als Datei – der Verlauf zusätzlich als Tabelle.</p>
        <Status msg={exp.msg} />
        <Button variant="secondary" disabled={exp.busy} onClick={exportAll}>{exp.busy ? <Loader2 className="animate-spin" /> : <Download />}Alles herunterladen</Button>
      </Card>

      <Card className="grid gap-3 ring-1 ring-destructive/30">
        <h2 className="font-bold text-destructive">Daten löschen</h2>
        <p className="text-sm text-muted-foreground">Für einen Neustart. „Alles auswählen“ ergibt einen frischen Stand wie bei der ersten Auslieferung – nur das Admin-Passwort bleibt. Lade vorher den Export herunter, wenn du etwas behalten willst.</p>
        <div className="grid gap-2.5">
          {WIPE_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-3">
              <Checkbox checked={what.includes(k)} onCheckedChange={(c) => setWhat((w) => (c === true ? [...w, k] : w.filter((x) => x !== k)))} aria-label={WHAT[k][0]} />
              <span><span className="block font-semibold">{WHAT[k][0]}</span><span className="block text-xs text-muted-foreground">{WHAT[k][1]}</span></span>
            </label>
          ))}
          <button type="button" className="justify-self-start text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setWhat([...WIPE_KINDS])}>Alles auswählen</button>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wipe-confirm">Zur Sicherheit <b>LÖSCHEN</b> eintippen</Label>
          <Input id="wipe-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} autoComplete="off" placeholder="LÖSCHEN" />
        </div>
        <Status msg={wipe.msg} />
        <Button variant="destructive" disabled={wipe.busy || !what.length || confirm.trim() !== "LÖSCHEN"} onClick={run}>
          {wipe.busy ? <Loader2 className="animate-spin" /> : <Trash2 />}{what.length ? `${what.length} ${what.length === 1 ? "Bereich" : "Bereiche"} endgültig löschen` : "Erst auswählen"}
        </Button>
      </Card>
    </div>
  );
}
