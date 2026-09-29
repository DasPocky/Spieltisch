import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = (props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) => <AlertDialogPrimitive.Root {...props} />;
const AlertDialogTrigger = (props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) => <AlertDialogPrimitive.Trigger {...props} />;

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-950/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl bg-popover p-6 text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

const AlertDialogTitle = ({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) =>
  <AlertDialogPrimitive.Title className={cn("text-xl font-extrabold tracking-tight", className)} {...props} />;
const AlertDialogDescription = ({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) =>
  <AlertDialogPrimitive.Description className={cn("text-muted-foreground", className)} {...props} />;
const AlertDialogAction = ({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Action>) =>
  <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)} {...props} />;
const AlertDialogCancel = ({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) =>
  <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: "secondary" }), className)} {...props} />;

export { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel };
