import { cn } from "@/lib/utils";

/** Auswahl mit 2–4 Optionen, je mit kurzem Hinweis darunter. */
export function Segmented<T extends string>({ label, value, options, editable = true, onChange }: {
  label?: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  editable?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      {label && <div className="mb-2 text-sm font-semibold">{label}</div>}
      <div className="grid gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={!editable}
            onClick={() => value !== o.value && onChange(o.value)}
            className={cn("rounded-lg px-1.5 py-2.5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
              value === o.value ? "bg-navy-600 shadow-md" : "text-muted-foreground")}>
            <div className="text-sm font-semibold">{o.label}</div>
            {o.hint && <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{o.hint}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
