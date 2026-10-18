import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { assetPath, FILE_FOLDERS, FILE_MAX_BYTES } from "@shared/platform/files";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { adminToken } from "@/lib/admin";
import { useAdmin } from "./context";
import { AuthError, Panel } from "./shared";

interface StoredFile { path: string; size: number; uploaded: number }

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Dateien der App im Speicher (R2, Ordner „assets/“): je Ordner ansehen, hochladen, löschen.
 * Der Name wird aus dem Dateinamen gebildet (klein, ohne Leerzeichen); gleiche Namen ersetzen die alte Datei.
 */
export function FilesPanel() {
  const { api } = useAdmin();
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try { setFiles((await api<{ files: StoredFile[] }>("/api/admin/files")).files); }
    catch (e) { if (!(e instanceof AuthError)) setMsg({ ok: false, text: (e as Error).message }); setFiles([]); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const send = async (method: "PUT" | "DELETE", path: string, body?: Blob) => {
    setBusy(path); setMsg(null);
    try {
      const res = await fetch(`/api/admin/files/${path}`, { method, body, headers: { authorization: `Bearer ${adminToken() ?? ""}` } });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Das ging gerade nicht.");
      setMsg({ ok: true, text: method === "PUT" ? `${path} hochgeladen` : `${path} gelöscht` });
      await load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  };
  const upload = (folder: string, file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
    const target = assetPath(`${folder}/${name}`);
    if (!target) { setMsg({ ok: false, text: `„${file.name}“ passt nicht in diesen Ordner.` }); return; }
    if (file.size > FILE_MAX_BYTES) { setMsg({ ok: false, text: "Die Datei ist zu groß (höchstens 25 MB)." }); return; }
    void send("PUT", target.path, file);
  };

  return (
    <Panel title="Dateien" hint="Größere Dateien der App liegen im Speicher (R2) – z. B. die 3D-Figuren des Moderators." wide>
      <div className="grid gap-3" data-testid="admin-files">
        {FILE_FOLDERS.map((f) => {
          const inFolder = (files ?? []).filter((x) => x.path.startsWith(`${f.id}/`));
          return (
            <div key={f.id} className="grid gap-1.5 rounded-xl p-3 ring-1 ring-inset ring-border" data-testid={`files-${f.id}`}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><b>{f.label}</b><span className="block text-xs text-muted-foreground">{f.hint}</span></div>
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold ring-1 ring-inset ring-border focus-within:ring-[3px] focus-within:ring-ring">
                  {busy?.startsWith(`${f.id}/`) ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Hochladen
                  <input type="file" className="sr-only" accept={f.ext.map((e) => `.${e}`).join(",")} aria-label={`${f.label} hochladen`}
                    onChange={(e) => { upload(f.id, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
              {files === null ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                : inFolder.length === 0 ? <p className="text-sm text-muted-foreground">Noch leer.</p>
                : (
                  <ul className="grid gap-1">
                    {inFolder.map((x) => (
                      <li key={x.path} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate font-mono">{x.path.slice(f.id.length + 1)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{kb(x.size)}</span>
                        <Confirm title={`${x.path} löschen?`} description="Die Datei ist danach weg – was sie nutzt, zeigt dann den Ersatz." confirmLabel="Löschen"
                          onConfirm={() => void send("DELETE", x.path)}>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label={`${x.path} löschen`} disabled={busy === x.path}><Trash2 /></Button>
                        </Confirm>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          );
        })}
        {msg && <p role="status" className={msg.ok ? "text-sm text-ok" : "text-sm font-semibold text-destructive"}>{msg.text}</p>}
      </div>
    </Panel>
  );
}
