import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rest POS — Cevichería El Muelle",
  description: "Punto de venta offline-first para tablets. Funciona sin internet.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Rest POS", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#e8501a",
  width: "device-width",
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body className="antialiased overscroll-none">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
