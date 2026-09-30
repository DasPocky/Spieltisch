import type { ReactNode } from "react";

/**
 * Text, der bei jeder Änderung kurz überblendet statt hart zu springen.
 * `id` bestimmt, wann neu animiert wird (Standard: der Text selbst).
 */
export function SmoothText({ children, id }: { children: ReactNode; id?: string }) {
  const key = id ?? (typeof children === "string" ? children : undefined);
  return <span key={key} className="text-in inline-block">{children}</span>;
}
