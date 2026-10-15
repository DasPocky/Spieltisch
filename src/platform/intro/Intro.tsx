import { useEffect, useState } from "react";
import { introMode, trackSeen } from "./intro";
import { Onboarding } from "./Onboarding";
import { Welcome } from "./Welcome";

/** Über allem: Willkommen (neues Gerät) bzw. Begrüßung (bekanntes Gerät). Die App lädt darunter schon. */
export function Intro({ onProfile }: { onProfile: () => void }) {
  const [mode, setMode] = useState(introMode);
  useEffect(() => trackSeen(), []);
  if (mode === "onboarding") return <Onboarding onDone={() => { setMode(null); onProfile(); }} />;
  if (mode === "welcome") return <Welcome onDone={() => setMode(null)} />;
  return null;
}
