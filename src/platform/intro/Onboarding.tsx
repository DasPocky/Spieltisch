import { useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, Trophy, Users, Video } from "lucide-react";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { TRANSFER_CODE_RE, parseProfileId, PROFILE_ID_RE } from "@shared/platform/profile";
import type { Avatar as AvatarData } from "@shared/platform/group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adoptAndSync, syncMe } from "@/lib/group";
import { canUseProfile, myAvatar, myName, redeemTransfer, saveAvatar, saveName } from "@/lib/profile";
import { NAME_KEY, writeJSON } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Avatar, AvatarPicker } from "@/platform/Avatar";
import { Logo } from "@/platform/Logo";
import { ONBOARDED_KEY } from "./intro";

type Step = "hello" | "me" | "tour?" | "tour";

const TOUR = [
  { icon: Users, title: "Raum öffnen, Code teilen", text: "Jeder spielt am eigenen Handy. Wer Raumcode und PIN hat, ist dabei – laufende Räume siehst du auf dem Start." },
  { icon: Video, title: "Treffpunkt", text: "Reden, sehen, schreiben – mit oder ohne Spiel. Video und Chat sind in jedem Raum mit dabei." },
  { icon: Trophy, title: "Eure Gruppe", text: "Für die feste Runde: Siege landen in eurer Bestenliste, Mitglieder holt ihr mit einem Tipp in den Raum." },
];

/**
 * Erster Start auf einem neuen Gerät: Willkommen → Name und Avatar (oder Profil per Code übernehmen) → Rundgang ja/nein.
 * Jeder Schritt lässt sich überspringen; ohne Namen fragt die App ihn spätestens beim ersten Raum.
 */
export function Onboarding({ onDone, start = "hello" }: { onDone: () => void; start?: Step }) {
  const [step, setStep] = useState<Step>(start);
  const [name, setName] = useState(myName);
  const [avatar, setAvatar] = useState<AvatarData>(myAvatar);
  const [adopting, setAdopting] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);

  const finish = () => {
    writeJSON(ONBOARDED_KEY, true);
    setLeaving(true);
    setTimeout(onDone, 380);
  };
  const saveMe = () => {
    const n = cleanName(name);
    if (!n) return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* egal */ }
    void saveName(n).then(syncMe);
    void saveAvatar(avatar);
    setStep("tour?");
  };
  const otherCode = parseProfileId(code);
  const codeOk = TRANSFER_CODE_RE.test(otherCode) || PROFILE_ID_RE.test(otherCode);
  const adopt = async () => {
    setBusy(true); setError(null);
    let pid = otherCode;
    let key: string | undefined;
    if (TRANSFER_CODE_RE.test(otherCode)) {
      const res = await redeemTransfer(otherCode);
      if (!res.id) { setBusy(false); setError(res.error ?? "Das hat nicht geklappt."); return; }
      pid = res.id;
      key = res.key;
    } else if (!(await canUseProfile(pid))) {
      setBusy(false);
      setError("Dieses Profil gehört schon zu einem Handy – nimm dort „Code zum Übertragen anzeigen“.");
      return;
    }
    await adoptAndSync(pid, key);
    setBusy(false);
    setName(myName()); setAvatar(myAvatar());
    setStep("tour?");
  };
  // Der Knopf zählt sofort weiter, das Scrollen holt nur auf – so verzählt sich schnelles Tippen nicht
  const moving = useRef<number | null>(null);
  const toSlide = (i: number) => {
    moving.current = i;
    setSlide(i);
    const el = tourRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  // Ruht der Streifen auf einer Karte (Wischen per Finger), zählt diese – außer der Knopf scrollt gerade woandershin
  const onTourScroll = (el: HTMLDivElement) => {
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (Math.abs(el.scrollLeft - i * el.clientWidth) >= 2) return;
    if (moving.current !== null && moving.current !== i) return;
    moving.current = null;
    setSlide(i);
  };

  return (
    <div className={cn("intro-bg fixed inset-0 z-[60] flex flex-col overflow-hidden", leaving && "intro-out")} data-testid="onboarding">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex h-10 shrink-0 items-center justify-end">
          {step !== "tour?" && <button type="button" onClick={finish} className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground">Überspringen</button>}
        </div>

        {step === "hello" && (
          <div key="hello" className="slide-in flex flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Logo className="logo-pop size-24 -rotate-6 rounded-3xl shadow-[0_6px_0_rgb(0_0_0/0.12),0_16px_30px_rgb(0_0_0/0.18)]" />
              <h1 className="text-rise mt-8 text-3xl font-bold tracking-tight" style={{ animationDelay: "0.5s" }}>Willkommen bei Spieltisch</h1>
              <p className="text-rise mt-3 max-w-xs text-muted-foreground" style={{ animationDelay: "0.65s" }}>Eure Spielesammlung für den Spieleabend – jeder am eigenen Handy, mit Video und Chat direkt am Tisch.</p>
            </div>
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setStep("me")}>Los geht's<ArrowRight /></Button>
          </div>
        )}

        {step === "me" && !adopting && (
          <form key="me" className="slide-in flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); saveMe(); }}>
            <div className="flex flex-1 flex-col justify-center gap-5">
              <div className="flex items-center gap-4">
                <Avatar avatar={avatar} className="size-20 text-5xl shadow-[0_4px_12px_rgb(0_0_0/0.15)]" />
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight">Wer bist du?</h1>
                  <p className="text-sm text-muted-foreground">So sehen dich die anderen am Tisch.</p>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="intro-name">Dein Name</Label>
                <Input id="intro-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="nickname" placeholder="Name" />
              </div>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
            <div className="grid shrink-0 gap-2 pt-4">
              <Button type="submit" size="lg" className="h-14 rounded-2xl text-base" disabled={!cleanName(name)}>Weiter<ArrowRight /></Button>
              <Button type="button" variant="ghost" onClick={() => setAdopting(true)}><KeyRound />Ich habe schon ein Profil</Button>
            </div>
          </form>
        )}

        {step === "me" && adopting && (
          <form key="adopt" className="slide-in flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (codeOk && !busy) void adopt(); }}>
            <div className="flex flex-1 flex-col justify-center gap-4">
              <span className="grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary"><KeyRound className="size-8" /></span>
              <h1 className="text-2xl font-bold tracking-tight">Profil übernehmen</h1>
              <p className="text-sm text-muted-foreground">Auf dem alten Handy: <b className="text-foreground">Profil → Code zum Übertragen anzeigen</b>. Statistik, Name, Avatar und Gruppen ziehen mit um.</p>
              <Input aria-label="Übertragungs-Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters"
                className="h-14 text-center font-mono text-2xl tracking-[0.2em] placeholder:tracking-normal" />
              {error && <p role="alert" className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
            </div>
            <div className="grid shrink-0 gap-2 pt-4">
              <Button type="submit" size="lg" className="h-14 rounded-2xl text-base" disabled={!codeOk || busy}>{busy && <Loader2 className="animate-spin" />}Übernehmen</Button>
              <Button type="button" variant="ghost" onClick={() => { setAdopting(false); setError(null); }}>Doch neu anfangen</Button>
            </div>
          </form>
        )}

        {step === "tour?" && (
          <div key="tour?" className="slide-in flex flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Avatar avatar={avatar} className="avatar-stick size-24 text-6xl shadow-[0_4px_12px_rgb(0_0_0/0.15)]" />
              <h1 className="text-rise mt-6 text-3xl font-bold tracking-tight" style={{ animationDelay: "0.3s" }}>Schön, dass du da bist{cleanName(name) ? `, ${cleanName(name)}` : ""}!</h1>
              <p className="text-rise mt-3 text-muted-foreground" style={{ animationDelay: "0.45s" }}>Soll ich dir kurz zeigen, wie es geht?</p>
            </div>
            <div className="grid shrink-0 gap-2">
              <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setStep("tour")}>Kurz zeigen</Button>
              <Button size="lg" variant="secondary" className="h-14 rounded-2xl text-base" onClick={finish}>Gleich los</Button>
            </div>
          </div>
        )}

        {step === "tour" && (
          <div key="tour" className="slide-in flex min-h-0 flex-1 flex-col">
            <div ref={tourRef} className="no-scrollbar -mx-5 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto" data-testid="tour"
              onScroll={(e) => onTourScroll(e.currentTarget)}>
              {TOUR.map(({ icon: Icon, title, text }) => (
                <section key={title} className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center">
                  <span className="grid size-28 rotate-[-4deg] place-items-center rounded-[2rem] bg-primary text-primary-foreground shadow-[0_6px_0_rgb(0_0_0/0.12),0_16px_30px_rgb(0_0_0/0.16)]"><Icon className="size-14" /></span>
                  <h2 className="mt-8 text-2xl font-bold tracking-tight">{title}</h2>
                  <p className="mt-3 max-w-xs text-muted-foreground">{text}</p>
                </section>
              ))}
            </div>
            <div className="flex shrink-0 justify-center gap-2 py-4" aria-hidden="true">
              {TOUR.map((t, i) => <span key={t.title} className={cn("h-2 rounded-full transition-all", i === slide ? "w-6 bg-primary" : "w-2 bg-foreground/20")} />)}
            </div>
            <Button size="lg" className="h-14 shrink-0 rounded-2xl text-base" onClick={() => (slide < TOUR.length - 1 ? toSlide(slide + 1) : finish())}>
              {slide < TOUR.length - 1 ? <>Weiter<ArrowRight /></> : "Los geht's"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
