import { useAdmin } from "./context";
import { OverviewTab } from "./Overview";

/** Statistik: Partien, beliebteste Spiele, Verläufe */
export function StatsSection() {
  const { api } = useAdmin();
  return <OverviewTab api={api} />;
}
