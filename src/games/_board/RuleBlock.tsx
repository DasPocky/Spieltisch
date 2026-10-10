import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ein Abschnitt der Regelseite (Überschrift und kurzer Text) */
export function RuleBlock({ title, children, extra, focused, rule }: { title: string; children: ReactNode; extra?: ReactNode; focused?: boolean; rule?: string }) {
  return (
    <section data-rule={rule} data-focused={focused || undefined}
      className={cn("mb-2.5 rounded-2xl p-4", focused ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground">{children}</div>
      {extra}
    </section>
  );
}
