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
import { OfflineBar } from "@/platform/OfflineBar";

const CardGallery = lazy(() => import("@/pages/CardGallery").then((m) => ({ default: m.CardGallery })));

export default function App() {
  const route = useRoute();
  return (
    <>
      {route.name === "admin" && <Admin />}
      {route.name === "gallery" && <Suspense><CardGallery /></Suspense>}
      {route.name === "profile" && <AccessGate><Profile /></AccessGate>}
      {route.name === "transfer" && <AccessGate><ProfileTransfer code={route.code} /></AccessGate>}
      {route.name === "groups" && <AccessGate><Groups /></AccessGate>}
      {route.name === "group" && <AccessGate><Group key={route.code} code={route.code} /></AccessGate>}
      {route.name === "home" && <AccessGate><Home /></AccessGate>}
      {route.name === "local" && <LocalGame />}
      {route.name === "room" && <AccessGate><OnlineRoom key={route.code} code={route.code} /></AccessGate>}
      <OfflineBar />
      <Toaster />
    </>
  );
}

