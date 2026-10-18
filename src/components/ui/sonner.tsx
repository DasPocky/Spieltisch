import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      // Unter der Statusleiste bzw. Notch bleiben
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      toastOptions={{
        style: { background: "var(--navy-600)", color: "var(--foreground)", border: "none", fontFamily: "inherit", fontWeight: 600 },
      }}
      {...props}
    />
  );
}

export { Toaster };
