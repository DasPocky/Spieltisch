import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { DirGroup, DirProfile } from "@shared/platform/access";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ago, AuthError, Status, useSave, type Api } from "./shared";

/** Gruppen und Profile: wer sich angelegt hat – einzeln löschbar */
export function DirectoryTab({ api }: { api: Api }) {
  const [data, setData] = useState<{ groups: DirGroup[]; profiles: DirProfile[] } | null>(null);
  const [error, setError] = useState("");
  const { msg, run } = useSave();
  const load = useCallback(() => {
    api<{ groups: DirGroup[]; profiles: DirProfile[] }>("/api/admin/directory").then(setData).catch((e) => { if (!(e instanceof AuthError)) setError((e as Error).message); });
  }, [api]);
  useEffect(load, [load]);

  if (!data) return error ? <p className="font-semibold text-destructive">{error}</p> : <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Lädt …</p>;

  const removeGroup = (g: DirGroup) => run(async () => { await api(`/api/admin/groups/${g.code}/delete`, {}); load(); }, `Gruppe „${g.name}“ gelöscht.`);
  const removeProfile = (p: DirProfile) => run(async () => { await api(`/api/admin/profiles/${p.id}/delete`, {}); load(); }, `Profil von ${p.name || "ohne Namen"} gelöscht.`);

  return (
    <div className="grid gap-4" data-testid="directory">
      <p className="text-sm text-muted-foreground">Erfasst wird ab jetzt: jede Gruppe beim nächsten Speichern, jedes Profil nach seiner nächsten Partie.</p>
      <Status msg={msg} />
      <Card className="grid gap-2 p-4">
        <h2 className="font-bold">Gruppen <span className="font-normal text-muted-foreground">· {data.groups.length}</span></h2>
        {data.groups.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine erfasst.</p> : (
          <ul className="divide-y divide-border">
            {data.groups.map((g) => (
              <li key={g.code} className="flex items-center gap-3 py-2" data-testid={`group-${g.code}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="block text-xs text-muted-foreground"><span className="font-mono tracking-wider">{g.code}</span> · {g.members === 1 ? "1 Mitglied" : `${g.members} Mitglieder`} · aktiv {ago(g.lastAt)}</span>
                </span>
                <Confirm title={`Gruppe „${g.name}“ löschen?`} description="Mitglieder, Bestenliste und Statistik der Gruppe sind dann weg. Die Handys merken es beim nächsten Öffnen." confirmLabel="Löschen" onConfirm={() => removeGroup(g)}>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Gruppe ${g.name} löschen`}><Trash2 /></Button>
                </Confirm>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="grid gap-2 p-4">
        <h2 className="font-bold">Profile <span className="font-normal text-muted-foreground">· {data.profiles.length}</span></h2>
        {data.profiles.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine erfasst.</p> : (
          <ul className="divide-y divide-border">
            {data.profiles.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2" data-testid={`profile-${p.id}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name || "ohne Namen"}</span>
                  <span className="block text-xs text-muted-foreground">{p.games === 1 ? "1 Partie" : `${p.games} Partien`} · seit {new Date(p.createdAt).toLocaleDateString("de-DE")} · aktiv {ago(p.lastAt)}</span>
                </span>
                <Confirm title={`Profil von ${p.name || "ohne Namen"} löschen?`} description="Statistik und Verlauf des Profils sind dann weg. Auf dem Handy beginnt es leer." confirmLabel="Löschen" onConfirm={() => removeProfile(p)}>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Profil ${p.name} löschen`}><Trash2 /></Button>
                </Confirm>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
