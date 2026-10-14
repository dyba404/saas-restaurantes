import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rest — Sistema POS para restaurantes en Perú y Latinoamérica",
    template: "%s · Rest",
  },
  description:
    "Gestiona tu restaurante con Rest: sistema POS (punto de venta), control de cocina, carta QR, pedidos por WhatsApp y modo offline. Pensado para restaurantes de Perú y Latinoamérica.",
  openGraph: {
    type: "website",
    siteName: "Rest",
    locale: "es_PE",
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%230ea5e9'/><text x='16' y='22' font-family='Arial' font-size='17' font-weight='bold' text-anchor='middle' fill='white'>R</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
