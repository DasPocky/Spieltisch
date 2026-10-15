import { Toaster } from "@/components/ui/sonner";
import { useRoute } from "@/hooks/useRoute";
import { Home } from "@/pages/Home";
import { Admin } from "@/pages/Admin";
import { Profile, ProfileTransfer } from "@/pages/Profile";
import { Group, Groups } from "@/pages/Group";
import { AccessGate } from "@/platform/AccessGate";
import { LocalGame } from "@/pages/LocalGame";
import { OnlineRoom } from "@/pages/OnlineRoom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OfflineBar } from "@/platform/OfflineBar";
import { LoadError } from "@/platform/LoadError";
import { AppShell } from "@/platform/shell/AppShell";
import { Games } from "@/pages/Games";

const CardGallery = lazy(() => import("@/pages/CardGallery").then((m) => ({ default: m.CardGallery })));

export default function App() {
  const route = useRoute();
  return (
    // Spiele laden erst beim Öffnen – solange zeigt sich kurz ein Ladekreis
    <LoadError>
    <Suspense fallback={<div className="grid h-dvh-safe place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      {route.name === "admin" && <Admin />}
      {route.name === "gallery" && <Suspense><CardGallery /></Suspense>}
      {route.name === "profile" && <AccessGate><AppShell tab="profil"><Profile /></AppShell></AccessGate>}
      {route.name === "transfer" && <AccessGate><ProfileTransfer code={route.code} /></AccessGate>}
      {route.name === "groups" && <AccessGate><AppShell tab="gruppe"><Groups /></AppShell></AccessGate>}
      {route.name === "group" && <AccessGate><AppShell tab="gruppe"><Group key={route.code} code={route.code} /></AppShell></AccessGate>}
      {route.name === "home" && <AccessGate><AppShell tab="start"><Home /></AppShell></AccessGate>}
      {route.name === "games" && <AccessGate><AppShell tab="spiele"><Games /></AppShell></AccessGate>}
      {route.name === "local" && <LocalGame />}
      {route.name === "room" && <AccessGate><OnlineRoom key={route.code} code={route.code} /></AccessGate>}
      <OfflineBar />
      <Toaster />
    </Suspense>
    </LoadError>
  );
}

