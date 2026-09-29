import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("glass rounded-2xl p-5 text-card-foreground", className)} {...props} />;
}

export { Card };
