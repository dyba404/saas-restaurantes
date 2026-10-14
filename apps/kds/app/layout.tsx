import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rest Cocina (KDS)",
  description: "Pantalla de cocina: cola de órdenes en vivo de todos los canales.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Rest KDS", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className="dark">
      <body className="antialiased overscroll-none bg-background">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
