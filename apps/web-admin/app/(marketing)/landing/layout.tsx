import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Metadata específica de la landing pública (se sirve en /landing).
 * Nota: el canonical apunta a /landing porque la ruta raíz "/" es el panel
 * privado ((dash)) y redirige a /login; /landing es la URL pública real.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Rest — Sistema POS para restaurantes en Perú y Latinoamérica",
  },
  description:
    "Sistema POS para restaurantes: punto de venta con comandas y control de cocina, carta digital QR, pedidos por WhatsApp y modo offline. La forma simple de gestionar restaurantes en Perú y Latinoamérica.",
  openGraph: {
    title: "Rest — Sistema POS para restaurantes en Perú y Latinoamérica",
    description:
      "Punto de venta, carta QR, pedidos por WhatsApp y modo offline para tu restaurante. Empieza con Rest hoy.",
    url: "/landing",
    type: "website",
    locale: "es_PE",
    siteName: "Rest",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rest — Sistema POS para restaurantes en Perú y Latinoamérica",
    description:
      "Punto de venta, carta QR, pedidos por WhatsApp y modo offline para tu restaurante.",
  },
  alternates: {
    canonical: "/landing",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Rest",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/landing`,
      offers: {
        "@type": "Offer",
        price: "49",
        priceCurrency: "PEN",
      },
    },
    {
      "@type": "Organization",
      name: "Rest",
      url: siteUrl,
    },
  ],
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
