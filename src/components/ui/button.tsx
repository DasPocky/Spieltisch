import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all select-none touch-manipulation disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-navy-400 to-primary text-primary-foreground shadow-[0_6px_20px_rgb(63_122_224/0.35)] hover:brightness-110",
        secondary: "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border hover:bg-accent",
        outline: "ring-1 ring-inset ring-border bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent",
        ice: "bg-ice text-navy-950 hover:bg-ice/90",
        destructive: "bg-destructive/15 text-destructive hover:bg-destructive/25",
      },
      size: {
        default: "h-12 px-5 text-base",
        sm: "h-9 px-3 text-sm",
        lg: "h-14 px-6 text-lg rounded-xl",
        icon: "size-11 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className, variant, size, asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
