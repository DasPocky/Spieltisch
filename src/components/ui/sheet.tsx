import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = (props: React.ComponentProps<typeof SheetPrimitive.Root>) => <SheetPrimitive.Root data-slot="sheet" {...props} />;
const SheetTrigger = (props: React.ComponentProps<typeof SheetPrimitive.Trigger>) => <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
const SheetClose = (props: React.ComponentProps<typeof SheetPrimitive.Close>) => <SheetPrimitive.Close data-slot="sheet-close" {...props} />;

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-border bg-popover text-popover-foreground shadow-[0_-12px_40px_rgba(0,0,0,.5)] outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-border" />
        {children}
        <SheetPrimitive.Close className="absolute top-3 right-3 grid size-10 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring">
          <XIcon className="size-5" />
          <span className="sr-only">Schließen</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pt-3 pb-1", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("text-xl font-extrabold tracking-tight", className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
