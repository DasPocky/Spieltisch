import type { ReactNode } from "react";
import { Eye, Laptop, LayoutPanelTop, Smartphone, Tv, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavRow } from "./NavRow";
import { ROLES, type DeviceRole, type RoleSwitch } from "./deviceRole";

/** Was ein Gerät gerade ist und wohin es wechseln kann – für Menü und Blatt */
export interface DeviceControls {
  role: DeviceRole;
  switches: RoleSwitch[];
  onSwitch: (s: RoleSwitch) => void;
  /** Karten liegen gerade nur am Begleit-Handy */
  handOnPhone?: boolean;
  /** Am Rechner wäre hier grundsätzlich möglich (sonst Hinweis auf den Laptop) */
  deskHint?: boolean;
  /** Knöpfe der Fernbedienung (nur Host mit verbundenem Fernseher) */
  remote?: ReactNode;
}

const ICONS: Record<DeviceRole, LucideIcon> = { phone: Smartphone, remote: Tv, desk: Laptop, companion: Smartphone, screen: Tv, shared: Smartphone };

function switchRow(s: RoleSwitch, d: DeviceControls): [LucideIcon, string, string] | null {
  switch (s) {
    case "screen": return [Tv, "Fernseher werden", "Zeigt den Tisch – du bleibst Mitspieler"];
    case "desk": return [Laptop, "Am Rechner spielen", "Tisch aus deiner Sicht, deine Hand darunter"];
    case "classic": return [LayoutPanelTop, "Klassische Ansicht", "Wie am Handy, nur breiter"];
    case "pair": return [Smartphone, "Begleit-Handy koppeln", "Kamera, Mikro, Chat und deine Karten am Handy"];
    case "private": return [Eye, d.handOnPhone ? "Karten hier zeigen" : "Karten nur am Handy", d.handOnPhone ? "Deine Hand liegt wieder am Rechner" : "Der Rechner zeigt nur noch den Tisch"];
    case "remote": return null;
  }
}

/** Zeile im Menü unter „Mein Gerät“ */
export function DeviceRow({ device, onOpen }: { device: DeviceControls; onOpen: () => void }) {
  const r = ROLES[device.role];
  return <NavRow icon={ICONS[device.role]} outline title={<>Dieses Gerät: <span data-testid="device-role">{r.label}</span></>}
    sub={device.switches.length ? "Wechseln" : "Was heißt das?"} onClick={onOpen} className="min-w-0" data-testid="device-row" />;
}

/** „Mein Gerät ist …“: Rolle erklären, Wechsel an einer Stelle – nur was gerade passt */
export function DeviceSheet({ device, open, onOpenChange }: { device: DeviceControls; open: boolean; onOpenChange: (o: boolean) => void }) {
  const r = ROLES[device.role];
  const Icon = ICONS[device.role];
  const pick = (s: RoleSwitch) => { onOpenChange(false); device.onSwitch(s); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Mein Gerät ist …</SheetTitle>
          <SheetDescription>Gerät und Spieler sind getrennt: Wechselst du das Gerät, bleibst du Mitspieler.</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 overflow-y-auto px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="device-sheet">
          <div className="flex items-start gap-3 rounded-xl bg-primary/10 px-3 py-2.5 ring-1 ring-inset ring-primary/30" data-testid="device-current">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="min-w-0 leading-tight">
              <b className="block">{r.label}</b>
              <span className="mt-0.5 block text-sm text-muted-foreground">{r.text}</span>
            </span>
          </div>
          {device.switches.includes("remote") && device.remote && <div className="grid gap-1.5"><h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fernseher steuern</h3>{device.remote}</div>}
          {device.switches.some((s) => s !== "remote") && <h3 className="mt-1 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Wechseln</h3>}
          {device.switches.map((s) => {
            const row = switchRow(s, device);
            return row && <NavRow key={s} icon={row[0]} outline title={row[1]} sub={row[2]} onClick={() => pick(s)} data-testid={`device-switch-${s}`} />;
          })}
          {device.deskHint && <p className="px-1 text-xs text-muted-foreground">Am Rechner mitspielen und ein Begleit-Handy koppeln geht auf einem Laptop oder Rechner.</p>}
          {device.role === "companion" && <p className="px-1 text-xs text-muted-foreground">Ansicht und Karten schaltest du am Rechner um (Menü · Mein Gerät).</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
