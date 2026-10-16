import { useState } from "react";
import { Segmented } from "@/platform/Segmented";
import { useAdmin } from "./context";
import { DirectoryTab } from "./Directory";
import { HistoryTab } from "./History";

/** Leute: wer wann da war (Verlauf), Gruppen und Profile */
export function PeopleSection() {
  const { api, config } = useAdmin();
  const [view, setView] = useState<"history" | "directory">("history");
  return (
    <div className="grid gap-4" data-testid="admin-people">
      <Segmented value={view} onChange={setView} options={[{ value: "history", label: "Verlauf", hint: "wer wann da war" }, { value: "directory", label: "Gruppen & Profile", hint: "Verzeichnis" }]} />
      {view === "history" ? <HistoryTab api={api} archiveDays={config.archiveDays} /> : <DirectoryTab api={api} />}
    </div>
  );
}
