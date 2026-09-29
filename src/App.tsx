import { Toaster } from "@/components/ui/sonner";
import { useRoute } from "@/hooks/useRoute";
import { GamePage } from "@/pages/GamePage";
import { Home } from "@/pages/Home";
import { LocalGame } from "@/pages/LocalGame";
import { OnlineRoom } from "@/pages/OnlineRoom";

export default function App() {
  const route = useRoute();
  return (
    <>
      {route.name === "home" && <Home />}
      {route.name === "game" && <GamePage key={route.gameId} gameId={route.gameId} />}
      {route.name === "local" && <LocalGame key={route.gameId} gameId={route.gameId} />}
      {route.name === "room" && <OnlineRoom key={route.code} code={route.code} />}
      <Toaster />
    </>
  );
}
