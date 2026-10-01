import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kleiner Hinweis der Spielhilfen – mit `onClick` ein Knopf, der den Vorschlag gleich ausführt */
export function HintChip({ children, onClick, className, testId = "hint-chip" }: { children: ReactNode; onClick?: () => void; className?: string; testId?: string }) {
  const cls = cn("text-in inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-ice ring-1 ring-inset ring-primary/35",
    onClick && "outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring", className);
  const body = <><Lightbulb className="size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{children}</span></>;
  return onClick
    ? <button type="button" onClick={onClick} className={cls} data-testid={testId}>{body}</button>
    : <span className={cls} data-testid={testId}>{body}</span>;
}
