import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

/**
 * Carta pública — la página más exigente en rendimiento (benchmark: carta <3s en 3G,
 * docs/05-diseno-pwa.md). En F2 el catálogo va cacheado en el service worker.
 */
export const metadata: Metadata = {
  title: "Carta — Cevichería El Muelle",
  description: "Menú digital · pide desde tu mesa sin app y sin registro",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#e8501a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body className="antialiased bg-background pb-20">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
