import { Toaster } from "@/components/ui/sonner";
import { useRoute } from "@/hooks/useRoute";
import { GamePage } from "@/pages/GamePage";
import { Home } from "@/pages/Home";
import { Admin } from "@/pages/Admin";
import { Profile } from "@/pages/Profile";
import { AccessGate } from "@/platform/AccessGate";
import { LocalGame } from "@/pages/LocalGame";
import { OnlineRoom } from "@/pages/OnlineRoom";

export default function App() {
  const route = useRoute();
  return (
    <>
      {route.name === "admin" && <Admin />}
      {route.name === "profile" && <AccessGate><Profile /></AccessGate>}
      {route.name === "home" && <AccessGate><Home /></AccessGate>}
      {route.name === "game" && <AccessGate gameId={route.gameId}><GamePage key={route.gameId} gameId={route.gameId} /></AccessGate>}
      {route.name === "local" && <AccessGate gameId={route.gameId}><LocalGame key={route.gameId} gameId={route.gameId} /></AccessGate>}
      {route.name === "room" && <AccessGate><OnlineRoom key={route.code} code={route.code} /></AccessGate>}
      <Toaster />
    </>
  );
}
