import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        style: { background: "var(--navy-600)", color: "var(--foreground)", border: "none", fontFamily: "inherit", fontWeight: 600 },
      }}
      {...props}
    />
  );
}

export { Toaster };
